# CartPilot AI

**Your Store's AI Sales Partner.** A multi-tenant SaaS that connects Shopify stores to AI-generated
business insights and an embeddable storefront chatbot.

This README is updated as each build phase lands. See **Status** for what's real today.

## Stack

Next.js 14 (App Router, TypeScript) · Tailwind CSS · Redux Toolkit · MongoDB/Mongoose · JWT auth
(`jose`) · Zod (most server/API validation) + Yup (auth forms, via React Hook Form) · NVIDIA API
Catalog · Shopify Admin GraphQL API

## Status

### Done
- **Foundation**: folder structure, design tokens (light/dark, monochrome-ink brand palette),
  Tailwind config, base UI components, responsive dashboard shell (sidebar + mobile drawer), typed
  Redux store.
- **Authentication**: registration with email verification, login, logout, forgot/reset password
  (reset revokes every active session for the account), access/refresh JWT cookies, refresh-token
  rotation with reuse detection (revokes the whole session family on replay), server-side route
  protection (middleware + layout-level defense in depth), rate limiting on auth endpoints.
  Register/login/forgot/reset forms use React Hook Form + Yup; server routes share the same Yup
  schemas (`lib/validation/auth.ts`).
- Multi-tenant foundation: `User`, `Session`, `Store` models with tenant-ownership enforced
  through a single `requireOwnedStore` chokepoint (never trusts a client-supplied store ID) —
  Product/Order documents also carry a denormalized `tenantId` so single-document reads (detail
  pages) enforce isolation without an extra store lookup.
- **Shopify integration**: OAuth connect/callback (HMAC + CSRF state verified, access token
  encrypted at rest with AES-256-GCM) and a local-dev-only access-token connect path
  (`/api/shopify/connect-dev`, hard-disabled outside development). On connect: product/order sync
  via Admin GraphQL with cursor pagination and idempotent bulk upserts starts automatically, and
  webhook subscriptions (products/orders create/update/delete, app/uninstalled) are registered
  against this app's single `/api/shopify/webhooks` endpoint. `/stores` page: connect/sync/disconnect
  with live sync-progress polling. **Note:** completing the real OAuth round-trip (and receiving
  webhook deliveries) requires `SHOPIFY_APP_URL` to be a publicly reachable HTTPS host matching the
  Partner Dashboard's configured Application URL — `localhost` alone won't work; use a tunnel
  (ngrok/cloudflared) for local testing, or defer until deployed. The dev-connect path sidesteps
  this for local product/order sync testing.
- **Products/Orders**: paginated list pages with live sync-status bar (auto-polls while a
  background sync runs, no manual refresh needed) and single-item detail pages (variants/images
  for products; line items enriched with product images, subtotal/discount/total breakdown for
  orders). Product descriptions are HTML-stripped before display (untrusted synchronized content).
- **Analytics**: MongoDB aggregation pipeline (`services/analytics-service.ts`) over real
  synchronized orders/products — gross sales, average order value, orders by financial status,
  products by status, top-5-products-by-revenue (via `$unwind`/`$group` over line items). Surfaced
  as KPI tiles + a Recharts bar chart on `/analytics`, and as a quick KPI summary on `/dashboard`.
- **AI Insights**: working end-to-end against NVIDIA's API Catalog (`meta/llama-3.2-11b-vision-instruct`,
  OpenAI-compatible `chat.completions`). The model only narrates numbers already computed by the
  aggregation pipeline above — it never invents metrics. Output is Zod-validated, 6-hour cached, and
  falls back to a clearly-labeled example (if no provider configured) or a visible error + retry
  (if a configured provider call fails) — never a silent/fake success.
- **Chatbot**: product matching is always deterministic (regex keyword search over the
  synchronized catalog, with basic singular/plural normalization), so results can never be
  AI-invented; the reply *text* is AI-narrated when a provider is configured (same NVIDIA model),
  with a deterministic templated fallback otherwise. Public embeddable widget
  (`/widget/[storeId]` in an iframe + `public/chatbot/loader.js`, postMessage-driven sizing),
  merchant settings page (`/settings`) with live preview and an installation snippet, and a
  one-click "Test chat widget" link (`/widget-preview/[storeId]`) that loads a mock storefront
  with the real loader script — no separate test-only code path. Not yet built: Shopify theme app
  extension (manual script-tag embed is the current method), discount code creation/redemption.

### Not yet built
- Shopify theme app extension (script-tag embed works today, extension is the planned production path)
- Discount eligibility/redemption engine
- Broader test coverage + Playwright e2e

## Setup

```bash
npm install
cp .env.example .env.local   # fill in real values — see below
npm run dev
```

### Required environment variables

| Variable | Required for | Notes |
|---|---|---|
| `MONGODB_URI` | everything | local MongoDB or Atlas connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `TOKEN_ENCRYPTION_KEY` | auth | three **distinct** random 32+ char strings, e.g. `openssl rand -hex 32` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `EMAIL_FROM` | sending real verification emails | if unset, verification links are logged to the server console in development (fails loudly in production) |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` / `SHOPIFY_APP_URL` | Shopify connect flow | from a Shopify Partner app; `SHOPIFY_APP_URL` must be a publicly reachable HTTPS host for OAuth to complete |
| `NVIDIA_API_KEY` / `NVIDIA_MODEL` | AI insights + AI chat replies | from build.nvidia.com; verify the model isn't EOL and your account has inference access (a valid-looking key can still return 403 if the account itself isn't authorized — check credits/org/terms on the dashboard) |

The app fails fast with a clear (secret-free) error if a required variable is missing — see
`src/lib/env.ts`.

## Scripts

```bash
npm run dev          # local dev server
npm run build         # production build — writes to .next, the SAME dir `next dev` uses live;
                        # running this while a dev server is up corrupts its asset manifest
                        # (stale CSS/JS until the dev server is restarted)
npm run build:verify  # same build, but to .next-verify — safe to run alongside `next dev`
npm run typecheck     # tsc --noEmit
npm run lint           # eslint
npm run test            # vitest unit tests
npm run test:e2e         # playwright (once configured)
```

## Architecture notes

- **Tenant isolation**: every store-scoped read/write must go through
  `services/store-service.ts#requireOwnedStore`, which re-validates ownership server-side —
  client-supplied store IDs are never trusted directly.
- **Auth tokens**: short-lived access JWT + rotating refresh JWT, both `HttpOnly`/`SameSite=Lax`
  cookies (never in localStorage/Redux). Refresh tokens are tracked server-side via a hashed
  session record so they can be revoked; reuse of an already-rotated token revokes the entire
  session family.
- **Redux**: holds only client UI/session state (current user, active store, status flags) —
  never tokens. Server state (products, orders, analytics) will be fetched per-view, not
  duplicated into global state.

## Automatic daily sync

Products and orders already stay current in near real time via the webhooks registered
automatically on connect (`products/orders` create/update/delete, see §8 of
`PRODUCT_OVERVIEW.md`) — no manual action needed for day-to-day changes. On top of that,
`GET /api/cron/sync-all` runs a full reconciliation sync (idempotent upserts, same as clicking
"Sync now") across every connected store, as a safety net in case a webhook delivery was ever
missed. It does nothing unless `CRON_SECRET` is set, and requires it on every call via either
`Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`.

To run it daily, point any external scheduler at it once a day, e.g.:
- **Vercel Cron** — add a `vercel.json` cron entry for `/api/cron/sync-all` (Vercel sends the
  `Authorization: Bearer` header automatically when `CRON_SECRET` is set as an env var).
- **GitHub Actions** (or any CI with a schedule trigger) — a scheduled workflow that `curl`s the
  endpoint with the secret header.
- **Plain cron** on the host — `0 3 * * * curl -H "x-cron-secret: $CRON_SECRET" https://your-app/api/cron/sync-all`.
