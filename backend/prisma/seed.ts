/**
 * Seeds the "Sanvi & Santosh" demo wedding from the product specification.
 * Re-running replaces the demo wedding (other weddings are untouched).
 *
 *   pnpm db:seed
 */
import '../src/load-env.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { hmacSha256, randomCode, sha256 } from '../src/common/utils/crypto.js';
import { PrismaClient, type GuestCohort } from '../src/generated/prisma/client.js';
import { canonicalReceipt } from '../src/receipts/canonical.js';
import { createRoomsAndTiles, DEFAULT_2BHK_ROOMS } from '../src/weddings/rooms.js';

const SLUG = 'sanvi-santosh';
const RATE_PAISE = 4500_00;
const SIGNING_SECRET = process.env.RECEIPT_SIGNING_SECRET;
if (!process.env.DATABASE_URL || !SIGNING_SECRET) throw new Error('DATABASE_URL and RECEIPT_SIGNING_SECRET must be set (see .env.example)');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

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

// Contributions that make up the spec's 420 SFT (35%) funded state.
const gifts = [
  { guest: 'Uncle Ramesh', room: 'living_room', units: 100, relationship: 'Uncle', blessing: 'May your home always be filled with laughter and festivals.' },
  { guest: 'Ravi Teja', room: 'living_room', units: 40, relationship: 'Cousin', blessing: 'Many happy morning chais in this living room!' },
  { guest: 'Meenakshi Iyer', room: 'master_bedroom', units: 120, relationship: 'Aunt', blessing: 'Wishing you a lifetime of love and sweet dreams.' },
  { guest: 'Arjun Nair', room: 'master_bedroom', units: 80, relationship: 'Family friend', blessing: null, anonymous: true },
  { guest: 'Anjali Sharma', room: 'balcony', units: 50, relationship: 'College friend', blessing: 'For endless sunset conversations!' },
  { guest: 'Priya Verma', room: 'balcony', units: 30, relationship: 'Friend', blessing: 'Grow a beautiful garden together.' },
];

async function main() {
  const existing = await prisma.wedding.findUnique({ where: { slug: SLUG } });
  if (existing) {
    await prisma.$transaction([
      prisma.ledgerEntry.deleteMany({ where: { weddingId: existing.id } }),
      prisma.floorTile.deleteMany({ where: { weddingId: existing.id } }),
      prisma.contribution.deleteMany({ where: { weddingId: existing.id } }),
      prisma.wedding.delete({ where: { id: existing.id } }),
    ]);
  }

  const users = Object.fromEntries(
    await Promise.all(
      Object.entries(people).map(async ([k, p]) => [
        k,
        await prisma.user.upsert({
          where: { phone: p.phone },
          create: { phone: p.phone, name: p.name, isPlatformAdmin: k === 'platform' },
          update: { name: p.name, ...(k === 'platform' ? { isPlatformAdmin: true } : {}) },
        }),
      ]),
    ),
  ) as Record<keyof typeof people, { id: string }>;

  const wedding = await prisma.wedding.create({
    data: {
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
      members: {
        create: [
          { userId: users.host.id, role: 'HOST', label: 'Bride' },
          { userId: users.coHost.id, role: 'CO_HOST', label: 'Groom' },
          { userId: users.lead.id, role: 'LEAD', label: 'rao-family' },
          { userId: users.venue.id, role: 'VENUE', label: 'Grand Palace' },
        ],
      },
    },
  });

  await prisma.$transaction((tx) => createRoomsAndTiles(tx, wedding.id, DEFAULT_2BHK_ROOMS), { timeout: 60_000 });

  const ceremonySpecs = [
    { key: 'haldi', title: 'Pellikuthuru & Haldi', startsAt: '2026-11-14T09:00:00', endsAt: '2026-11-14T12:00:00', venueName: 'Rao Residence', venueAddress: 'Jayanagar 4th Block, Bangalore', dressCode: 'Traditional Yellow', description: 'A joyful turmeric ceremony with close family.' },
    { key: 'sangeet', title: 'Mehendi & Sangeet Soiree', startsAt: '2026-11-14T18:30:00', endsAt: '2026-11-14T23:00:00', venueName: 'Grand Lotus Pavilion', venueAddress: 'Whitefield, Bangalore', dressCode: 'Indo-Western Festive', description: 'Henna, music, DJ and cocktails.' },
    { key: 'muhurtham', title: 'Sacred Wedding Muhurtham', startsAt: '2026-11-15T05:45:00', endsAt: '2026-11-15T09:00:00', venueName: 'Main Mandapam, Grand Palace', venueAddress: 'Palace Grounds, Bangalore', dressCode: 'Traditional Silk', description: 'The sacred wedding vows at the auspicious muhurtham.' },
    { key: 'reception', title: 'Grand Reception Gala', startsAt: '2026-11-15T19:00:00', endsAt: '2026-11-15T23:30:00', venueName: 'Crystal Grand Ballroom', venueAddress: 'Palace Grounds, Bangalore', dressCode: 'Black Tie / Royal Indian', description: 'An evening of celebration and a royal feast.' },
  ];
  const ceremonies: Record<string, string> = {};
  for (const [sortOrder, c] of ceremonySpecs.entries()) {
    const { key, startsAt, endsAt, ...rest } = c;
    const created = await prisma.ceremony.create({
      data: {
        ...rest,
        weddingId: wedding.id,
        startsAt: ist(startsAt),
        endsAt: ist(endsAt),
        sortOrder,
        venueMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(`${rest.venueName}, ${rest.venueAddress}`)}`,
      },
    });
    ceremonies[key] = created.id;
  }

  const invitations: Record<string, { id: string; phone: string; userId: string | null }> = {};
  for (const g of guests) {
    const user = await prisma.user.findUnique({ where: { phone: g.phone } });
    invitations[g.name] = await prisma.invitation.create({
      data: {
        weddingId: wedding.id,
        guestName: g.name,
        phone: g.phone,
        cohort: g.cohort,
        maxAttendees: g.seats,
        enableRegistry: g.registry ?? true,
        refLead: g.refLead ?? null,
        refToken: randomCode(12),
        userId: user?.id ?? null,
        ceremonies: { create: g.events.map((e) => ({ ceremonyId: ceremonies[e]! })) },
      },
    });
  }

  await prisma.rsvp.createMany({
    data: [
      { name: 'Uncle Ramesh', status: 'ATTENDING' as const, adults: 3, children: 1, ceremonyKeys: ['haldi', 'sangeet', 'muhurtham', 'reception'], dietary: ['VEG'], needsAccommodation: true },
      { name: 'Anjali Sharma', status: 'ATTENDING' as const, adults: 2, children: 0, ceremonyKeys: ['sangeet', 'reception'], dietary: ['NON_VEG'], needsAccommodation: false },
      { name: 'Kavya Reddy', status: 'DECLINED' as const, adults: 0, children: 0, ceremonyKeys: [], dietary: [], needsAccommodation: false },
      { name: 'Meenakshi Iyer', status: 'MAYBE' as const, adults: 2, children: 0, ceremonyKeys: ['muhurtham'], dietary: ['JAIN'], needsAccommodation: false },
    ].map((r) => ({
      weddingId: wedding.id,
      invitationId: invitations[r.name]!.id,
      status: r.status,
      adults: r.adults,
      children: r.children,
      attendingCeremonyIds: r.ceremonyKeys.map((k) => ceremonies[k]!),
      dietary: r.dietary,
      needsAccommodation: r.needsAccommodation,
    })),
  });

  const rooms = await prisma.roomZone.findMany({ where: { weddingId: wedding.id } });
  const roomByKey = new Map(rooms.map((r) => [r.key, r]));
  let paidAt = Date.now() - gifts.length * 3_600_000;
  for (const gift of gifts) {
    const room = roomByKey.get(gift.room)!;
    const inv = invitations[gift.guest]!;
    const tiles = await prisma.floorTile.findMany({
      where: { roomId: room.id, status: 'OPEN' },
      orderBy: { index: 'asc' },
      take: gift.units,
      select: { id: true },
    });
    const paid = new Date((paidAt += 3_600_000));
    const c = await prisma.contribution.create({
      data: {
        weddingId: wedding.id,
        userId: inv.userId,
        roomId: room.id,
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
      },
      include: { room: true },
    });
    const hash = sha256(canonicalReceipt(c));
    await prisma.$transaction([
      prisma.contribution.update({ where: { id: c.id }, data: { receiptHash: hash, receiptSignature: hmacSha256(SIGNING_SECRET!, hash) } }),
      prisma.floorTile.updateMany({ where: { id: { in: tiles.map((t) => t.id) } }, data: { status: 'FUNDED', contributionId: c.id, lockedUntil: null } }),
      prisma.ledgerEntry.create({ data: { weddingId: wedding.id, contributionId: c.id, type: 'CREDIT', amountPaise: c.amountPaise, reference: c.providerPaymentId! } }),
    ]);
  }

  await prisma.blessing.createMany({
    data: [
      { weddingId: wedding.id, authorName: 'Anjali Sharma', message: 'So happy for you both! Cannot wait to dance at the sangeet.', status: 'APPROVED', tableNumber: '4' },
      { weddingId: wedding.id, authorName: 'Ravi Teja', message: 'Wishing you a lifetime of love in your new home.', status: 'APPROVED', tableNumber: '2' },
      { weddingId: wedding.id, authorName: 'Uncle Ramesh', message: 'God bless the beautiful couple. Sukhi bhava!', status: 'APPROVED', tableNumber: '1' },
    ],
  });

  const funded = await prisma.floorTile.count({ where: { weddingId: wedding.id, status: 'FUNDED' } });
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
  .finally(() => prisma.$disconnect());
