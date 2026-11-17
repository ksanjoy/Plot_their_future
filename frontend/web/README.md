# PlotTheirFuture web (Next.js)

The web app covers the guest microsite, gifting checkout, receipts, host console, compliance desk
and venue stage screen. It is built with Next.js 16 (App Router, `cacheComponents`), React 19,
Tailwind CSS 4 and TanStack Query, and talks to the API in [`../../backend`](../../backend).

## Setup

```bash
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:5000
pnpm install
pnpm dev                       # http://localhost:3000
```

The API must be running and must allow this origin in `CORS_ORIGINS`.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build (standalone output) and server |
| `pnpm lint` | ESLint (Next.js, React hooks) |

## Layout

```
src/
  app/(site)/        public site, microsite (w/[slug]), checkout (pay/[id]), receipts (thank-you, verify),
                     admin console (admin/[slug] with role-filtered tabs), compliance desk
  app/stage/[slug]/  full-screen LED stage display
  components/        UI primitives, wedding widgets (floor plan, gift sheet, RSVP, blessings), admin forms
  lib/               api.ts (fetch + token refresh), auth.tsx, live.ts (Socket.IO), types, formatting
```

## Docker

```bash
docker build -t ptf-web --build-arg NEXT_PUBLIC_API_URL=https://api.example.com .
docker run -p 3000:3000 ptf-web
```

`NEXT_PUBLIC_API_URL` is inlined at build time. See [Deployment](../../docs/DEPLOYMENT.md).
