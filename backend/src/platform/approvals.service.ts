import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../common/auth.js';
import { randomCode } from '../common/utils/crypto.js';
import { slugify } from '../common/utils/format.js';
import { toE164 } from '../common/utils/phone.js';
import { InjectEnv, type Env } from '../config/config.module.js';
import {
  ApprovalModel,
  AuditLogModel,
  CeremonyModel,
  FlatAreaModel,
  FlatModel,
  RoomZoneModel,
  UserModel,
  WeddingMemberModel,
  WeddingModel,
  type WeddingDoc,
} from '../models/schemas.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { createRoomsAndTiles, type RoomInput } from '../weddings/rooms.js';
import { withTransaction } from '../database/helpers.js';

export interface CeremonyDraft {
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  venueName: string;
  venueAddress?: string | null;
  venueMapsUrl?: string | null;
  dressCode?: string | null;
  coverImageUrl?: string | null;
}

export interface RegistrationInput {
  brideName: string;
  groomName: string;
  welcomeNote?: string | null;
  city?: string | null;
  weddingDate?: Date | null;
  contactMobile: string;
  coverPhotoUrl?: string | null;
  cardImageUrl?: string | null;
  flatId: string;
  slug?: string;
  ceremonies: CeremonyDraft[];
}

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectEnv() private readonly env: Env,
    private readonly notifications: NotificationsService,
  ) {}

  async register(user: AuthUser, input: RegistrationInput) {
    const flat = await FlatModel.findById(input.flatId);
    if (!flat || flat.status !== 'AVAILABLE') {
      throw new ConflictException({ code: 'FLAT_UNAVAILABLE', message: 'That flat is not available. Choose another one.' });
    }
    const contactMobile = toE164(input.contactMobile, this.env.DEFAULT_PHONE_COUNTRY);
    if (!contactMobile) throw new BadRequestException({ code: 'INVALID_PHONE', message: 'Enter a valid contact mobile number' });
    const slug = await this.uniqueSlug(input.slug, input.brideName, input.groomName);
    const wedding = await WeddingModel.create({
      slug,
      brideName: input.brideName,
      groomName: input.groomName,
      welcomeNote: input.welcomeNote ?? null,
      city: input.city ?? null,
      weddingDate: input.weddingDate ?? null,
      coverPhotoUrl: input.coverPhotoUrl || null,
      cardImageUrl: input.cardImageUrl || null,
      contactMobile,
      propertyName: flat.name,
      propertyLocation: flat.location,
      totalSft: flat.totalSft,
      ratePerSftPaise: flat.pricePerSftPaise,
      brickRatio: flat.brickRatio,
      minGiftPaise: flat.minGiftPaise,
      targetAmountPaise: flat.targetAmountPaise,
      flatId: flat._id,
      approvalStatus: 'PENDING',
      linkVisibility: 'PRIVATE',
      kycStatus: 'REQUIRED',
      presetTiers: [1, 5, 10],
    });
    await WeddingMemberModel.create({ weddingId: wedding._id, userId: user.id, role: 'HOST' });
    await this.writeCeremonies(wedding.id, input.ceremonies);
    await ApprovalModel.create({ weddingId: wedding._id, adminId: null, decision: 'PENDING', reason: null });
    await AuditLogModel.create({ actorId: user.id, action: 'wedding.register', entityType: 'wedding', entityId: wedding.id, meta: { flatId: flat.id } });
    return this.detail(wedding);
  }

  async updateRegistration(user: AuthUser, slug: string, input: RegistrationInput) {
    const wedding = await this.ownedEditable(user, slug);
    const flat = await FlatModel.findById(input.flatId);
    if (!flat || (flat.status !== 'AVAILABLE' && String(flat.reservedWeddingId ?? '') !== wedding.id)) {
      throw new ConflictException({ code: 'FLAT_UNAVAILABLE', message: 'That flat is not available. Choose another one.' });
    }
    const contactMobile = toE164(input.contactMobile, this.env.DEFAULT_PHONE_COUNTRY);
    if (!contactMobile) throw new BadRequestException({ code: 'INVALID_PHONE', message: 'Enter a valid contact mobile number' });
    const updated = await WeddingModel.findByIdAndUpdate(
      wedding.id,
      {
        $set: {
          brideName: input.brideName,
          groomName: input.groomName,
          welcomeNote: input.welcomeNote ?? null,
          city: input.city ?? null,
          weddingDate: input.weddingDate ?? null,
          coverPhotoUrl: input.coverPhotoUrl || null,
          cardImageUrl: input.cardImageUrl || null,
          contactMobile,
          propertyName: flat.name,
          propertyLocation: flat.location,
          totalSft: flat.totalSft,
          ratePerSftPaise: flat.pricePerSftPaise,
          brickRatio: flat.brickRatio,
          minGiftPaise: flat.minGiftPaise,
          targetAmountPaise: flat.targetAmountPaise,
          flatId: flat._id,
          approvalStatus: 'PENDING',
          approvalNote: null,
        },
      },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Wedding not found');
    await CeremonyModel.deleteMany({ weddingId: updated._id });
    await this.writeCeremonies(updated.id, input.ceremonies);
    await ApprovalModel.create({ weddingId: updated._id, adminId: null, decision: 'PENDING', reason: 'Resubmitted' });
    return this.detail(updated);
  }

  async queue() {
    const weddings = await WeddingModel.find({ approvalStatus: { $in: ['PENDING', 'CHANGES_REQUESTED'] } }).sort({ createdAt: 1 });
    return Promise.all(weddings.map((wedding) => this.detail(wedding)));
  }

  async decide(admin: AuthUser, weddingId: string, decision: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED', reason?: string) {
    const wedding = await WeddingModel.findById(weddingId);
    if (!wedding) throw new NotFoundException('Wedding not found');
    if (wedding.approvalStatus === 'APPROVED' || wedding.approvalStatus === 'REJECTED') {
      throw new ConflictException({ code: 'ALREADY_DECIDED', message: 'This registration has already been decided' });
    }
    if (decision === 'APPROVED') await this.approve(admin, wedding);
    else {
      await WeddingModel.updateOne({ _id: wedding._id }, { $set: { approvalStatus: decision, approvalNote: reason ?? null } });
    }
    await ApprovalModel.create({ weddingId: wedding._id, adminId: admin.id, decision, reason: reason ?? null });
    await AuditLogModel.create({
      actorId: admin.id,
      action: `wedding.${decision.toLowerCase()}`,
      entityType: 'wedding',
      entityId: wedding.id,
      meta: { reason: reason ?? null },
    });
    await this.notifyCouple(wedding, decision, reason);
    const fresh = await WeddingModel.findById(wedding.id);
    return this.detail(fresh ?? wedding);
  }

  async submitKyc(user: AuthUser, slug: string, input: { legalName: string; idLast4: string }) {
    const wedding = await this.owned(user, slug);
    const updated = await WeddingModel.findByIdAndUpdate(
      wedding.id,
      { $set: { kycStatus: 'SUBMITTED', kycLegalName: input.legalName, kycIdLast4: input.idLast4, kycNote: null } },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Wedding not found');
    await AuditLogModel.create({ actorId: user.id, action: 'kyc.submit', entityType: 'wedding', entityId: wedding.id, meta: {} });
    return { kycStatus: updated.kycStatus, kycLegalName: updated.kycLegalName, kycIdLast4: updated.kycIdLast4 };
  }

  async reviewKyc(admin: AuthUser, weddingId: string, decision: 'VERIFIED' | 'REJECTED', reason?: string) {
    const wedding = await WeddingModel.findById(weddingId);
    if (!wedding) throw new NotFoundException('Wedding not found');
    const updated = await WeddingModel.findByIdAndUpdate(
      wedding.id,
      { $set: { kycStatus: decision === 'VERIFIED' ? 'VERIFIED' : 'REJECTED', kycNote: reason ?? null } },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Wedding not found');
    await AuditLogModel.create({ actorId: admin.id, action: `kyc.${decision.toLowerCase()}`, entityType: 'wedding', entityId: wedding.id, meta: { reason: reason ?? null } });
    return { kycStatus: updated.kycStatus, kycNote: updated.kycNote };
  }

  async publicCard(slug: string) {
    const wedding = await WeddingModel.findOne({ slug });
    if (!wedding || wedding.approvalStatus !== 'APPROVED' || wedding.linkVisibility === 'PAUSED') {
      throw new NotFoundException('Wedding not found');
    }
    const line = wedding.welcomeNote?.split('\n')[0]?.slice(0, 140) || 'You are invited. Your presence is the greatest gift.';
    return {
      slug: wedding.slug,
      brideName: wedding.brideName,
      groomName: wedding.groomName,
      coverPhotoUrl: wedding.coverPhotoUrl,
      cardImageUrl: wedding.cardImageUrl,
      city: wedding.city,
      weddingDate: wedding.weddingDate,
      line,
    };
  }

  private async approve(admin: AuthUser, wedding: WeddingDoc) {
    if (!wedding.flatId) throw new BadRequestException('This registration has no flat selected');
    const flat = await FlatModel.findById(wedding.flatId);
    if (!flat || flat.status === 'ARCHIVED') throw new ConflictException({ code: 'FLAT_UNAVAILABLE', message: 'The selected flat is no longer available' });
    if (flat.status === 'RESERVED' && String(flat.reservedWeddingId) !== wedding.id) {
      throw new ConflictException({ code: 'FLAT_RESERVED', message: 'Another wedding already reserved this flat' });
    }
    const areas = await FlatAreaModel.find({ flatId: flat._id }).sort({ sortOrder: 1 });
    if (!areas.length) throw new BadRequestException('The flat has no areas');
    await withTransaction(async (session) => {
      const roomsExist = await RoomZoneModel.countDocuments({ weddingId: wedding._id });
      if (!roomsExist) {
        const rooms: RoomInput[] = areas.map((area) => ({
          key: area.key,
          name: area.name,
          sft: area.sft,
          description: area.description,
          icon: area.icon,
        }));
        await createRoomsAndTiles(session, wedding.id, rooms);
      }
      await FlatModel.updateOne({ _id: flat._id }, { $set: { status: 'RESERVED', reservedWeddingId: wedding._id } }, { session });
      await WeddingModel.updateOne(
        { _id: wedding._id },
        {
          $set: {
            approvalStatus: 'APPROVED',
            approvalNote: null,
            linkVisibility: 'PUBLIC',
            totalSft: flat.totalSft,
            ratePerSftPaise: flat.pricePerSftPaise,
            brickRatio: flat.brickRatio,
            minGiftPaise: flat.minGiftPaise,
            targetAmountPaise: flat.targetAmountPaise,
            propertyName: flat.name,
            propertyLocation: flat.location,
          },
        },
        { session },
      );
    });
    void admin;
  }

  private async notifyCouple(wedding: WeddingDoc, decision: string, reason?: string) {
    const host = await WeddingMemberModel.findOne({ weddingId: wedding._id, role: 'HOST' }).populate<{ user: { id: string; phone: string; name: string | null } }>('user');
    const user = host?.get('user') as { id: string; phone: string; name: string | null } | undefined;
    const phone = wedding.contactMobile || user?.phone;
    const couple = `${wedding.brideName} & ${wedding.groomName}`;
    const title =
      decision === 'APPROVED' ? 'Your wedding is approved' : decision === 'REJECTED' ? 'Wedding registration was not approved' : 'Changes requested on your wedding';
    const body =
      decision === 'APPROVED'
        ? `${couple}, your celebration is approved. Share plottheirfuture.in/w/${wedding.slug} and start inviting guests.`
        : `${couple}: ${reason ?? 'Please review your registration.'}`;
    if (user) {
      await this.notifications.sendNotice({ phone, userId: user.id, template: 'ptf_registration_decision', title, body }).catch(() => undefined);
    }
  }

  private async owned(user: AuthUser, slug: string) {
    const wedding = await WeddingModel.findOne({ slug });
    if (!wedding) throw new NotFoundException('Wedding not found');
    const member = await WeddingMemberModel.findOne({ weddingId: wedding._id, userId: user.id, role: { $in: ['HOST', 'CO_HOST'] } });
    if (!member && !user.isPlatformAdmin) throw new ForbiddenException({ code: 'FORBIDDEN_ROLE', message: 'Only the couple can update this registration' });
    return wedding;
  }

  private async ownedEditable(user: AuthUser, slug: string) {
    const wedding = await this.owned(user, slug);
    if (wedding.approvalStatus !== 'PENDING' && wedding.approvalStatus !== 'CHANGES_REQUESTED') {
      throw new ConflictException({ code: 'REGISTRATION_LOCKED', message: 'This registration can no longer be edited' });
    }
    return wedding;
  }

  private async writeCeremonies(weddingId: string, ceremonies: CeremonyDraft[]) {
    await CeremonyModel.insertMany(
      ceremonies.map((ceremony, sortOrder) => ({
        weddingId,
        title: ceremony.title,
        description: ceremony.description ?? null,
        startsAt: ceremony.startsAt,
        endsAt: ceremony.endsAt ?? null,
        venueName: ceremony.venueName,
        venueAddress: ceremony.venueAddress ?? null,
        venueMapsUrl: ceremony.venueMapsUrl || null,
        dressCode: ceremony.dressCode ?? null,
        coverImageUrl: ceremony.coverImageUrl || null,
        sortOrder,
      })),
    );
  }

  private async uniqueSlug(requested: string | undefined, bride: string, groom: string) {
    let slug = requested || slugify(`${bride.split(' ')[0]}-${groom.split(' ')[0]}`);
    if (slug.length < 3) slug = `wedding-${randomCode(6)}`;
    if (await WeddingModel.exists({ slug })) {
      if (requested) throw new ConflictException({ code: 'SLUG_TAKEN', message: 'This wedding URL is already taken' });
      slug = `${slug}-${randomCode(4)}`.slice(0, 60);
    }
    return slug;
  }

  private async detail(wedding: WeddingDoc) {
    const [ceremonies, flat, hostMember] = await Promise.all([
      CeremonyModel.find({ weddingId: wedding._id }).sort({ startsAt: 1 }),
      wedding.flatId ? FlatModel.findById(wedding.flatId).select('name location flatType status totalSft pricePerSftPaise') : null,
      WeddingMemberModel.findOne({ weddingId: wedding._id, role: 'HOST' }),
    ]);
    const host = hostMember ? await UserModel.findById(hostMember.userId).select('phone name') : null;
    return {
      id: wedding.id,
      slug: wedding.slug,
      brideName: wedding.brideName,
      groomName: wedding.groomName,
      welcomeNote: wedding.welcomeNote,
      city: wedding.city,
      weddingDate: wedding.weddingDate,
      coverPhotoUrl: wedding.coverPhotoUrl,
      cardImageUrl: wedding.cardImageUrl,
      contactMobile: wedding.contactMobile,
      approvalStatus: wedding.approvalStatus,
      approvalNote: wedding.approvalNote,
      linkVisibility: wedding.linkVisibility,
      kycStatus: wedding.kycStatus,
      kycLegalName: wedding.kycLegalName,
      kycIdLast4: wedding.kycIdLast4,
      registrant: host ? { id: host.id, name: host.name, phone: host.phone } : null,
      flat: flat
        ? { id: flat.id, name: flat.name, location: flat.location, flatType: flat.flatType, status: flat.status, totalSft: flat.totalSft, pricePerSftPaise: flat.pricePerSftPaise }
        : null,
      ceremonies: ceremonies.map((ceremony) => ({
        id: ceremony.id,
        title: ceremony.title,
        description: ceremony.description,
        startsAt: ceremony.startsAt,
        endsAt: ceremony.endsAt,
        venueName: ceremony.venueName,
        venueAddress: ceremony.venueAddress,
        venueMapsUrl: ceremony.venueMapsUrl,
        dressCode: ceremony.dressCode,
        coverImageUrl: ceremony.coverImageUrl,
      })),
    };
  }
}
