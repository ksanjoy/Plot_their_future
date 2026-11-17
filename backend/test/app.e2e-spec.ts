import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { LinkTokenService } from '../src/auth/link-token.service.js';
import { ENV, type Env } from '../src/config/config.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RedisService } from '../src/redis/redis.service.js';
import { RegistryService } from '../src/registry/registry.service.js';

const SLUG = 'e2e-aarav-meera';
const HOST = '+919000001001';
const GUEST = '+919848099001';
const OUTSIDER = '+919848099002';
const PLATFORM = '+919000000099';

let app: NestExpressApplication;
let prisma: PrismaService;
let http: ReturnType<typeof request>;

async function login(phone: string) {
  const otp = await http.post('/api/v1/auth/request-otp').send({ phone }).expect(200);
  expect(otp.body.devOtp).toMatch(/^\d{6}$/);
  const res = await http.post('/api/v1/auth/verify-otp').send({ phone, otp: otp.body.devOtp }).expect(200);
  return res.body as { accessToken: string; refreshToken: string; user: { id: string; isPlatformAdmin: boolean } };
}

const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

async function waitFor<T>(fn: () => Promise<T | null | undefined>, timeoutMs = 10_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > until) throw new Error('Timed out waiting for condition');
    await new Promise((r) => setTimeout(r, 100));
  }
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true, logger: ['error'] });
  configureApp(app, app.get<Env>(ENV));
  await app.init();
  prisma = app.get(PrismaService);
  await app.get(RedisService).client.flushdb();
  await prisma.$executeRawUnsafe(
    'TRUNCATE "LedgerEntry","FloorTile","Contribution","Settlement","Wedding","Session","User","NotificationLog","PaymentEvent" CASCADE',
  );
  http = request(app.getHttpServer());
});

afterAll(async () => {
  await app?.close();
});

describe('Plot Their Future API (e2e)', () => {
  let host: Awaited<ReturnType<typeof login>>;
  let guest: Awaited<ReturnType<typeof login>>;
  const ceremonyIds: string[] = [];

  it('reports health', async () => {
    const res = await http.get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up', redis: 'up' });
  });

  describe('auth', () => {
    it('rejects a wrong OTP and enforces the resend cooldown', async () => {
      await http.post('/api/v1/auth/request-otp').send({ phone: '98480 99009' }).expect(200);
      await http.post('/api/v1/auth/request-otp').send({ phone: '+919848099009' }).expect(429);
      const bad = await http.post('/api/v1/auth/verify-otp').send({ phone: '+919848099009', otp: '000000' });
      expect([400, 429]).toContain(bad.status);
    });

    it('validates input', async () => {
      const res = await http.post('/api/v1/auth/request-otp').send({ phone: 'nope' }).expect(400);
      expect(res.body.code).toBeDefined();
    });

    it('rotates refresh tokens and detects reuse', async () => {
      const s = await login(HOST);
      const rotated = await http.post('/api/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(200);
      expect(rotated.body.refreshToken).not.toBe(s.refreshToken);
      await http.post('/api/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(401);
      // Reuse revokes the whole family, including the rotated token.
      await http.post('/api/v1/auth/refresh').send({ refreshToken: rotated.body.refreshToken }).expect(401);
    });

    it('requires a token on protected routes', async () => {
      await http.get('/api/v1/auth/me').expect(401);
      await http.get('/api/v1/auth/me').set(bearer('garbage')).expect(401);
    });
  });

  describe('wedding setup (host)', () => {
    it('creates a wedding with a 2 BHK floor plan', async () => {
      await app.get(RedisService).client.del(`otp:cool:${HOST}`);
      host = await login(HOST);
      const res = await http
        .post('/api/v1/weddings')
        .set(bearer(host.accessToken))
        .send({ slug: SLUG, brideName: 'Meera', groomName: 'Aarav', ratePerSft: 4500, presetTiers: [1, 5, 10], weddingDate: '2027-02-14T05:45:00+05:30' })
        .expect(201);
      expect(res.body.slug).toBe(SLUG);
      expect(await prisma.floorTile.count({ where: { wedding: { slug: SLUG } } })).toBe(1200);
    });

    it('adds ceremonies and guests', async () => {
      for (const [title, at] of [
        ['Sangeet', '2027-02-13T18:30:00+05:30'],
        ['Muhurtham', '2027-02-14T05:45:00+05:30'],
      ] as const) {
        const c = await http
          .post(`/api/v1/weddings/${SLUG}/ceremonies`)
          .set(bearer(host.accessToken))
          .send({ title, startsAt: at, venueName: 'Grand Palace' })
          .expect(201);
        ceremonyIds.push(c.body.id);
      }
      const g = await http
        .post(`/api/v1/weddings/${SLUG}/guests`)
        .set(bearer(host.accessToken))
        .send({ guestName: 'Ravi', phone: GUEST, cohort: 'FRIENDS', maxAttendees: 2, ceremonyIds: [ceremonyIds[1]] })
        .expect(201);
      expect(g.body.inviteLink).toContain(`/w/${SLUG}?ref_token=`);

      const csv = 'guest_name,phone_whatsapp,guest_category,invited_events,max_attendees\nAsha,9876500011,Family,Sangeet|Muhurtham,3\nBroken,12,Family,,2\n';
      const imp = await http
        .post(`/api/v1/weddings/${SLUG}/guests/import`)
        .set(bearer(host.accessToken))
        .attach('file', Buffer.from(csv), 'guests.csv')
        .expect(201);
      expect(imp.body).toMatchObject({ created: 1, updated: 0 });
      expect(imp.body.errors).toHaveLength(1);
    });

    it('keeps the microsite private to the roster', async () => {
      const outsider = await login(OUTSIDER);
      const res = await http.get(`/api/v1/weddings/${SLUG}`).set(bearer(outsider.accessToken)).expect(403);
      expect(res.body.code).toBe('NOT_INVITED');
      const feed = await http.get('/api/v1/public/weddings').expect(200);
      const entry = feed.body.find((w: { slug?: string; unlocked: boolean }) => w.unlocked === false);
      expect(entry).toBeDefined();
      expect(JSON.stringify(feed.body)).not.toContain('Meera');
    });

    it('queues a WhatsApp dispatch that the worker delivers', async () => {
      const d = await http.post(`/api/v1/weddings/${SLUG}/dispatches`).set(bearer(host.accessToken)).send({ includeRegistry: true }).expect(201);
      expect(d.body.total).toBe(2);
      await waitFor(async () => {
        const s = await http.get(`/api/v1/weddings/${SLUG}/dispatches/${d.body.id}`).set(bearer(host.accessToken));
        return s.body.sent === 2 ? s.body : null;
      });
    });
  });

  describe('guest journey', () => {
    it('opens the microsite with only invited ceremonies', async () => {
      guest = await login(GUEST);
      const res = await http.get(`/api/v1/weddings/${SLUG}`).set(bearer(guest.accessToken)).expect(200);
      expect(res.body.role).toBe('GUEST');
      expect(res.body.ceremonies.map((c: { id: string }) => c.id)).toEqual([ceremonyIds[1]]);
    });

    it('enforces seat limits and invited ceremonies on RSVP', async () => {
      await http
        .put(`/api/v1/weddings/${SLUG}/rsvp/me`)
        .set(bearer(guest.accessToken))
        .send({ status: 'ATTENDING', adults: 3, attendingCeremonyIds: [ceremonyIds[1]] })
        .expect(400);
      await http
        .put(`/api/v1/weddings/${SLUG}/rsvp/me`)
        .set(bearer(guest.accessToken))
        .send({ status: 'ATTENDING', adults: 1, attendingCeremonyIds: [ceremonyIds[0]] })
        .expect(400);
      const ok = await http
        .put(`/api/v1/weddings/${SLUG}/rsvp/me`)
        .set(bearer(guest.accessToken))
        .send({ status: 'ATTENDING', adults: 1, children: 1, attendingCeremonyIds: [ceremonyIds[1]], dietary: ['VEG'] })
        .expect(200);
      expect(ok.body.status).toBe('ATTENDING');
      const summary = await http.get(`/api/v1/weddings/${SLUG}/rsvps/summary`).set(bearer(host.accessToken)).expect(200);
      expect(summary.body).toMatchObject({ invited: 2, responded: 1, attending: 1, headcount: { adults: 1, children: 1 } });
    });

    it('gifts square feet end to end: hold, pay, receipt, verify', async () => {
      const lock = await http
        .post('/api/v1/registry/lock-tile')
        .set(bearer(guest.accessToken))
        .send({ slug: SLUG, roomKey: 'balcony', units: 10, donorName: 'Ravi', blessing: 'Happy home!' })
        .expect(201);
      const id = lock.body.contribution.id as string;
      const t = new URL(lock.body.links.checkoutUrl).searchParams.get('t')!;

      const state = await http.get(`/api/v1/weddings/${SLUG}/registry`).set(bearer(guest.accessToken)).expect(200);
      expect(state.body.heldSft).toBe(10);

      expect([400, 401]).toContain((await http.get(`/api/v1/payments/checkout/${id}?t=bad`)).status);
      const receiptToken = app.get(LinkTokenService).sign(id, 'receipt', 60);
      await http.get(`/api/v1/payments/checkout/${id}?t=${receiptToken}`).expect(403);
      const checkout = await http.get(`/api/v1/payments/checkout/${id}?t=${t}`).expect(200);
      expect(checkout.body.amountPaise).toBe(10 * 4500 * 100);

      await http.post(`/api/v1/payments/mock/${id}/complete?t=${t}`).send({ outcome: 'success' }).expect(200);
      // Idempotent: a second confirmation does not double-credit.
      await http.post(`/api/v1/payments/mock/${id}/complete?t=${t}`).send({ outcome: 'success' }).expect(200);

      const sealed = await waitFor(async () => {
        const c = await prisma.contribution.findUnique({ where: { id } });
        return c?.receiptHash ? c : null;
      });
      expect(sealed.status).toBe('SUCCESS');
      expect(await prisma.ledgerEntry.count({ where: { contributionId: id } })).toBe(1);

      const verify = await http.get(`/api/v1/receipts/verify/${sealed.receiptNumber}`).expect(200);
      expect(verify.body).toMatchObject({ valid: true, units: 10, room: 'Balcony' });

      const pdf = await http.get(`/api/v1/receipts/${id}/pdf`).set(bearer(guest.accessToken)).expect(200);
      expect(pdf.headers['content-type']).toContain('application/pdf');
      await http.get(`/api/v1/receipts/${id}/pdf`).expect(404);

      const after = await http.get(`/api/v1/weddings/${SLUG}/registry`).set(bearer(guest.accessToken)).expect(200);
      expect(after.body).toMatchObject({ fundedSft: 10, heldSft: 0 });
    });

    it('refuses to oversell a room', async () => {
      const res = await http
        .post('/api/v1/registry/lock-tile')
        .set(bearer(guest.accessToken))
        .send({ slug: SLUG, roomKey: 'balcony', units: 71 })
        .expect(409);
      expect(res.body).toMatchObject({ code: 'INSUFFICIENT_SFT', available: 70 });
    });

    it('never sells the same square foot twice under concurrency', async () => {
      const attempts = await Promise.all(
        Array.from({ length: 3 }, () =>
          http.post('/api/v1/registry/lock-tile').set(bearer(guest.accessToken)).send({ slug: SLUG, roomKey: 'balcony', units: 30 }),
        ),
      );
      const statuses = attempts.map((a) => a.status).sort((a, b) => a - b);
      expect(statuses).toEqual([201, 201, 409]);
      const held = await prisma.floorTile.count({ where: { wedding: { slug: SLUG }, room: { key: 'balcony' }, status: 'HOLD' } });
      expect(held).toBe(60);
      for (const a of attempts.filter((x) => x.status === 201)) {
        await http.delete(`/api/v1/registry/contributions/${a.body.contribution.id}`).set(bearer(guest.accessToken)).expect(204);
      }
    });

    it('releases lapsed holds and blocks their checkout', async () => {
      const lock = await http
        .post('/api/v1/registry/lock-tile')
        .set(bearer(guest.accessToken))
        .send({ slug: SLUG, roomKey: 'kitchen', units: 5 })
        .expect(201);
      const id = lock.body.contribution.id as string;
      const t = new URL(lock.body.links.checkoutUrl).searchParams.get('t')!;
      const past = new Date(Date.now() - 1000);
      await prisma.contribution.update({ where: { id }, data: { holdExpiresAt: past } });
      await prisma.floorTile.updateMany({ where: { contributionId: id }, data: { lockedUntil: past } });

      const result = await app.get(RegistryService).expireHolds();
      expect(result.releasedTiles).toBeGreaterThanOrEqual(5);
      expect((await prisma.contribution.findUniqueOrThrow({ where: { id } })).status).toBe('EXPIRED');
      const res = await http.get(`/api/v1/payments/checkout/${id}?t=${t}`).expect(410);
      expect(res.body.code).toBe('HOLD_EXPIRED');
    });

    it('auto-approves clean text blessings and rejects profanity', async () => {
      const ok = await http.post(`/api/v1/weddings/${SLUG}/blessings`).set(bearer(guest.accessToken)).send({ message: 'Congratulations!' }).expect(201);
      expect(ok.body.status).toBe('APPROVED');
      const bad = await http.post(`/api/v1/weddings/${SLUG}/blessings`).set(bearer(guest.accessToken)).send({ message: 'you are a fucking idiot' }).expect(400);
      expect(bad.body.code).toBe('INAPPROPRIATE_CONTENT');
    });

    it('stops guests from reaching host-only routes', async () => {
      await http.get(`/api/v1/weddings/${SLUG}/guests`).set(bearer(guest.accessToken)).expect(403);
      await http.get(`/api/v1/weddings/${SLUG}/ledger`).set(bearer(guest.accessToken)).expect(403);
      await http.patch(`/api/v1/weddings/${SLUG}`).set(bearer(guest.accessToken)).send({ city: 'Hacked' }).expect(403);
    });
  });

  describe('escrow settlement (dual control)', () => {
    it('requires host then a different platform approver before disbursal', async () => {
      const ledger = await http.get(`/api/v1/weddings/${SLUG}/ledger`).set(bearer(host.accessToken)).expect(200);
      expect(ledger.body.balances.availablePaise).toBe(10 * 4500 * 100);

      await http
        .post(`/api/v1/weddings/${SLUG}/settlements`)
        .set(bearer(host.accessToken))
        .send({ amount: 50_000, destination: 'HOME_LOAN', beneficiaryName: 'HDFC Home Loans', accountNumber: '123456789012', ifsc: 'HDFC0001234' })
        .expect(400);

      const s = await http
        .post(`/api/v1/weddings/${SLUG}/settlements`)
        .set(bearer(host.accessToken))
        .send({ amount: 30_000, destination: 'HOME_LOAN', beneficiaryName: 'HDFC Home Loans', accountNumber: '123456789012', ifsc: 'hdfc0001234' })
        .expect(201);
      expect(s.body.accountNumber).toBe('••••••••9012');

      const platform = await login(PLATFORM);
      expect(platform.user.isPlatformAdmin).toBe(true);
      await http.post(`/api/v1/admin/settlements/${s.body.id}/approve`).set(bearer(platform.accessToken)).expect(409);
      await http.post(`/api/v1/weddings/${SLUG}/settlements/${s.body.id}/approve`).set(bearer(host.accessToken)).expect(201);
      await http.post(`/api/v1/admin/settlements/${s.body.id}/approve`).set(bearer(host.accessToken)).expect(403);
      await http.post(`/api/v1/admin/settlements/${s.body.id}/approve`).set(bearer(platform.accessToken)).expect(201);
      const done = await http
        .post(`/api/v1/admin/settlements/${s.body.id}/disburse`)
        .set(bearer(platform.accessToken))
        .send({ bankReference: 'UTR998877' })
        .expect(201);
      expect(done.body.status).toBe('DISBURSED');

      const after = await http.get(`/api/v1/weddings/${SLUG}/ledger`).set(bearer(host.accessToken)).expect(200);
      expect(after.body.balances).toMatchObject({ debitsPaise: 30_000_00, availablePaise: 15_000_00 });
    });
  });
});
