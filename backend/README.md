# PlotTheirFuture API (NestJS)

REST API, background workers and realtime gateway for PlotTheirFuture. It uses NestJS 12 (ESM),
Mongoose with MongoDB, Redis with BullMQ, Socket.IO and Zod.

## Setup

```bash
cp .env.example .env          # every variable is documented in ../docs/ENVIRONMENT.md
pnpm install
pnpm db:seed                  # optional: demo wedding "sanvi-santosh" and demo accounts
pnpm start:dev                # http://localhost:5000, Swagger at /api/docs
```

Set `MONGODB_URI` to a MongoDB Atlas connection string (see the Atlas steps in the
[repository README](../README.md#mongodb-atlas)). The database must be a replica set, because
checkout and settlements run multi-document transactions. You also need Redis. From the
repository root, `docker compose up -d redis` starts Redis. The Compose `mongo` service is a
single-node replica set for the containerised API. Its member hostname is `mongo`, which does
not resolve on the host, so `pnpm start:dev` on the host should use Atlas.

`.env` is gitignored. Do not put a real password in `.env.example`.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm start:dev` | Watch mode |
| `pnpm build` / `pnpm start:prod` | Compile to `dist/`, then run it |
| `pnpm lint` | oxlint (type-aware) |
| `pnpm test` | Unit tests (Vitest, no database) |
| `pnpm test:e2e` | End-to-end tests. Starts `mongodb-memory-server` (a replica set) and uses Redis (`TEST_REDIS_URL`, default `redis://localhost:6379/15`) |
| `pnpm db:seed` | Seed demo data into `MONGODB_URI` |

## Layout

```
src/
  main.ts, app.module.ts, app.setup.ts   bootstrap, global guards, filters, CORS, Helmet
  config/        Zod-validated environment
  database/      Mongoose connection, transactions, duplicate-key errors
  models/        Mongoose schemas, document types, application-level cascades
  common/        auth decorators, error filter, utilities (crypto, phone, CSV, formatting)
  access/        per-wedding role resolution (tenant isolation)
  auth/          OTP, JWT, refresh sessions
  weddings/ ceremonies/ guests/ dispatch/ rsvp/ registry/ payments/ receipts/
  finance/ blessings/ stage/ notifications/ realtime/ storage/ jobs/ health/
  seed.ts        demo wedding
test/
  app.e2e-spec.ts (full flows: OTP, roles, gifting, payments, receipts, RSVP, settlements)
```

For details, see [Architecture](../docs/ARCHITECTURE.md), [API reference](../docs/API.md) and
[Deployment](../docs/DEPLOYMENT.md).
