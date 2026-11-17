# Deployment

The system has four runtime parts, and each can be hosted separately:

| Part | Image / build | Needs |
| --- | --- | --- |
| API (+ workers) | `backend/Dockerfile` (port 5000) | MongoDB replica set (Atlas), Redis 7+, persistent storage (a volume or S3) |
| Web | `frontend/web/Dockerfile` (port 3000, Next.js standalone) | `NEXT_PUBLIC_API_URL` at build time |
| Mobile | `flutter build appbundle` / `ipa` | Store accounts, HTTPS API |
| Third parties | — | Razorpay, Meta WhatsApp Cloud API, MSG91 (optional) |

## 1. Single host with Docker Compose

This suits staging or a small production install.

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` as follows:

- **MongoDB:** set `MONGODB_URI` to the Atlas SRV string (`mongodb+srv://<username>:<password>@<cluster-url>/<database-name>`). Allow the host's IP in Atlas Network Access. The cluster must be a replica set so transactions work. See [MongoDB Atlas](../README.md#mongodb-atlas).
- **Secrets:** set `JWT_SECRET` (required at boot; it is not the signing key). Fill the signing secrets with `openssl rand -hex 32` (`JWT_ACCESS_SECRET`, `JWT_LINK_SECRET`, `OTP_PEPPER`, `RECEIPT_SIGNING_SECRET`).
- **Public URLs:** `API_PUBLIC_URL=https://api.example.com`, `WEB_PUBLIC_URL=https://example.com` and `CORS_ORIGINS=https://example.com`.
- **Compliance admins:** `PLATFORM_ADMIN_PHONES=+91…`.
- **Production:** set `TRUST_PROXY=1`, `PAYMENT_PROVIDER=razorpay` with its keys, `WHATSAPP_DRIVER=cloud` with its credentials, and `EXPOSE_DEV_OTP=0`.

Then build and start:

```bash
API_NODE_ENV=production PUBLIC_API_URL=https://api.example.com docker compose up --build -d
docker compose logs -f api
```

The API connects to MongoDB on startup and builds indexes declared on the Mongoose schemas. There is no SQL migration step.
Put a TLS-terminating reverse proxy such as Caddy, Nginx or a cloud load balancer in front:

- `example.com` goes to `web:3000`.
- `api.example.com` goes to `api:5000`. WebSocket upgrades must be allowed for `/socket.io/`.

Demo data is optional, and is meant for staging only:

```bash
docker compose --profile tools run --rm seed
```

## 2. Managed or cloud deployment

The recommended layout for production:

| Component | Options |
| --- | --- |
| MongoDB | MongoDB Atlas (replica set). Enable backups. The API reads `MONGODB_URI` and does not copy an existing PostgreSQL database. |
| Redis | AWS ElastiCache, Upstash or Redis Cloud. Use `rediss://` for TLS. BullMQ needs `maxmemory-policy noeviction`. |
| API | ECS Fargate, Cloud Run (min instances ≥ 1, request timeout raised for long-lived WebSockets), Fly.io, Render, Railway or Kubernetes |
| Workers | The same API image with `RUN_WORKERS=1`. Set `RUN_WORKERS=0` on the web-facing API replicas when you scale them separately. |
| Web | Vercel (set the root directory to `frontend/web`) or the Docker image on any container host |
| Files | S3 or Cloudflare R2 (`STORAGE_DRIVER=s3`, `S3_PUBLIC_URL` pointing at the CDN) |

### Scaling the API and workers

- **API replicas:** these are stateless. Socket.IO uses the Redis adapter, so any number of replicas can serve clients. The web and mobile clients connect with the WebSocket transport only, so sticky sessions are not required.
- **Worker replicas:** BullMQ distributes jobs across them. The repeating hold-expiry job is a single scheduler, so it runs exactly once per interval however many workers there are.
- **Health checks:** point load-balancer health checks at `GET /api/v1/health`. It returns 200 when the database and Redis are reachable.

### Schema changes

Mongoose models live in `backend/src/models/schemas.ts`. Indexes are created on connect
(`autoIndex`). Deploying a new version of the API applies new indexes. It does not rewrite
existing documents, and it does not import data from PostgreSQL. Take an Atlas snapshot before a
release that changes document shape.

## 3. Razorpay go-live

1. Complete KYC, then create **Live** API keys and set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. In the dashboard, create a webhook with:
   - URL: `https://api.example.com/api/v1/payments/webhooks/razorpay`.
   - Events: `payment.captured`, `payment.failed` and `order.paid`.
   - A secret, which you also set as `RAZORPAY_WEBHOOK_SECRET`.
3. Enable auto-capture for payments.
4. Test end to end with Test Mode keys first. The checkout page loads `checkout.razorpay.com` automatically.

## 4. WhatsApp and SMS go-live

1. Create a Meta Business account and a WhatsApp Business app, then add and verify the sender number.
2. Create a permanent System User token with `whatsapp_business_messaging` permission, and set `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN`.
3. Submit the five templates in [ENVIRONMENT.md](ENVIRONMENT.md#whatsapp-templates) and wait for approval. Names, language and parameter order must match exactly.
4. Set `WHATSAPP_DRIVER=cloud`.
5. Optionally, for SMS OTP fallback: register a DLT OTP template with MSG91, then set `SMS_DRIVER=msg91`, `MSG91_AUTH_KEY` and `MSG91_OTP_TEMPLATE_ID`.

Every outbound message, including failures, is recorded in the `notification_logs` collection. OTP
payloads are redacted.

## 5. Web

Docker:

```bash
docker build -t ptf-web --build-arg NEXT_PUBLIC_API_URL=https://api.example.com frontend/web
docker run -p 3000:3000 ptf-web
```

Vercel:

1. Import the repository and set the root directory to `frontend/web`.
2. Set the environment variable `NEXT_PUBLIC_API_URL=https://api.example.com`.
3. Add the Vercel domain to the API's `CORS_ORIGINS`, and set `WEB_PUBLIC_URL` to it.

## 6. Mobile

```bash
cd frontend/mobile
flutter build appbundle --release --dart-define=API_URL=https://api.example.com --dart-define=WEB_URL=https://example.com
flutter build ipa --release --dart-define=API_URL=https://api.example.com --dart-define=WEB_URL=https://example.com
```

Before publishing:

- Configure an Android upload keystore in `android/app/build.gradle.kts`. The release build currently signs with debug keys, which is fine for local testing only.
- Set the iOS bundle identifier and signing team in Xcode.

## Production checklist

- [ ] `NODE_ENV=production`. The API refuses mock payments, and the development OTP is never returned.
- [ ] Unique 32+ character secrets, kept in a secret manager. `RECEIPT_SIGNING_SECRET` is backed up and never rotated.
- [ ] HTTPS everywhere, `TRUST_PROXY=1` behind the proxy, and `CORS_ORIGINS` limited to your web origins.
- [ ] Atlas backups enabled, and Redis persistence (AOF) with `noeviction`.
- [ ] `STORAGE_DRIVER=s3`, or a persistent volume for `/app/uploads`.
- [ ] The Razorpay webhook is configured and delivering. Check the Razorpay dashboard and the `payment_events` collection.
- [ ] The WhatsApp templates are approved and a test OTP arrives.
- [ ] `PLATFORM_ADMIN_PHONES` lists your compliance officers.
- [ ] Monitoring: the health endpoint, error logs, and the queue depth of failed BullMQ jobs.

## Continuous integration

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every push to `main` and on every
pull request:

- **Backend:** lint, build, unit tests, and e2e tests. E2e starts an in-memory MongoDB replica set and uses the Redis service.
- **Web:** lint and production build.
- **Mobile:** `flutter analyze`, `flutter test` and a web build.
