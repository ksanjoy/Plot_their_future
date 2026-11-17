# Architecture

```
 Guests / hosts                         Venue LED screen
 ┌──────────────┐  ┌──────────────┐     ┌──────────────┐
 │ Next.js web  │  │ Flutter app  │     │ /stage/:slug │
 └──────┬───────┘  └──────┬───────┘     └──────┬───────┘
        │ REST /api/v1 + Socket.IO /live        │
        └──────────────┬────────────────────────┘
               ┌───────▼────────┐  webhooks   ┌───────────┐
               │  NestJS API    │◄────────────│ Razorpay  │
               │  (+ workers)   │────────────►│ Meta WA / │
               └──┬─────────┬───┘   messages  │ MSG91     │
                  │         │                 └───────────┘
          ┌───────▼──┐  ┌───▼─────┐      ┌───────────────┐
          │PostgreSQL│  │  Redis  │      │ Local disk/S3 │
          └──────────┘  └─────────┘      └───────────────┘
```

## Backend (`backend/`)

NestJS 12 as ESM, with one module per domain under `src/`:

| Module | Responsibility |
| --- | --- |
| `auth` | Phone OTP (hashed and peppered, with cooldowns and attempt limits), JWT access tokens, rotating refresh sessions with reuse detection |
| `access` | `WeddingAccessService`. Resolves the caller's role in a wedding from the database on every request (tenant isolation). |
| `weddings` | Wedding creation and settings, rooms and tiles, members, media, dashboard, public feed and invitation links |
| `ceremonies` | Itinerary, `.ics` export, reminder jobs |
| `guests` | Guest list (`Invitation`), CSV import and export, lead attribution |
| `dispatch` | WhatsApp invitation campaigns, sent through the `dispatch` queue with per-message status |
| `rsvp` | Guest RSVP within seat limits, summaries, CSV export |
| `registry` | Floor-plan state, tile locking, contributions, hold expiry, donor wall |
| `payments` | Pluggable provider (`mock` or `razorpay`), checkout, signature verification, webhooks (stored in `PaymentEvent` for idempotency) |
| `receipts` | Canonical receipt payload, HMAC signature, PDF rendering (pdfkit), public verification |
| `finance` | Escrow ledger and settlement workflow with dual control |
| `blessings` | Blessings with photo upload, profanity filter, moderation |
| `stage` | Stage-screen payload and QR codes |
| `notifications` | WhatsApp Cloud API and MSG91 drivers, with a console driver for development and a `NotificationLog` audit trail |
| `realtime` | Socket.IO gateway (`/live`), Redis adapter, and a Redis emitter for worker processes |
| `storage` | Local disk or S3-compatible object storage |
| `jobs` | BullMQ queue registration |
| `health` | Liveness, database and Redis checks |

Cross-cutting concerns:

- A global JWT guard, with `@Public()` opting a route out.
- Zod validation through `@Body({ schema })` and `@Param`/`@Query` schemas.
- A global exception filter that produces the `{ statusCode, code, message, errors }` envelope.
- Throttling, Helmet, CORS from `CORS_ORIGINS`, and a raw body for webhook signatures.

### Data model (Prisma, `prisma/schema.prisma`)

- **Users and sessions:** `User` (phone is unique, plus an `isPlatformAdmin` flag) and `Session` (hashed refresh token, family, rotation).
- **Weddings:**
  - `Wedding`: couple, property, rate per sq.ft. in paise, presets, cart hold TTL, escrow and RERA details, stage display mode.
  - `WeddingMember`: HOST, CO_HOST, LEAD (with a label) or VENUE.
- **Guests:**
  - `Ceremony`.
  - `Invitation`: one per phone per wedding, holding cohort, seat limit, registry visibility, `refToken` magic link and `refLead`.
  - `InvitationCeremony` and `Rsvp`.
- **Registry:**
  - `RoomZone` (key, name, sq.ft.).
  - `FloorTile`: one row per sq.ft., with status `OPEN`, `HOLD` (plus `lockedUntil`) or `SOLD`, linked to its contribution.
  - `Contribution`: `PENDING`, then `SUCCESS`, `FAILED`, `EXPIRED`, `CANCELLED` or `REFUND_REQUIRED`. It also stores the receipt number, hash and signature.
- **Money:** `LedgerEntry` (`CREDIT`, `DEBIT`, `REFUND`), `Settlement` (`REQUESTED` → `HOST_APPROVED` → `APPROVED` → `DISBURSED`, or `REJECTED`) and `PaymentEvent`.
- **Other:** `Blessing`, `Dispatch` with `DispatchMessage`, and `NotificationLog`.

### Gift lifecycle

1. **Lock.** The guest picks a room and a number of square feet, and `POST /registry/lock-tile` runs:
   - It takes a per-wedding Redis lock.
   - It selects `OPEN` tiles, or held tiles whose hold has expired, with `FOR UPDATE SKIP LOCKED`.
   - It marks them `HOLD` until `now + cartHoldTtlSec`.
   - It creates a `PENDING` contribution, with an order from the provider.
   - Each user can have at most 3 open holds.
2. **Pay.** The guest opens the signed `/pay/:id?t=` page, which uses Razorpay Checkout or the mock panel.
3. **Confirm.** Either the checkout signature (`/verify`) or the webhook confirms the payment. `confirmPaid` is idempotent:
   - Tiles become `SOLD`, the contribution becomes `SUCCESS`, and a `CREDIT` ledger entry is written.
   - The receipt number is signed.
   - The `receipts` job renders the PDF and sends it on WhatsApp.
   - Live events are emitted.
4. **Late payments.** If the payment lands after the hold expired and the tiles were re-sold, the contribution becomes `REFUND_REQUIRED` and is shown to admins.
5. **Expiry.** The `maintenance` queue runs every 15 seconds. It releases expired holds and marks pending contributions `EXPIRED`.

### Settlements

```
Host or co-host requests  →  Host approves  →  Compliance approves  →  Compliance disburses
   (REQUESTED)              (HOST_APPROVED)       (APPROVED)            (DISBURSED, DEBIT entry)
```

- A request cannot exceed the available balance: the escrow balance minus settlements still in progress.
- Compliance approval must come from someone other than the requester and the host approver.
- Any step before disbursement can reject the settlement, with a reason.

### Background jobs (BullMQ on Redis)

| Queue | Jobs |
| --- | --- |
| `dispatch` | One job per invitation message. Updates `DispatchMessage` and emits `dispatch.progress`. |
| `receipts` | Render the receipt PDF and send it on WhatsApp |
| `reminders` | Delayed job per ceremony, 2 hours before the start, sent to guests attending that ceremony |
| `maintenance` | Repeating `expire-holds` job every 15 seconds |

Jobs retry 5 times with exponential backoff. Workers run in the API process when `RUN_WORKERS=1`,
and the same image can run as dedicated workers (see [DEPLOYMENT.md](DEPLOYMENT.md)).

### Realtime

`/live` is a Socket.IO namespace authenticated with the access token. Clients `join` a wedding
channel (`wedding`, `admin` or `stage`) after a role check. The Redis adapter fans events out
across API replicas, and worker-only processes publish through `@socket.io/redis-emitter`.

## Web (`frontend/web/`)

- **Framework:** Next.js 16 App Router with `cacheComponents`. Pages are thin server components that render client views inside `<Suspense>`.
- **Data:** TanStack Query fetches through `src/lib/api.ts`. It is a typed `fetch` wrapper that adds the bearer token, refreshes once on a 401 with single-flight, and normalises errors.
- **Auth:** `src/lib/auth.tsx` keeps tokens in `localStorage` and exposes `useAuth()`. `RequireAuth` shows the OTP sign-in inline.
- **Live updates:** `src/lib/live.ts` provides a typed `useLive(slug, channel, handlers)` hook that patches the query cache.
- **Styling:** Tailwind CSS 4, with design tokens and utilities in `app/globals.css`.

| Route | Purpose |
| --- | --- |
| `/` | Landing page and celebrations feed |
| `/login` | OTP sign-in |
| `/w/[slug]` | Guest microsite (WhatsApp magic links add `?ref_token=`, which pre-fills sign-in): hero, countdown, itinerary, RSVP, floor-plan registry and gift sheet, your gifts, donor wall, blessings |
| `/pay/[id]` | Checkout (Razorpay or mock) with a hold countdown |
| `/thank-you/[id]` | Gift certificate and receipt PDF |
| `/verify`, `/verify/[receiptNumber]` | Public receipt verification |
| `/why-gift`, `/security` | Product explainer with the platform gifting notice, and the security FAQ |
| `/admin` | My weddings, and create a wedding (`/admin/new`) |
| `/admin/[slug]` | Host console. Tabs are filtered by role: overview, guests, ceremonies, dispatch, RSVPs, gifts, blessings, finance, stage, settings. |
| `/admin/compliance` | Platform compliance desk for settlements |
| `/stage/[slug]` | Full-screen LED stage display |

## Mobile (`frontend/mobile/`)

The Flutter app uses Riverpod 3 for state, dio with a token-refresh interceptor, tokens in
`flutter_secure_storage`, and `socket_io_client` for live updates.

- Guests get the invitation, RSVP, registry and gifting, blessings, and the live stage.
- Hosts and leads also get the dashboard, WhatsApp dispatch and the stage screen.
- Payment and receipt pages open in the browser on the web app, so the payment flow and its compliance live in one place.

See [`frontend/mobile/README.md`](../frontend/mobile/README.md).
