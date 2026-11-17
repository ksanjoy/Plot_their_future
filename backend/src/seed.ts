/**
 * Seeds the "Sanvi & Santosh" demo wedding from the product specification.
 * Re-running replaces the demo wedding (other weddings are untouched).
 *
 *   pnpm db:seed
 */
import './load-env.js';
import mongoose from 'mongoose';
import { hmacSha256, randomCode, sha256 } from './common/utils/crypto.js';
import { validateEnv } from './config/env.js';
import { deleteWeddingCascade } from './models/cascades.js';
import {
  BlessingModel,
  CeremonyModel,
  ContributionModel,
  FloorTileModel,
  InvitationCeremonyModel,
  InvitationModel,
  LedgerEntryModel,
  RoomZoneModel,
  RsvpModel,
  UserModel,
  WeddingMemberModel,
  WeddingModel,
} from './models/schemas.js';
import type { GuestCohort } from './models/types.js';
import { canonicalReceipt } from './receipts/canonical.js';
import { createRoomsAndTiles, DEFAULT_2BHK_ROOMS } from './weddings/rooms.js';
import { withTransaction } from './database/helpers.js';

const SLUG = 'sanvi-santosh';
const RATE_PAISE = 4500_00;
const env = validateEnv(process.env);
const SIGNING_SECRET = env.RECEIPT_SIGNING_SECRET;

const ist = (iso: string) => new Date(`${iso}+05:30`);

const people = {
  host: { phone: '+919000000001', name: 'Sanvi Rao' },
  coHost: { phone: '+919000000002', name: 'Santosh Kumar' },
  lead: { phone: '+919000000003', name: 'Lakshmi Rao' },
  venue: { phone: '+919000000004', name: 'Grand Palace Events' },
  platform: { phone: '+919000000099', name: 'PTF Compliance' },
};

const guests: { name: string; phone: string; cohort: GuestCohort; seats: number; events: string[]; registry?: boolean; refLead?: string }[] = [
  { name: 'Ravi Teja', phone: '+919848012345', cohort: 'FAMILY', seats: 3, events: ['haldi', 'sangeet', 'muhurtham', 'reception'] },
  { name: 'Anjali Sharma', phone: '+919811122233', cohort: 'FRIENDS', seats: 2, events: ['sangeet', 'muhurtham', 'reception'] },
  { name: 'Priya Verma', phone: '+919822233344', cohort: 'FRIENDS', seats: 2, events: ['sangeet', 'reception'] },
  { name: 'Uncle Ramesh', phone: '+919833344455', cohort: 'CLOSE_FAMILY', seats: 4, events: ['haldi', 'sangeet', 'muhurtham', 'reception'], refLead: 'rao-family' },
  { name: 'Kavya Reddy', phone: '+919844455566', cohort: 'COLLEAGUES', seats: 1, events: ['reception'], registry: false },
  { name: 'Meenakshi Iyer', phone: '+919855566677', cohort: 'CLOSE_FAMILY', seats: 2, events: ['haldi', 'muhurtham', 'reception'], refLead: 'rao-family' },
  { name: 'Arjun Nair', phone: '+919866677788', cohort: 'VIP', seats: 2, events: ['muhurtham', 'reception'] },
  { name: 'Sneha Patil', phone: '+919877788899', cohort: 'FRIENDS', seats: 2, events: ['sangeet', 'reception'] },
];

const gifts: { guest: string; room: string; units: number; relationship: string; blessing: string | null; anonymous?: boolean }[] = [
  { guest: 'Uncle Ramesh', room: 'living_room', units: 100, relationship: 'Uncle', blessing: 'May your home always be filled with laughter and festivals.' },
  { guest: 'Ravi Teja', room: 'living_room', units: 40, relationship: 'Cousin', blessing: 'Many happy morning chais in this living room!' },
  { guest: 'Meenakshi Iyer', room: 'master_bedroom', units: 120, relationship: 'Aunt', blessing: 'Wishing you a lifetime of love and sweet dreams.' },
  { guest: 'Arjun Nair', room: 'master_bedroom', units: 80, relationship: 'Family friend', blessing: null, anonymous: true },
  { guest: 'Anjali Sharma', room: 'balcony', units: 50, relationship: 'College friend', blessing: 'For endless sunset conversations!' },
  { guest: 'Priya Verma', room: 'balcony', units: 30, relationship: 'Friend', blessing: 'Grow a beautiful garden together.' },
];

async function main() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  const existing = await WeddingModel.findOne({ slug: SLUG });
  if (existing) await deleteWeddingCascade(existing.id);

  const users = Object.fromEntries(
    await Promise.all(
      Object.entries(people).map(async ([k, p]) => {
        const user = await UserModel.findOneAndUpdate(
          { phone: p.phone },
          {
            $set: { name: p.name, ...(k === 'platform' ? { isPlatformAdmin: true } : {}) },
            $setOnInsert: { phone: p.phone, ...(k === 'platform' ? {} : { isPlatformAdmin: false }) },
          },
          { upsert: true, new: true },
        );
        return [k, user];
      }),
    ),
  ) as Record<keyof typeof people, { id: string; _id: unknown }>;

  const wedding = await WeddingModel.create({
    slug: SLUG,
    brideName: 'Sanvi Rao',
    groomName: 'Santosh Kumar',
    welcomeNote:
      'Skip the boxed gifts, gift a square foot! Help us build our first home, one square foot at a time. Every square foot you gift is held in a RERA escrow account and goes straight into our 2 BHK.',
    city: 'Bangalore',
    weddingDate: ist('2026-11-15T05:45:00'),
    propertyName: 'The 2 BHK Dream Apartment • Unit 402, Skyline Meadows',
    propertyLocation: 'Silicon Valley, Bangalore',
    totalSft: 1200,
    ratePerSftPaise: RATE_PAISE,
    presetTiers: [1, 5, 10, 25, 50],
    reraRegId: 'P02400003891',
    escrowBankName: 'HDFC Bank • RBI Tripartite Escrow',
    escrowAccountNumber: '50200012345678',
    escrowIfsc: 'HDFC0001234',
  });
  await WeddingMemberModel.insertMany([
    { weddingId: wedding._id, userId: users.host._id, role: 'HOST', label: 'Bride' },
    { weddingId: wedding._id, userId: users.coHost._id, role: 'CO_HOST', label: 'Groom' },
    { weddingId: wedding._id, userId: users.lead._id, role: 'LEAD', label: 'rao-family' },
    { weddingId: wedding._id, userId: users.venue._id, role: 'VENUE', label: 'Grand Palace' },
  ]);

  await withTransaction((session) => createRoomsAndTiles(session, wedding.id, DEFAULT_2BHK_ROOMS));

  const ceremonySpecs = [
    { key: 'haldi', title: 'Pellikuthuru & Haldi', startsAt: '2026-11-14T09:00:00', endsAt: '2026-11-14T12:00:00', venueName: 'Rao Residence', venueAddress: 'Jayanagar 4th Block, Bangalore', dressCode: 'Traditional Yellow', description: 'A joyful turmeric ceremony with close family.' },
    { key: 'sangeet', title: 'Mehendi & Sangeet Soiree', startsAt: '2026-11-14T18:30:00', endsAt: '2026-11-14T23:00:00', venueName: 'Grand Lotus Pavilion', venueAddress: 'Whitefield, Bangalore', dressCode: 'Indo-Western Festive', description: 'Henna, music, DJ and cocktails.' },
    { key: 'muhurtham', title: 'Sacred Wedding Muhurtham', startsAt: '2026-11-15T05:45:00', endsAt: '2026-11-15T09:00:00', venueName: 'Main Mandapam, Grand Palace', venueAddress: 'Palace Grounds, Bangalore', dressCode: 'Traditional Silk', description: 'The sacred wedding vows at the auspicious muhurtham.' },
    { key: 'reception', title: 'Grand Reception Gala', startsAt: '2026-11-15T19:00:00', endsAt: '2026-11-15T23:30:00', venueName: 'Crystal Grand Ballroom', venueAddress: 'Palace Grounds, Bangalore', dressCode: 'Black Tie / Royal Indian', description: 'An evening of celebration and a royal feast.' },
  ];
  const ceremonies: Record<string, string> = {};
  for (const [sortOrder, c] of ceremonySpecs.entries()) {
    const { key, startsAt, endsAt, ...rest } = c;
    const created = await CeremonyModel.create({
      ...rest,
      weddingId: wedding._id,
      startsAt: ist(startsAt),
      endsAt: ist(endsAt),
      sortOrder,
      venueMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(`${rest.venueName}, ${rest.venueAddress}`)}`,
    });
    ceremonies[key] = created.id;
  }

  const invitations: Record<string, { id: string; _id: unknown; phone: string; userId: unknown }> = {};
  for (const g of guests) {
    const user = await UserModel.findOne({ phone: g.phone });
    const created = await InvitationModel.create({
      weddingId: wedding._id,
      guestName: g.name,
      phone: g.phone,
      cohort: g.cohort,
      maxAttendees: g.seats,
      enableRegistry: g.registry ?? true,
      refLead: g.refLead ?? null,
      refToken: randomCode(12),
      userId: user?._id ?? null,
    });
    if (g.events.length) {
      await InvitationCeremonyModel.insertMany(g.events.map((event) => ({ invitationId: created._id, ceremonyId: ceremonies[event] })));
    }
    invitations[g.name] = created;
  }

  await RsvpModel.insertMany(
    [
      { name: 'Uncle Ramesh', status: 'ATTENDING' as const, adults: 3, children: 1, ceremonyKeys: ['haldi', 'sangeet', 'muhurtham', 'reception'], dietary: ['VEG'], needsAccommodation: true },
      { name: 'Anjali Sharma', status: 'ATTENDING' as const, adults: 2, children: 0, ceremonyKeys: ['sangeet', 'reception'], dietary: ['NON_VEG'], needsAccommodation: false },
      { name: 'Kavya Reddy', status: 'DECLINED' as const, adults: 0, children: 0, ceremonyKeys: [], dietary: [], needsAccommodation: false },
      { name: 'Meenakshi Iyer', status: 'MAYBE' as const, adults: 2, children: 0, ceremonyKeys: ['muhurtham'], dietary: ['JAIN'], needsAccommodation: false },
    ].map((r) => ({
      weddingId: wedding._id,
      invitationId: invitations[r.name]!._id,
      status: r.status,
      adults: r.adults,
      children: r.children,
      attendingCeremonyIds: r.ceremonyKeys.map((k) => ceremonies[k]!),
      dietary: r.dietary,
      needsAccommodation: r.needsAccommodation,
    })),
  );

  const rooms = await RoomZoneModel.find({ weddingId: wedding._id });
  const roomByKey = new Map(rooms.map((r) => [r.key, r]));
  let paidAt = Date.now() - gifts.length * 3_600_000;
  for (const gift of gifts) {
    const room = roomByKey.get(gift.room)!;
    const inv = invitations[gift.guest]!;
    const tiles = await FloorTileModel.find({ roomId: room._id, status: 'OPEN' }).sort({ index: 1 }).limit(gift.units).select('_id');
    const paid = new Date((paidAt += 3_600_000));
    const c = await ContributionModel.create({
      weddingId: wedding._id,
      userId: inv.userId,
      roomId: room._id,
      units: gift.units,
      ratePaise: RATE_PAISE,
      amountPaise: gift.units * RATE_PAISE,
      donorName: gift.guest,
      donorPhone: inv.phone,
      relationship: gift.relationship,
      blessing: gift.blessing,
      anonymous: gift.anonymous ?? false,
      status: 'SUCCESS',
      provider: 'mock',
      providerOrderId: `seed_order_${randomCode(10)}`,
      providerPaymentId: `seed_pay_${randomCode(10)}`,
      holdExpiresAt: paid,
      paidAt: paid,
      receiptNumber: `PTF-${paid.getFullYear()}-${randomCode(8).toUpperCase()}`,
    });
    const hash = sha256(
      canonicalReceipt({
        id: c.id,
        receiptNumber: c.receiptNumber,
        weddingId: c.weddingId,
        donorName: c.donorName,
        units: c.units,
        ratePaise: c.ratePaise,
        amountPaise: c.amountPaise,
        room: { key: room.key },
        paidAt: c.paidAt,
        providerPaymentId: c.providerPaymentId,
      }),
    );
    await withTransaction(async (session) => {
      await ContributionModel.updateOne(
        { _id: c._id },
        { $set: { receiptHash: hash, receiptSignature: hmacSha256(SIGNING_SECRET, hash) } },
        { session },
      );
      await FloorTileModel.updateMany(
        { _id: { $in: tiles.map((t) => t._id) } },
        { $set: { status: 'FUNDED', contributionId: c._id, lockedUntil: null } },
        { session },
      );
      await LedgerEntryModel.create(
        [{ weddingId: wedding._id, contributionId: c._id, type: 'CREDIT', amountPaise: c.amountPaise, reference: c.providerPaymentId! }],
        { session },
      );
    });
  }

  await BlessingModel.insertMany([
    { weddingId: wedding._id, authorName: 'Anjali Sharma', message: 'So happy for you both! Cannot wait to dance at the sangeet.', status: 'APPROVED', tableNumber: '4' },
    { weddingId: wedding._id, authorName: 'Ravi Teja', message: 'Wishing you a lifetime of love in your new home.', status: 'APPROVED', tableNumber: '2' },
    { weddingId: wedding._id, authorName: 'Uncle Ramesh', message: 'God bless the beautiful couple. Sukhi bhava!', status: 'APPROVED', tableNumber: '1' },
  ]);

  const funded = await FloorTileModel.countDocuments({ weddingId: wedding._id, status: 'FUNDED' });
  console.log(`Seeded wedding "${SLUG}" with ${funded}/1200 SFT funded.`);
  console.log('Sign in with any of these numbers (OTP is printed by the API when EXPOSE_DEV_OTP=1):');
  console.log(`  Host (bride)     ${people.host.phone}`);
  console.log(`  Co-host (groom)  ${people.coHost.phone}`);
  console.log(`  Family lead      ${people.lead.phone}  (label rao-family)`);
  console.log(`  Venue / stage    ${people.venue.phone}`);
  console.log(`  Platform admin   ${people.platform.phone}  (must be listed in PLATFORM_ADMIN_PHONES)`);
  console.log(`  Guest            ${guests[0]!.phone}  (${guests[0]!.name})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
