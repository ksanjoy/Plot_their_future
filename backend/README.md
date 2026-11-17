# PlotTheirFuture API (NestJS)

REST API, background workers and realtime gateway for PlotTheirFuture. It uses NestJS 12 (ESM),
Prisma 7 with PostgreSQL, Redis with BullMQ, Socket.IO and Zod.

## Setup

```bash
cp .env.example .env          # every variable is documented in ../docs/ENVIRONMENT.md
pnpm install                  # also generates the Prisma client
pnpm db:migrate               # apply migrations
pnpm db:seed                  # optional: demo wedding "sanvi-santosh" and demo accounts
pnpm start:dev                # http://localhost:4000, Swagger at /api/docs
```

You need a PostgreSQL and a Redis instance. From the repository root,
`docker compose up -d postgres redis` starts both.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm start:dev` | Watch mode |
| `pnpm build` / `pnpm start:prod` | Compile to `dist/`, then run it |
| `pnpm lint` | oxlint (type-aware) |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | End-to-end tests against a real Postgres and Redis (`TEST_DATABASE_URL`, `TEST_REDIS_URL`) |
| `pnpm db:migrate` / `db:migrate:dev` | Apply migrations / create a new migration |
| `pnpm db:seed` | Seed demo data |

The e2e suite truncates tables in the test database. Create the database and migrate it once:

```bash
createdb ptf_test
DATABASE_URL=postgresql://ptf:ptf@localhost:5432/ptf_test pnpm db:migrate
pnpm test:e2e
```

## Layout

```
src/
  main.ts, app.module.ts, app.setup.ts   bootstrap, global guards, filters, CORS, Helmet
  config/        Zod-validated environment
  common/        auth decorators, error filter, utilities (crypto, phone, CSV, formatting)
  access/        per-wedding role resolution (tenant isolation)
  auth/          OTP, JWT, refresh sessions
  weddings/ ceremonies/ guests/ dispatch/ rsvp/ registry/ payments/ receipts/
  finance/ blessings/ stage/ notifications/ realtime/ storage/ jobs/ health/
prisma/
  schema.prisma, migrations/, seed.ts
test/
  app.e2e-spec.ts (full flows: OTP, roles, gifting, payments, receipts, RSVP, settlements)
```

For details, see [Architecture](../docs/ARCHITECTURE.md), [API reference](../docs/API.md) and
[Deployment](../docs/DEPLOYMENT.md).
