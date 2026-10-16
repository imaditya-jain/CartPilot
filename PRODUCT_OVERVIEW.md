# CartPilot AI — Product & Architecture Overview

**Your Store's AI Sales Partner.** CartPilot AI connects a merchant's Shopify store to a
multi-tenant SaaS dashboard that synchronizes products and orders, calculates real sales
analytics, generates AI insights grounded in that data, and gives shoppers an AI-assisted chat
widget on the storefront itself.

> Every number shown to a merchant traces back to a real synchronized record. Nothing is
> estimated or invented — including by the AI layer, which is only ever allowed to **narrate**
> numbers that a deterministic database query already produced.

---

## Contents

1. [What it is & who it's for](#1-what-it-is--whos-its-for)
2. [How it helps a merchant](#2-how-it-helps-a-merchant)
3. [What's implemented today](#3-whats-implemented-today)
4. [What's planned next](#4-whats-planned-next)
5. [System architecture](#5-system-architecture)
6. [Data model & multi-tenancy](#6-data-model--multi-tenancy)
7. [Authentication & session security](#7-authentication--session-security)
8. [Shopify sync & webhook architecture](#8-shopify-sync--webhook-architecture)
9. [AI architecture & grounding principle](#9-ai-architecture--grounding-principle)
10. [Storefront chatbot architecture](#10-storefront-chatbot-architecture)
11. [Customer behavior recording](#11-customer-behavior-recording)
12. [Known limits & honest gaps](#12-known-limits--honest-gaps)

---

## 1. What it is & who it's for

CartPilot AI is built for small-to-mid-sized Shopify merchants who don't have a dedicated data
analyst or a developer on staff, but still want to understand their sales and give customers a
better self-serve shopping experience.

A merchant signs up, connects their Shopify store, and CartPilot AI takes over three jobs that
would otherwise require separate tools, a spreadsheet habit, or a developer:

- keeping a synchronized copy of the catalog and order history,
- turning that data into sales analytics and plain-language insights, and
- running a chat widget on the storefront that can answer product questions using the real
  catalog — even when the merchant is offline.

## 2. How it helps a merchant

| Benefit | How |
|---|---|
| **Sees sales clearly, without logging into Shopify** | Gross sales, average order value, discounts, and top products appear on one dashboard, computed directly from synchronized orders — no manual export or spreadsheet work. |
| **Gets a plain-language read on performance** | AI Insights turns the same numbers into a short summary and concrete suggested actions — the kind of read a merchant would otherwise need an analyst to produce. |
| **Never has to babysit a sync** | Connecting a store triggers an automatic background sync and registers webhooks, so new orders and product changes keep flowing in without a manual "refresh" step. |
| **Answers shoppers 24/7** | The storefront widget can find and recommend real products from the catalog and answer questions conversationally, catching interest that would otherwise bounce when no one's watching live chat. |
| **Controls the brand experience directly** | Bot name, tone, colors, launcher icon and position, and suggested prompts are all merchant-configurable with a live preview — no code, no developer required. |
| **Installs in one line** | A single script tag in `theme.liquid` is the entire storefront integration today, with a one-click way to test it on a mock storefront before going live. |

## 3. What's implemented today

Status reflects what has been built and verified end-to-end against live data, not just
scaffolded.

| Capability | Status | Detail |
|---|---|---|
| Account & authentication | ✅ Done | Register with email verification, login/logout, forgot/reset password. Short-lived access JWT + rotating refresh JWT, reuse detection, session-family revocation. |
| Shopify OAuth connect | ✅ Done | HMAC + CSRF-state verified OAuth flow; access token encrypted at rest (AES-256-GCM). Requires a public HTTPS host to complete (see §12). |
| Local-dev connect path | ✅ Done | Paste a Shopify custom-app access token to connect a store without a public URL. Hard-disabled outside development. |
| Product & order sync | ✅ Done | Cursor-paginated Admin GraphQL queries, idempotent bulk upserts, starts automatically the moment a store connects. |
| Webhooks | ✅ Done | Auto-registered on connect (products/orders create/update/delete, app/uninstalled); signature-verified, deduplicated receiver. |
| Products & Orders pages | ✅ Done | Paginated lists with live sync-progress polling, plus single-item detail pages (variants/images; line items with product-image enrichment). |
| Analytics | ✅ Done | MongoDB aggregation pipeline: gross sales, AOV, discounts, orders by status, top-5 products by revenue. KPI tiles + chart. |
| AI Insights | ✅ Done | NVIDIA-generated summary/observations/suggested actions, strictly narrating the aggregation output above. Zod-validated, cached, graceful fallback if unavailable. |
| Storefront chat widget | ✅ Done | Embeddable iframe widget; deterministic catalog search for product matching, AI-narrated reply text layered on top. |
| Chatbot customization | ✅ Done | Name, tone, welcome message, colors (with WCAG AA contrast check), icon, position, size, suggested prompts — with live preview. |
| Multi-tenant isolation | ✅ Done | Every store-scoped query routes through one ownership-checking chokepoint; product/order documents carry a denormalized tenant reference. |
| Shopify theme app extension | 🟡 Partial | Script-tag embed works today; the no-code toggle-on theme extension is the planned replacement (see §4). |
| Discount eligibility/redemption | ⬜ Planned | Not yet built. Flagged in the chatbot settings UI as pending rather than implied to work. |
| Customer behavior tracking (beyond chat) | ⬜ Planned | See §11 — chat conversations are already recorded; broader behavioral tracking is a deliberate, consent-gated next step. |

## 4. What's planned next

1. **Shopify theme app extension.** Replace the manual script-tag install with a toggle-on app
   embed block in the Shopify theme editor — no code editing for the merchant at all.
2. **Consent-gated behavioral signals.** Let a shopper's viewed/added products (not just chat
   messages) inform recommendations, under the same data-minimization and retention rules
   already used for chat conversations.
3. **Discount eligibility engine.** Merchant-configured, server-verified rules (never
   AI-decided) for when the widget may offer a discount, using Shopify's own discount APIs for
   actual redemption.
4. **Deeper analytics.** Date-range comparisons, sales trend lines over time, declining-product
   detection, frequently-bought-together pairs.
5. **Broader automated test coverage,** including Playwright end-to-end flows for the critical
   paths already covered manually in this build.

## 5. System architecture

One Next.js application serves three distinct surfaces from the same codebase and database:

```
 Merchant browser                              Shopper's browser
 (Dashboard, React/Redux)                       (Storefront + chat iframe)
          │                                              │
          ▼                                              ▼
 ┌───────────────────────────────────────────────────────────────┐
 │                   CartPilot AI (Next.js)                       │
 │   API routes · services · server components                   │
 │   middleware-gated dashboard · public widget routes            │
 └───────────────────────────────────────────────────────────────┘
          │                        │                       │
          ▼                        ▼                       ▼
 ┌─────────────────┐      ┌──────────────────┐    ┌──────────────────────┐
 │    MongoDB       │      │ Shopify Admin API │    │ NVIDIA API Catalog   │
 │ Users, Stores,    │     │ GraphQL sync ·    │    │ Narrates pre-computed │
 │ Products, Orders, │     │ OAuth · Webhooks   │    │ data — never the      │
 │ Chatbot config/   │     │ (inbound)          │    │ source of a number    │
 │ conversations      │     │                    │    │                       │
 └─────────────────┘      └──────────────────┘    └──────────────────────┘
```

### Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript strict mode |
| UI | React, Tailwind CSS, Redux Toolkit (session/UI state only — never tokens) |
| Database | MongoDB + Mongoose, shared collections with enforced tenant isolation |
| Auth | JWT (`jose`, edge-compatible), bcrypt password hashing |
| Validation | Zod (server/API boundaries), Yup + React Hook Form (auth forms) |
| Commerce | Shopify Admin GraphQL API, OAuth 2.0, webhooks |
| AI | NVIDIA API Catalog, OpenAI-compatible `chat.completions` |
| Charts | Recharts |
| Testing | Vitest (unit, security-critical paths), Playwright (manual + scripted verification) |

## 6. Data model & multi-tenancy

CartPilot AI is a **shared-database, shared-collection** multi-tenant system: every tenant's data
lives in the same MongoDB collections, isolated entirely by application-level checks rather than
separate databases. That isolation is enforced at a single chokepoint (`requireOwnedStore`) that
every store-scoped read or write must pass through — a client-supplied store ID is never trusted
on its own. Product and Order documents additionally carry a denormalized tenant reference, so
even a single-document fetch (a product or order detail page) enforces isolation without an extra
lookup.

| Model | Key fields |
|---|---|
| **User** | email, password hash, emailVerified, status |
| **Session** | hashed refresh token, family ID, revocation state |
| **Store** | shop domain, encrypted access token, connection + sync status |
| **Product** | tenantId, storeId, variants, images, status |
| **Order** | tenantId, storeId, line items, totals, status |
| **ChatbotConfiguration** | branding, tone, behavior (one per store) |
| **ChatConversation** | anonymous visitorId, messages, 30-day auto-expiry |
| **WebhookEvent** | dedup by Shopify webhook ID, 30-day retention |
| **Email/PasswordResetToken** | hashed, single-use, short expiry |

## 7. Authentication & session security

1. **Short-lived access token, long-lived refresh token** — both HttpOnly/SameSite=Lax cookies,
   never in localStorage or Redux.
2. **Refresh rotation on every use** — each refresh issues a new refresh token and invalidates
   the previous one.
3. **Reuse detection** — presenting an already-rotated refresh token revokes its entire session
   family, not just that token — the standard response to a potentially leaked token.
4. **Password reset revokes everything** — a successful reset invalidates every active session
   for the account, not just the one requesting the reset.
5. **Defense in depth on protected routes** — edge middleware gates navigation; a
   server-component layout check means a bypassed middleware still can't render protected data.

## 8. Shopify sync & webhook architecture

1. **Connect** — OAuth (HMAC + CSRF-state verified) or, for local development, a pasted
   custom-app access token.
2. **Token encrypted at rest** — AES-256-GCM, decrypted only at the point of use; never sent to
   the browser.
3. **Initial sync starts automatically** — cursor-paginated GraphQL queries pull the full
   product and order catalog; idempotent bulk upserts mean re-running a sync is always safe.
4. **Webhooks registered automatically** — product/order create, update, delete, and
   app/uninstalled — so ongoing changes flow in without re-syncing.
5. **Inbound webhooks are signature-verified and deduplicated** — by Shopify's own webhook ID,
   so a retried delivery is never double-processed.
6. **Merchant sees live progress** — a sync-status indicator polls automatically while a
   background sync runs and stops the moment it completes — no manual refresh.

## 9. AI architecture & grounding principle

> **The one rule the AI layer can never break:** the model is only ever asked to **narrate**
> numbers and catalog results a deterministic database query already produced. It is never the
> source of a metric, a product match, a price, or a discount decision.

### AI Insights

A MongoDB aggregation pipeline computes gross sales, average order value, discount totals,
order-status breakdown, and top-5 products by revenue. That JSON — and only that JSON — is
handed to the model with instructions to summarize it and suggest actions. The model's response
is Zod-validated against a strict schema before it's shown to anyone; a malformed or failed
response falls back to a clearly-labeled example using the same real numbers, never a silent
failure or an invented result. Successful insights are cached for six hours.

### Storefront chat replies

Product matching is a deterministic keyword search over the synchronized catalog (with basic
singular/plural handling) — this can never return a product that doesn't exist. When an AI
provider is configured, the model is given that exact result set and the shopper's message, and
asked only to phrase a short, on-tone reply referencing *those* products and prices — explicitly
instructed not to imply other inventory exists. If the provider is unavailable, a deterministic
templated reply takes over instead; the shopper is never left without a response.

## 10. Storefront chatbot architecture

The widget runs as an **iframe** pointed at a public, unauthenticated page on the CartPilot AI
domain — not code injected directly into the merchant's theme. A tiny loader script (one script
tag) creates that iframe and listens for `postMessage` events from it to resize itself between a
small launcher bubble and the full chat panel, so the merchant's theme never needs to know the
widget's internal state.

**What the merchant controls:** bot name, welcome message, tone, brand/text color
(contrast-checked), launcher icon and position, panel size, light/dark theme, suggested prompts,
and whether product recommendations are shown — all with a live preview before publishing.

**What the widget never exposes:** no Shopify Admin credentials, no AI provider keys, no
internal store IDs beyond the one public identifier needed to load that store's published
configuration.

## 11. Customer behavior recording

What's captured today, and how the next step is deliberately scoped around consent and data
minimization rather than tracking everything by default.

### Recorded today

Every chat conversation is stored against an **anonymous, client-generated visitor ID** — never
a real identity, never fingerprinting. Each record holds the message history, any products
referenced in replies, and timestamps, and **automatically expires after 30 days**. This is
enough for a merchant to see what shoppers are actually asking about, without CartPilot AI
holding onto anything longer than it needs to.

### Deliberately not recorded today

- No page views, product views, or add-to-cart events outside the chat widget itself.
- No cross-session identity resolution — a returning shopper isn't recognized.
- No device/browser fingerprinting of any kind.

### Planned: consent-gated behavioral signals

The next step is letting the widget use explicitly consented signals — the product or
collection a shopper is currently viewing, for example — to make recommendations sharper, under
the same rules already applied to chat data:

- **Consent-first** — nothing is captured before a shopper has agreed to it, respecting the
  applicable Shopify customer-privacy mechanisms.
- **Data minimization** — only the signal needed for the stated purpose (better
  recommendations), never a general-purpose tracking pixel.
- **Configurable, bounded retention** — merchant-set limits, with the same kind of automatic
  expiry already in place for chat records.
- **No fingerprinting, ever,** as a substitute for consent.

## 12. Known limits & honest gaps

- **Shopify OAuth needs a public HTTPS host.** Shopify requires the OAuth redirect URL to match
  a fixed, pre-registered Application URL — `localhost` cannot satisfy this. A tunnel
  (ngrok/Cloudflare) or a real deployment is required to complete the real OAuth flow and to
  receive webhook deliveries; the local-dev access-token path exists specifically to unblock
  product/order sync testing in the meantime.
- **Installation is a manual script tag today,** not yet a no-code Shopify theme app extension.
- **No discount creation or redemption yet** — the chatbot settings UI marks this as pending
  rather than implying it works.
- **AI features depend on an authorized NVIDIA API Catalog account.** A present-but-unauthorized
  API key fails identically across every model, which can look like a code bug before it's
  diagnosed as an account-level issue (credits, org selection, or terms acceptance) — worth
  checking first if AI features ever stop working.
- **Sync and background jobs run in-process,** suited to a single always-on Node instance; a
  real job queue is the natural next step before scaling to multiple instances or serverless.

---

*CartPilot AI — internal product & architecture reference. Reflects the state of the codebase as
actively built.*
