# 001 — Foundation baseline

Status: accepted for Phase 0/1 implementation, 2026-11-06. Operating policies below remain proposed until approved before launch.

## Inspection and authority

The repository contains a specification pack, not application code. Local Git authentication failed; the GitHub connector supplied the existing source snapshot (tree `34b895ceca96300ae829440677e644b0c31b6661`), including binary design references. The supplied original PHASE4 PDF is not present; use the authored blueprint/master prompt and record that limitation. Preserve every specification file. Do not manufacture a Git history or push this snapshot over the remote.

The explicit first task overrides the master prompt's all-phases instruction. Stop after foundation. No deployment or paid resources.

## Scope and decisions

- Confirmed baseline: React, MySQL, Render as future target, collection only, CUSTOMER/VENDOR/ADMIN, one role per account, one shop per vendor/order. Payment is arranged at collection; no payment/delivery/driver entities.
- Implementation choices: npm workspaces; TypeScript; Vite/React Router/TanStack Query; Express 5; Knex/mysql2; MySQL 8.4 InnoDB; Zod shared contracts. One production origin, Vite `/api` proxy in development.
- Schema includes all blueprint entities now. Routes for auth, approval, catalogue and orders are **not** implemented at this checkpoint. Role shells are public previews, not access control. No fake live data or successful business actions.
- Sessions: express-mysql-session-compatible `session_id/expires/data` schema; `users.auth_version` supports revocation in Phase 2. No session middleware or cookies are active yet.
- Exact money: decimal strings at boundaries, DECIMAL(10,2), checked integer cents for calculations. Historical snapshot fields and immutable/append-only triggers prevent accidental rewriting of history.
- Vendor applications need DRAFT in addition to review states so document uploads can precede submission. Documents reference `(shop_id, submission_version)`; submission freezes identity/profile/document references. Decisions may change review fields only.
- Proposed defaults: ZAR, English, Africa/Johannesburg display, UTC storage; 15-minute pending expiry; cancellation before acceptance by customer; after preparation explicit resalable quantities. These policies have no active scheduler/order workflow yet.
- Bootstrap: trusted operator command with externally supplied admin name/email/phone/password, bcrypt work factor 12, >=12 characters and <=72 UTF-8 bytes; transaction and audit entry; never upgrades an existing non-admin account. No public admin signup.
- Development seeds require explicit enablement, reject production regardless of the enable flag, never run on startup, use labelled fictional data and inactive accounts with random undisclosed passwords. Repeated execution does not reset business data.

## Concrete module plan

1. Root scripts/config, workspaces, exact dependency pins/lockfile, runtime pin and MySQL Compose.
2. `packages/contracts/src`: roles/states, health/error envelopes, strict bootstrap input, exact-money helpers.
3. `apps/api/src`: environment validation, database factory, injectable health dependency, HTTP errors/request IDs, production SPA routing and lifecycle. `db/migrations`, `db/seeds`, `scripts`: schema, seed, migration/bootstrap commands.
4. `apps/web/src`: tokens, reusable shell/navigation/status/empty state, explicit public/customer/vendor/admin route inventory and live health display.
5. `tests`: HTTP/contracts tests, real disposable MySQL schema/seed/bootstrap tests, browser layout/deep-link checks. Finish README and evidence/status.

## Verification strategy

Install from lockfile; lint; typecheck; unit/API tests; production build/start; inspect API JSON 404/error behavior and deep-link HTML. Run MySQL migration/seed twice and assert checks, foreign keys, one-shop items, immutable submissions/snapshots, append-only history and bootstrap safety against real MySQL. No SQLite substitute. Inspect 360px/1280px layouts and keyboard navigation. Concurrency/order/session authorization tests belong to later phases and are not claimed here.
