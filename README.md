# PlotTheirFuture

Wedding microsites with a **fractional square-foot home registry**. Guests receive a WhatsApp
invitation, RSVP, and gift the couple square feet of their first home on a live floor plan. Every
gift gets a signed marriage-gift receipt (Income Tax Act Sec. 56(2)(x)). Gifts flow into an escrow
ledger that the couple can settle with platform compliance approval, and a live LED "stage screen"
celebrates gifts and blessings at the venue.

| Folder | Stack | What it is |
| --- | --- | --- |
| [`backend/`](backend) | NestJS 12, Prisma 7 + PostgreSQL, Redis + BullMQ, Socket.IO, Zod | REST API, auth, business logic, workers, realtime |
| [`frontend/web/`](frontend/web) | Next.js 16 (App Router), React 19, Tailwind CSS 4, TanStack Query | Guest microsite, checkout, receipts, host console, compliance desk, stage screen |
| [`frontend/mobile/`](frontend/mobile) | Flutter 3, Riverpod 3, dio, socket_io_client | Guest and host companion app (Android, iOS, web) |
| [`docs/`](docs) | — | Architecture, API reference, environment variables, deployment, original specifications |

## Features

- **Phone OTP sign-in**: WhatsApp, with MSG91 SMS as the fallback. Uses short-lived JWT access tokens and rotating refresh tokens.
- **Weddings and roles**:
  - The host (bride or groom) and co-host get full control.
  - Family leads manage their guest list and invitations.
  - Venue staff can moderate and run the stage.
  - Platform admins run the compliance desk.
- **Guest management**: cohorts, seat limits, per-ceremony invitations, CSV import and export, and family-lead attribution.
- **WhatsApp dispatch**: approved templates and per-guest magic links, sent through a BullMQ queue with live progress.
- **Ceremonies**: itinerary, maps, live streams, `.ics` calendar files, and automatic WhatsApp reminders two hours before each ceremony.
- **RSVP**: party size within the invitation limit, ceremony selection, dietary needs, travel, stay and shuttle details, a WhatsApp confirmation, a host summary and CSV export.
- **Square-foot registry**:
  - Rooms are made of tiles. Guests reserve tiles atomically, using a Redis lock plus `FOR UPDATE SKIP LOCKED` rows, with a configurable cart hold.
  - Payment is through Razorpay (UPI, cards, netbanking) with signature verification and webhooks, or a built-in mock provider for development.
  - Expired holds are released automatically, and late payments are flagged for refund.
- **Receipts**: an HMAC-signed receipt number, a PDF certificate, a public verification page, and delivery over WhatsApp.
- **Blessings**: text blessings pass a profanity filter and go live immediately. Photo blessings wait for a moderator. All appear on a live wall.
- **Finance**:
  - An escrow ledger with credit, debit and refund entries.
  - Settlements to a builder escrow or home loan account need two approvals: the host or co-host requests, the host approves, then a separate compliance officer approves and records the disbursement.
  - Contributions can be exported as CSV.
- **Live updates**: registry tiles, gifts, blessings, RSVPs and dispatch progress are pushed over Socket.IO, scaled across instances through Redis.
- **Stage screen**: a full-screen display with the floor-plan fill, celebration overlays, a blessing ticker and table QR codes.

## Quick start (Docker)

```bash
cp backend/.env.example backend/.env    # defaults work for local use
docker compose up --build -d
docker compose --profile tools run --rm seed   # optional demo data
```

- Web: <http://localhost:3000>
- API: <http://localhost:4000/api/v1>
- API docs (Swagger): <http://localhost:4000/api/docs>

## Quick start (local development)

Prerequisites: Node.js 22+, pnpm 10, PostgreSQL 16+, Redis 7+, and Flutter 3.50+ for the mobile app.

```bash
# 1. Infrastructure (or use your own Postgres/Redis)
docker compose up -d postgres redis

# 2. API
cd backend
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm db:seed            # demo wedding "sanvi-santosh"
pnpm start:dev          # http://localhost:4000

# 3. Web
cd ../frontend/web
cp .env.example .env.local
pnpm install
pnpm dev                # http://localhost:3000

# 4. Mobile (optional)
cd ../mobile
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:4000 --dart-define=WEB_URL=http://10.0.2.2:3000
```

### Demo accounts (after `pnpm db:seed`)

In development (`EXPOSE_DEV_OTP=1`), the one-time code is shown on the sign-in screen and printed
in the API log.

| Role | Phone |
| --- | --- |
| Host (bride) | `+919000000001` |
| Co-host (groom) | `+919000000002` |
| Family lead (`rao-family`) | `+919000000003` |
| Venue staff | `+919000000004` |
| Platform compliance admin | `+919000000099` |
| Guest (Ravi Teja) | `+919848012345` |

Open <http://localhost:3000/w/sanvi-santosh> as a guest, or <http://localhost:3000/admin> as a host.

## Tests and checks

```bash
cd backend && pnpm lint && pnpm test && pnpm test:e2e   # e2e needs Postgres + Redis (see docs/DEPLOYMENT.md)
cd frontend/web && pnpm lint && pnpm build
cd frontend/mobile && flutter analyze && flutter test
```

The same checks run in GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Documentation

- [Architecture](docs/ARCHITECTURE.md): components, data model, money flow, realtime, background jobs.
- [API reference](docs/API.md): every endpoint, its roles and the live events. An interactive version is served at `/api/docs`.
- [Environment variables](docs/ENVIRONMENT.md): backend, web and mobile configuration, plus WhatsApp template formats.
- [Deployment](docs/DEPLOYMENT.md): Docker Compose, containers, managed services, Razorpay and WhatsApp go-live checklist.
- [Original specifications](docs/specs): product PDFs and mockups.
