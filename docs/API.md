# API reference

- **Base URL:** `{API_PUBLIC_URL}/api/v1`, for example `http://localhost:5000/api/v1`.
- **Interactive docs:** OpenAPI 3 at `/api/docs`, with the JSON spec at `/api/docs-json`. These list every field of every request body.

Request bodies, query strings and route parameters are validated with Zod. Monetary amounts are
integer **paise** (₹1 = 100 paise), except where a field says rupees.

## Conventions

### Authentication

Send `Authorization: Bearer <accessToken>`. Access tokens are JWTs that expire after
`JWT_ACCESS_TTL_SEC` (15 minutes by default). Refresh them with `POST /auth/refresh`. Refresh
tokens are opaque, single use and rotated on every refresh. Reusing a revoked refresh token
revokes the whole session family.

### Signed links (`?t=`)

Checkout and receipt links contain an HMAC token (`JWT_LINK_SECRET`) tied to one contribution.
These links work without a session, so a guest can pay or download a receipt straight from
WhatsApp.

### Errors

Every error uses the same JSON envelope:

```json
{ "statusCode": 400, "code": "VALIDATION_FAILED", "message": "phone: Too small…", "errors": [{ "path": "phone", "message": "…" }] }
```

`code` is present on domain errors and is stable:

- Validation and phone numbers: `VALIDATION_FAILED`, `INVALID_PHONE`.
- Access: `NOT_INVITED`, `NOT_INVITED_TO_CEREMONY`, `FORBIDDEN_ROLE`.
- OTP: `OTP_COOLDOWN`, `OTP_LIMIT`, `OTP_INVALID`, `OTP_EXPIRED`, `OTP_LOCKED`.
- Weddings: `SLUG_TAKEN`, `REGISTRY_LOCKED`, `REGISTRY_DISABLED`.
- Gifting: `INSUFFICIENT_SFT`, `TOO_MANY_HOLDS`, `HOLD_EXPIRED`.
- Guests, RSVP and dispatch: `SEAT_LIMIT`, `NO_RECIPIENTS`.
- Blessings: `INAPPROPRIATE_CONTENT`.
- Finance: `INSUFFICIENT_FUNDS`, `DUAL_CONTROL`, `INVALID_STATE`.

### Rate limits

Every route has a global throttle. OTP requests are limited to 5 per minute and OTP
verification to 10 per minute, on top of the per-phone cooldown and attempt limits.

### Roles

Role is derived from the database on every request, never from token claims.

| Role | How you get it |
| --- | --- |
| `HOST`, `CO_HOST` | Wedding creator, or added as a member. These two are the **admin** roles. |
| `LEAD` | Family lead, a member with a referral label (for example `rao-family`) that attributes guests and gifts. |
| `VENUE` | Venue staff. The **staff** roles are the admin roles plus `LEAD` and `VENUE`. |
| `GUEST` | The signed-in phone number is on the wedding's guest list. |
| `PLATFORM` | A platform compliance admin (`PLATFORM_ADMIN_PHONES`) who is not a member of the wedding. |

Anyone else who opens a wedding gets `403 NOT_INVITED`. "Any role" below means any of these roles.

## Endpoints

### Health, configuration and media

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/health` | Public | Liveness plus database and Redis status |
| GET | `/public/config` | Public | Payment provider, Razorpay key ID, OTP length and TTL, default country, whether the dev OTP is shown |
| GET | `/public/weddings` | Public | Home feed. Anonymous visitors see celebrations masked; a signed-in invitee sees their own unlocked. |
| GET | `/public/invitations/:refToken` | Public | Resolve a WhatsApp magic link to its wedding and a masked phone hint |
| GET | `/media/:key` | Public | Uploaded files when `STORAGE_DRIVER=local` |

### Auth

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/auth/request-otp` | Public | `{ phone, slug? }`. Sends a 6-digit code over WhatsApp, falling back to SMS. Returns `devOtp` when `EXPOSE_DEV_OTP=1` outside production. |
| POST | `/auth/verify-otp` | Public | `{ phone, otp, name? }`. Returns `{ accessToken, refreshToken, user }`. |
| POST | `/auth/refresh` | Public | `{ refreshToken }`. Returns a new token pair. |
| POST | `/auth/logout` | Public | `{ refreshToken }`. Revokes the session. |
| GET | `/auth/me` | Signed in | Current user |
| PATCH | `/auth/me` | Signed in | `{ name?, email? }` |

### Weddings

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/weddings` | Signed in | Create a wedding. Takes the couple, date, city, property, `ratePerSft` (₹), presets, cart hold, RERA and escrow details, `slug?` and `rooms?` (defaults to a 2 BHK). The creator becomes `HOST`. |
| GET | `/weddings/mine` | Signed in | Weddings where you are a member or invited guest, with your role |
| GET | `/weddings/:slug` | Any role | Microsite payload: wedding, your role, invitation and ceremonies |
| PATCH | `/weddings/:slug` | Admin | Update any wedding field, including `stageDisplayMode` and `taxExemptionEnabled` |
| PUT | `/weddings/:slug/rooms` | Admin | `{ rooms: [{ key, name, sft, description?, icon? }] }`. Rejected with `REGISTRY_LOCKED` once gifting has started. |
| POST | `/weddings/:slug/media/:kind` | Admin | Multipart `file`, where `kind` is `cover` or `video` |
| GET | `/weddings/:slug/dashboard` | Admin, Platform | Funding totals, room progress, RSVP and guest counts, recent gifts |
| GET | `/weddings/:slug/members` | Admin | List members |
| POST | `/weddings/:slug/members` | Admin | `{ phone, name?, role, label? }`. `label` is required for `LEAD`. |
| DELETE | `/weddings/:slug/members/:memberId` | Admin | Remove a member. A wedding always keeps at least one host. |

### Ceremonies

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/weddings/:slug/ceremonies` | Any role | Guests see only the ceremonies they are invited to |
| POST | `/weddings/:slug/ceremonies` | Admin | `{ title, description?, startsAt, endsAt?, venueName, venueAddress?, venueMapsUrl?, streamUrl?, dressCode?, sortOrder? }`. Schedules a WhatsApp reminder 2 hours before the start. |
| PATCH | `/weddings/:slug/ceremonies/:id` | Admin | Partial update. Reschedules the reminder. |
| DELETE | `/weddings/:slug/ceremonies/:id` | Admin | Delete |
| GET | `/weddings/:slug/ceremonies/:id/calendar.ics` | Any role | iCalendar file |

### Guests (invitations)

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/weddings/:slug/guests` | Admin, Lead | Filters: `search`, `cohort`, `ceremonyId`, `rsvp`. Leads see only the guests carrying their label. |
| POST | `/weddings/:slug/guests` | Admin, Lead | `{ guestName, phone, email?, cohort?, maxAttendees?, enableRegistry?, ceremonyIds?, refLead? }` |
| POST | `/weddings/:slug/guests/import` | Admin, Lead | Multipart CSV `file` (format below). Returns `{ created, updated, errors: [{ row, message }] }`. |
| GET | `/weddings/:slug/guests/export.csv` | Admin, Lead | CSV export |
| GET / PATCH / DELETE | `/weddings/:slug/guests/:id` | Admin, Lead | Read, update or remove a guest |

The import CSV has these columns:

- Required: `guest_name` and `phone_whatsapp`.
- Optional: `guest_category`, `max_attendees`, `ceremonies` (titles), `enable_registry` and `ref_lead`.

Common header aliases are also accepted.

### WhatsApp dispatch

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/weddings/:slug/dispatches/preview` | Admin, Lead | Recipient count and message preview |
| POST | `/weddings/:slug/dispatches` | Admin, Lead | Queues invitations. Filters: `{ ceremonyIds?, cohorts?, invitationIds?, includeRegistry, onlyPendingRsvp? }`. Progress is pushed as `dispatch.progress`. |
| GET | `/weddings/:slug/dispatches` | Admin, Lead | History |
| GET | `/weddings/:slug/dispatches/:id` | Admin, Lead | Per-recipient delivery status |

### RSVP

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/weddings/:slug/rsvp/me` | Any role | Your RSVP plus your invitation's seat limit and ceremonies |
| PUT | `/weddings/:slug/rsvp/me` | Guest | Sends a WhatsApp confirmation. Body fields are listed below. |
| GET | `/weddings/:slug/rsvps?status=` | Staff, Platform | All responses |
| GET | `/weddings/:slug/rsvps/summary` | Staff, Platform | Headcounts per ceremony, dietary totals, stays and shuttles |
| GET | `/weddings/:slug/rsvps/export.csv` | Staff, Platform | CSV export |

The RSVP body takes:

- `status`, plus `adults`, `children` and `infants`, which must fit the seat limit.
- `attendingCeremonyIds` and `dietary`.
- Travel: `allergies`, `arrivalMode`, `arrivalDetails` and `arrivalAt`.
- Stay: `needsAccommodation`, `checkInDate`, `checkOutDate` and `needsShuttle`.
- `note`, `guestName` and `email`.

### Registry and gifts

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/weddings/:slug/registry` | Any role | Rooms, tiles (open, held, sold), rate per sq.ft. and totals |
| POST | `/registry/lock-tile` | Any role | `{ slug, roomKey, units, donorName?, relationship?, blessing?, anonymous?, tableNumber?, refLead? }`. Holds tiles for the wedding's `cartHoldTtlSec`. Returns `{ contribution, links: { checkoutUrl, … } }`. A user can have at most 3 open holds. |
| GET | `/registry/contributions/:id` | Donor | Contribution status, tiles and links |
| DELETE | `/registry/contributions/:id` | Donor | Cancel a pending gift and release its tiles |
| GET | `/weddings/:slug/contributions/mine` | Any role | Your gifts, with checkout and receipt links |
| GET | `/weddings/:slug/donor-wall` | Any role | Successful gifts. Anonymous donors are masked. |
| GET | `/weddings/:slug/contributions?status=` | Admin, Platform | All contributions |
| GET | `/weddings/:slug/contributions/export.csv` | Admin, Platform | CSV export |

### Payments

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/payments/checkout/:id?t=` | Signed link | Checkout details: amount, hold expiry, and the Razorpay order or mock flag |
| POST | `/payments/checkout/:id/verify?t=` | Signed link | `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`. Verifies the signature and funds the gift. |
| POST | `/payments/mock/:id/complete?t=` | Signed link | `{ outcome: "success" \| "failure" }`. Only works with `PAYMENT_PROVIDER=mock` outside production. |
| POST | `/payments/webhooks/razorpay` | Razorpay | Checks `X-Razorpay-Signature` against the raw body. Handles `payment.captured`, `order.paid` and `payment.failed`. Idempotent. |

A funded gift does the following:

- Marks its tiles sold.
- Posts the escrow ledger entries.
- Queues the receipt PDF and its WhatsApp delivery.
- Emits `contribution.funded` and `registry.updated`.

If a payment arrives after the hold expired and its tiles were taken by someone else, the gift is
marked `REFUND_REQUIRED`.

### Receipts

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/receipts/verify/:receiptNumber` | Public | Checks the HMAC signature. Returns `valid`, donor initials, amount and wedding. |
| GET | `/receipts/:id?t=` | Signed link, donor or admin | Receipt data |
| GET | `/receipts/:id/pdf?t=` | Signed link, donor or admin | PDF certificate |

### Blessings

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/weddings/:slug/blessings?status=&limit=` | Any role | Guests see approved blessings. Staff and Platform can filter by status. |
| POST | `/weddings/:slug/blessings` | Any role | Multipart: `message?` (up to 280 characters), `authorName?`, `tableNumber?`, `photo?` (up to 8 MB). A blessing needs a message or a photo. Text that passes the profanity filter is approved immediately; photos wait for moderation. |
| PATCH | `/weddings/:slug/blessings/:id` | Staff, Platform | `{ status: "APPROVED" \| "HIDDEN" \| "PENDING" }`. Approving emits `blessing.approved`. |

### Stage screen

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/weddings/:slug/stage` | Staff, Platform | Progress, rooms, recent gifts, approved blessings and display mode |
| GET | `/weddings/:slug/stage/qr.png?table=&size=` | Public | QR code that opens the microsite gift flow, optionally tagged with a table |

### Finance and settlements

Settlements move through `REQUESTED`, then `HOST_APPROVED`, then `APPROVED`, then `DISBURSED`. A
settlement can be `REJECTED` at any step before disbursement. Compliance approval must come from
someone other than the requester and the host approver (`DUAL_CONTROL`).

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/weddings/:slug/ledger` | Host, Co-host, Platform | Escrow balance, ledger entries and settlements |
| POST | `/weddings/:slug/settlements` | Host, Co-host | `{ amount (₹), destination: "BUILDER_ESCROW" \| "HOME_LOAN", beneficiaryName, accountNumber, ifsc }`. Cannot exceed the available balance. |
| POST | `/weddings/:slug/settlements/:id/approve` | Host | Host approval |
| POST | `/weddings/:slug/settlements/:id/reject` | Host, Co-host | `{ reason }` (3–300 characters) |
| GET | `/admin/settlements?status=` | Platform admin | Compliance queue across all weddings |
| POST | `/admin/settlements/:id/approve` | Platform admin | Compliance approval |
| POST | `/admin/settlements/:id/disburse` | Platform admin | `{ bankReference }` (4–60 characters). Debits escrow. |
| POST | `/admin/settlements/:id/reject` | Platform admin | `{ reason }` |

## Live events (Socket.IO)

Connect to the `/live` namespace with `auth: { token: <accessToken> }`, then emit `join` with
`{ slug, channel }`. The acknowledgement is `{ ok: true, room }` or `{ ok: false, error }`.

| Channel | Who can join |
| --- | --- |
| `wedding` | Any role |
| `admin` | Host, Co-host, Lead |
| `stage` | Staff, Platform |

| Event | Channels | Payload |
| --- | --- | --- |
| `registry.updated` | wedding, stage | Full registry state (rooms, tile statuses, totals) after a hold, release or sale |
| `contribution.funded` | wedding, stage, admin | Donor-wall entry. On stage it respects the display mode; on admin it is the full contribution. |
| `blessing.approved` | wedding, and stage unless the display mode is `PROGRESS_ONLY` | Blessing |
| `rsvp.updated` | admin | RSVP summary |
| `dispatch.progress` | admin | Dispatch summary (sent, delivered, failed counts) |

Events are published through Redis, so they reach clients connected to any API instance and are
also sent by worker-only processes.
