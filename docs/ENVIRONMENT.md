# Environment variables

## Backend (`backend/.env`)

Copy [`backend/.env.example`](../backend/.env.example) to `backend/.env`. Every variable is
validated at startup by [`src/config/env.ts`](../backend/src/config/env.ts), and the API refuses to
boot with an invalid value. Variables already set in the process environment take precedence over
the file. `ENV_FILE` points the API at a different file.

### Core

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test` or `production`. Production refuses `PAYMENT_PROVIDER=mock` and ignores `EXPOSE_DEV_OTP`. |
| `PORT` | `4000` | HTTP port |
| `API_PUBLIC_URL` | `http://localhost:4000` | Public URL of the API, used in receipt and media links |
| `WEB_PUBLIC_URL` | `http://localhost:3000` | Public URL of the web app, used in invitation, checkout and receipt links |
| `CORS_ORIGINS` | *(empty)* | Comma-separated browser origins allowed to call the API (web app, Flutter web) |
| `TRUST_PROXY` | `0` | Set to `1` behind a load balancer, so client IPs and rate limits are correct |
| `DATABASE_URL` | — (required) | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis used for queues, locks, OTP throttling and Socket.IO fan-out. `rediss://` enables TLS. |
| `RUN_WORKERS` | `1` | Run BullMQ workers (dispatch, receipts, reminders, hold expiry) in this process |

### Auth

| Variable | Default | Description |
| --- | --- | --- |
| `JWT_ACCESS_SECRET` | — (required, 32+ characters) | Signs access tokens |
| `JWT_LINK_SECRET` | — (required, 32+ characters) | Signs checkout and receipt links |
| `OTP_PEPPER` | — (required, 32+ characters) | Peppers OTP hashes |
| `JWT_ACCESS_TTL_SEC` | `900` | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | Refresh session lifetime |
| `OTP_TTL_SEC` | `300` | OTP validity |
| `OTP_MAX_ATTEMPTS` | `5` | Wrong codes allowed before the OTP is locked |
| `PLATFORM_ADMIN_PHONES` | *(empty)* | Comma-separated E.164 numbers that get compliance-desk access when they sign in |
| `DEFAULT_PHONE_COUNTRY` | `IN` | ISO country used for numbers entered without a `+` prefix |
| `EXPOSE_DEV_OTP` | `0` | `1` returns the OTP in the API response (shown on the sign-in screen). Ignored in production. |

Generate secrets with `openssl rand -hex 32`.

### Messaging

| Variable | Default | Description |
| --- | --- | --- |
| `WHATSAPP_DRIVER` | `console` | `console` logs messages (and stores them in `NotificationLog`). `cloud` uses the Meta WhatsApp Business Cloud API. |
| `WHATSAPP_PHONE_NUMBER_ID` | — | Required for `cloud` |
| `WHATSAPP_ACCESS_TOKEN` | — | Required for `cloud`. Use a permanent system-user token. |
| `WHATSAPP_API_VERSION` | `v21.0` | Graph API version |
| `WHATSAPP_TEMPLATE_LANGUAGE` | `en` | Language code of the approved templates |
| `WHATSAPP_TEMPLATE_OTP` | `ptf_otp` | Template names (formats below) |
| `WHATSAPP_TEMPLATE_INVITE` | `ptf_invite` | |
| `WHATSAPP_TEMPLATE_RSVP` | `ptf_rsvp_confirmation` | |
| `WHATSAPP_TEMPLATE_RECEIPT` | `ptf_gift_receipt` | |
| `WHATSAPP_TEMPLATE_REMINDER` | `ptf_ceremony_reminder` | |
| `SMS_DRIVER` | `console` | `msg91` sends the OTP by SMS when WhatsApp delivery fails |
| `MSG91_AUTH_KEY` | — | Required for `msg91` |
| `MSG91_OTP_TEMPLATE_ID` | — | Required for `msg91`. A DLT-approved OTP template. |

### Payments

| Variable | Default | Description |
| --- | --- | --- |
| `PAYMENT_PROVIDER` | `mock` | `mock` is a built-in simulator for development and is refused in production. `razorpay` uses Razorpay Orders, Checkout and webhooks. |
| `RAZORPAY_KEY_ID` | — | Required for `razorpay`. Also sent to browsers through `/public/config`. |
| `RAZORPAY_KEY_SECRET` | — | Required for `razorpay` |
| `RAZORPAY_WEBHOOK_SECRET` | — | Required for `razorpay`. The secret of the webhook pointing at `/api/v1/payments/webhooks/razorpay`. |

### Receipts and storage

| Variable | Default | Description |
| --- | --- | --- |
| `RECEIPT_SIGNING_SECRET` | — (required, 32+ characters) | HMAC key behind receipt numbers and verification. **Never rotate it** once receipts have been issued, or old receipts will fail verification. |
| `RECEIPT_ISSUER_NAME` | `PlotTheirFuture.in` | Issuer printed on receipts |
| `STORAGE_DRIVER` | `local` | `local` writes to disk and serves files from `/api/v1/media/*`. `s3` uses any S3-compatible bucket (AWS S3, Cloudflare R2, MinIO). |
| `STORAGE_LOCAL_DIR` | `./uploads` | Folder for `local`. Mount a persistent volume in containers. |
| `S3_BUCKET` | — | Required for `s3` |
| `S3_REGION` | `ap-south-1` | |
| `S3_ENDPOINT` | — | Custom endpoint for R2 or MinIO |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | — | Leave empty to use the instance or task role |
| `S3_PUBLIC_URL` | — | Required for `s3`. Public base URL of the bucket or CDN. |
| `MAX_UPLOAD_MB` | `8` | Upload size limit (cover images, blessing photos) |

### Test-only variables

The e2e tests (`pnpm test:e2e`) read `TEST_DATABASE_URL` (default
`postgresql://ptf:ptf@localhost:5432/ptf_test`) and `TEST_REDIS_URL` (default
`redis://localhost:6379/15`). The suite truncates its tables, so never point it at real data.
Apply migrations to the test database first:

```bash
DATABASE_URL=$TEST_DATABASE_URL pnpm db:migrate
```

## WhatsApp templates

Create these templates in WhatsApp Manager and use the same names as the `WHATSAPP_TEMPLATE_*`
variables. Body parameters are positional (`{{1}}`, `{{2}}`, and so on) and must be in this order.

| Template | Category | Body parameters | Other components |
| --- | --- | --- | --- |
| OTP (`ptf_otp`) | Authentication | 1: code | Copy-code / URL button whose dynamic value is the code |
| Invitation (`ptf_invite`) | Marketing or Utility | 1: guest name, 2: couple ("Sanvi & Santosh"), 3: ceremonies list, 4: registry line | URL button with base `{WEB_PUBLIC_URL}/` and a dynamic suffix (`w/{slug}?ref_token=…`) |
| RSVP confirmation (`ptf_rsvp_confirmation`) | Utility | 1: guest name, 2: couple, 3: summary ("Attending • 2 adults, 1 child"), 4: ceremonies attending | — |
| Gift receipt (`ptf_gift_receipt`) | Utility | 1: donor name, 2: sq.ft., 3: room, 4: amount ("₹25,000"), 5: receipt number | Document header (the receipt PDF) |
| Ceremony reminder (`ptf_ceremony_reminder`) | Utility | 1: guest name, 2: ceremony, 3: time, 4: venue | — |

With `WHATSAPP_DRIVER=console`, the rendered text of each message is printed to the API log
instead of being sent.

## Web (`frontend/web/.env.local`)

| Variable | Default | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | API origin as seen from the browser, without `/api/v1`. It is inlined at **build time**, so rebuild the image after changing it. |

The API's `CORS_ORIGINS` must include the web origin.

## Mobile (`--dart-define`)

| Name | Default | Description |
| --- | --- | --- |
| `API_URL` | `http://localhost:4000` | API origin. Use `http://10.0.2.2:4000` on the Android emulator. |
| `WEB_URL` | `http://localhost:3000` | Web origin. Payments, receipts and the full host console open here. |

Release Android builds block cleartext HTTP, so production URLs must use HTTPS.
