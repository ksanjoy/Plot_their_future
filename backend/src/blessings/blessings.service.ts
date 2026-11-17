import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from 'obscenity';
import type { WeddingAccess } from '../access/wedding-access.service.js';
import type { UploadedFileData } from '../common/upload.js';
import { BlessingModel, type BlessingDoc } from '../models/schemas.js';
import type { ModerationStatus, StageDisplayMode } from '../models/types.js';
import { RealtimeService, rooms } from '../realtime/realtime.service.js';
import { ANONYMOUS_NAME } from '../registry/registry.service.js';
import { StorageService } from '../storage/storage.service.js';

const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export interface BlessingInput {
  message?: string | null;
  authorName?: string;
  tableNumber?: string | null;
}

@Injectable()
export class BlessingsService {
  constructor(
    private readonly storage: StorageService,
    private readonly realtime: RealtimeService,
  ) {}

  view(b: BlessingDoc, mode: StageDisplayMode = 'NAMES_AND_BLESSINGS') {
    return {
      id: b.id,
      authorName: mode === 'NAMES_AND_BLESSINGS' ? b.authorName : ANONYMOUS_NAME,
      message: b.message,
      photoUrl: b.photoKey ? this.storage.publicUrl(b.photoKey) : null,
      tableNumber: b.tableNumber,
      status: b.status,
      createdAt: b.createdAt,
    };
  }

  async create(access: WeddingAccess, input: BlessingInput, photo?: UploadedFileData) {
    const message = input.message?.trim() || null;
    if (!message && !photo) throw new BadRequestException('Write a blessing or attach a photo');
    if (message && matcher.hasMatch(message)) {
      throw new BadRequestException({ code: 'INAPPROPRIATE_CONTENT', message: 'Please keep your blessing family-friendly' });
    }
    if (photo) {
      if (!photo.mimetype.startsWith('image/')) throw new BadRequestException('Only image uploads are accepted');
      if (photo.size > MAX_PHOTO_BYTES) throw new BadRequestException('Photos must be 8 MB or smaller');
    }
    const authorName = input.authorName?.trim() || access.invitation?.guestName || access.member?.label || 'A Guest';
    if (matcher.hasMatch(authorName)) throw new BadRequestException({ code: 'INAPPROPRIATE_CONTENT', message: 'Please use your real name' });

    const stored = photo ? await this.storage.put(`blessing-${access.wedding.id.slice(0, 8)}`, photo.buffer, photo.mimetype) : null;
    const status: ModerationStatus = stored ? 'PENDING' : 'APPROVED';
    const blessing = await BlessingModel.create({
      weddingId: access.wedding._id,
      userId: access.user.id,
      authorName,
      message,
      photoKey: stored?.key ?? null,
      tableNumber: input.tableNumber?.trim() || null,
      status,
    });
    if (status === 'APPROVED') this.announce(blessing, access.wedding.stageDisplayMode);
    return this.view(blessing);
  }

  async list(weddingId: string, status: ModerationStatus = 'APPROVED', limit = 50, mode?: StageDisplayMode) {
    const rows = await BlessingModel.find({ weddingId, status })
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 200));
    return rows.map((b) => this.view(b, mode));
  }

  async moderate(access: WeddingAccess, id: string, status: ModerationStatus) {
    const existing = await BlessingModel.findOne({ _id: id, weddingId: access.wedding._id });
    if (!existing) throw new NotFoundException('Blessing not found');
    const blessing = await BlessingModel.findByIdAndUpdate(id, { $set: { status } }, { new: true });
    if (!blessing) throw new NotFoundException('Blessing not found');
    if (status === 'APPROVED' && existing.status !== 'APPROVED') this.announce(blessing, access.wedding.stageDisplayMode);
    return this.view(blessing);
  }

  private announce(b: BlessingDoc, mode: StageDisplayMode) {
    this.realtime.emit(rooms.wedding(b.weddingId.toString()), 'blessing.approved', this.view(b));
    if (mode !== 'PROGRESS_ONLY') this.realtime.emit(rooms.stage(b.weddingId.toString()), 'blessing.approved', this.view(b, mode));
  }
}
