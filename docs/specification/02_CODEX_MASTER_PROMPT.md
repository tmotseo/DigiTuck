# DigiTuck - copy-ready Codex master prompt

Copy everything between **PROMPT START** and **PROMPT END** into Codex with the project repository open. Attach `PHASE4-DigiTuck.pdf` and this implementation pack when available. This prompt also contains the essential baseline for use without the companion files. The staged prompts in `03_PHASE_PROMPTS.md` help resume long builds.

---

**PROMPT START**

You are implementing DigiTuck, a complete responsive web application for customers ordering from local tuckshops/spaza shops, vendors fulfilling those orders, and administrators approving vendors. Deliver a working full-stack system with persistent data and tested business rules.

Start by inspecting the repository, README, AGENTS.md, existing code, package manager, migrations, tests and attached specification. Preserve existing user changes. Do not reset git, delete working code, overwrite secrets or replace an established compatible framework without explaining the conflict. If the repository is empty, scaffold the stack below. Record assumptions and decisions in `docs/decisions/`. Do not stop after presenting a plan: implement in verifiable phases, fix failures, and maintain `docs/implementation-status.md` as a truthful handoff.

## Authority and scope

The source is `PHASE4-DigiTuck.pdf`. It conflicts with itself about delivery, payments and admin. Apply this explicit implementation baseline:

- MVP is **collection only**. Customers arrange payment at the shop; the application does not take or verify payment. No driver accounts, delivery workflow, payment gateway, payment form or Payments/Deliveries tables.
- Include CUSTOMER, VENDOR and ADMIN. Admin review is necessary for vendor approval, despite one section postponing it.
- Responsive layout, server validation, order history, ownership checks and meaningful tests are part of MVP.
- Preserve React, MySQL and Render from the source. Proposed additions are TypeScript, Express, Knex and server-side cookie sessions.
- One role/account, one shop/vendor and one shop/order. Default English, ZAR and Africa/Johannesburg display time; store timestamps in UTC.
- Use email login; no username or student-number dependency. Phone is required, normalized and unique per the source; implement clear validation and account-conflict messaging without revealing private account details.
- Public registration accepts only CUSTOMER or VENDOR. Create the first administrator with a trusted CLI using externally supplied credentials. Never seed a known admin password into production.
- No fake payment controls, fake notifications, fictional live metrics, hard-coded authorization or mock-only backend. Fictional seed data is development-only and clearly labelled.

## Stack and structure

For a new repository use React + TypeScript + Vite, React Router, TanStack Query for server state and a small reducer/context cart persisted locally. Use a coherent CSS token system and reusable accessible components. Backend: a supported Node LTS patch, Express, TypeScript, Zod, MySQL 8.4 InnoDB, Knex migrations/query builder and mysql2. Use a maintained session library and production MySQL session store. Check current official documentation, lock compatible dependency versions, and commit the lockfile and runtime pin.

Use a monorepo with `apps/web`, `apps/api`, `packages/contracts`, `db/migrations`, `db/seeds`, `tests/integration`, `tests/e2e`, `docs` and `infra`. API modules separate routes, schemas, controllers, services and repositories. Business rules belong in services; transactions use one connection throughout. Use bound queries only.

Production Express serves `/api/v1` and the built React assets from one origin. Development Vite proxies `/api` to the API. Missing API routes return JSON, not the SPA. MySQL and storage credentials stay server-side. Provide Docker Compose for local MySQL and a documented local storage adapter for development; production private documents require durable private object storage. Do not deploy to production or purchase resources just to complete implementation.

## Product journeys and pages

1. Guest/customer: discover approved shops by area/name/category, or search products across approved shops and compare displayed prices -> open shop -> browse products -> one-shop cart -> log in if needed -> review current prices, pickup address and notes -> place pickup order -> see real reference, status, items and history. Cross-shop product results include shop name, availability and price; do not imply differently named products are identical.
2. Vendor: register -> fill business profile/hours/address -> upload supporting documents -> submit -> see pending/rejected/approved state -> manage own products and stock -> accept/reject orders -> prepare -> ready -> confirm collection -> inspect collected-order summaries.
3. Admin: log in -> review exact vendor submission/document version -> approve/reject with reason -> suspend/reactivate shops/users -> moderate products/categories -> inspect audit history and resolve exceptional orders with reasons.

Build public `/`, `/shops`, `/shops/:slug`, `/search`, `/login`, `/register`, `/vendor/register`; customer `/cart`, `/checkout`, `/orders`, `/orders/:id`, `/account`; vendor `/vendor`, `/vendor/onboarding`, `/vendor/orders`, `/vendor/orders/:id`, `/vendor/products`, `/vendor/products/:id/edit`, `/vendor/inventory`, `/vendor/shop`, `/vendor/reports`; admin `/admin/vendors`, `/admin/vendors/:id`, `/admin/users`, `/admin/products`, `/admin/categories`, `/admin/orders/:id`, `/admin/audit`.

Use deep green `#145A43`, cream `#F7F8F2`, white surfaces, dark text `#17352B`, orange accent `#F0AD4E` with dark text, 12px cards, system UI font, 16px body text and at least 44px touch targets. Customer UI should reach shops quickly without a large decorative hero. Mobile customer navigation: Discover, Orders, Account, contextual cart. Vendor/admin desktop interfaces use side navigation and clear action queues; adapt tables to cards on small screens. Follow the wireframe references if attached.

Implement loading, empty, error, offline, unauthorized, validation and stale-data states. Preserve form input. Use keyboard-accessible dialogs, labels, visible focus and status text in addition to colour. Confirm replacing a cart from another shop. Show changed prices before a fresh submission. Use the wording “Place pickup order” and “Pay at collection”; do not invent a preparation estimate. Only a vendor can confirm collection. Poll visible active orders about every 15 seconds, back off on errors, pause in hidden tabs and stop terminal polling.

## Database

Implement versioned migrations and documented relationships for:

- `users`: UUID id, full name, normalized unique email and phone, password hash VARCHAR(255), role enum, ACTIVE/INACTIVE status, timestamps.
- `sessions`: library-compatible durable schema with expiry and user association or auth-version revocation.
- `shops`: UUID id, unique owner FK and slug, name, description, contact, pickup address, area, timezone, validated hours JSON, approval status DRAFT/PENDING/APPROVED/REJECTED/SUSPENDED, pause switch, review version, optimistic version and review metadata.
- `vendor_applications`: unique shop/submission version, immutable profile snapshot, status, submission/reviewer/time/reason.
- `vendor_documents`: shop/submission version, document type, private object key, detected MIME, byte size, original safe name and timestamps. Preserve submitted versions.
- `categories`: name, unique slug, active flag.
- `products`: shop/category FKs, name/description, DECIMAL(10,2) positive price, integer non-negative available quantity and low-stock threshold, image key, visibility, admin moderation flag, archive timestamp and optimistic version.
- `orders`: unique UUID and random human reference, customer/shop FKs, state, DECIMAL total, ZAR currency, notes, shop-name/pickup-address snapshots, expiry, collection time, optimistic version and timestamps.
- `order_items`: order/product FKs, name and unit-price snapshots, quantity, line total, restocked quantity and written-off quantity. Unique product per order.
- `order_events`: append-only status changes, actor/system, reason and inventory disposition; keep internal details private.
- `inventory_movements`: product, optional order, actor/system, RESERVE/RELEASE/ADJUST, signed delta, available-after quantity, reason and time. Unique order/product/type for reservation/release.
- `idempotency_requests`: user, operation, key, canonical request hash, result/resource, creation/expiry. Unique user/operation/key. Keep checkout keys with their orders.
- `audit_events`: append-only actor, action, entity, safe metadata and timestamp.
- `auth_rate_limits`: expiring persistent account/IP failure counters without passwords.

Add foreign keys, meaningful indexes, CHECK constraints and application validation. Use utf8mb4. Archive products and deactivate users; do not destroy order history. Prevent deactivating the last active admin. Money is a decimal string at API boundaries and DECIMAL in MySQL; calculate using exact decimals or checked integer cents. No floating-point totals. Proposed limits: 50 distinct products/order, quantity 1..99, notes 500 characters. The server sets customer ID, owner, status, totals and timestamps.

Create a draft vendor application before its document uploads, link documents to its unique shop/submission version, and freeze the profile/document references on submission. Admin decisions update application and shop atomically. Vendor-account deactivation takes the owned shop lock before changing account status, to serialize with checkout.

## Order state machine and inventory

Use PENDING -> ACCEPTED -> PREPARING -> READY -> COLLECTED. PENDING can become REJECTED, CANCELLED or EXPIRED. ACCEPTED can become CANCELLED by vendor/admin. PREPARING and READY can become CANCELLED by vendor/admin only with a reason and explicit per-item resalable quantities. Terminal states cannot transition.

Customers may cancel only their own PENDING orders. Proposed pending timeout is 15 minutes, configurable. Vendor acceptance checks expiry in its transaction. An idempotent expiry job runs at least once a minute and catches up after restarts. Do not expire accepted/preparing/ready orders automatically.

Available stock is reduced exactly once when an order is created, including pending orders. Collection does not subtract again. Rejection, pending expiry and cancellation before preparation restore all reserved units once. Cancellation after preparation restores only units the vendor/admin explicitly marks resalable; record the remainder as written off. Never automatically restock prepared food. Vendor inventory changes use a signed adjustment, reason and expected version; never apply a stale absolute count.

## Atomic checkout and retries

Require a customer session, CSRF token, `Idempotency-Key` and a body containing shopId, item productId/quantity/expectedUnitPrice and optional notes. The client generates one key per submission and reuses it after a timeout. Same key and same canonical content returns the same order; different content returns 409. Enforce uniqueness in MySQL, not only application memory.

In one database transaction: claim the idempotency record; lock the shop; lock products in sorted ID order; recheck account/shop approval, owner activity, hours, pause state, visibility, ownership, current prices and stock; calculate authoritative totals; insert order/item snapshots; reserve stock with non-negative conditional updates; write inventory movements and order event; complete the idempotency response; commit. Any failure rolls back everything.

A quote endpoint does not reserve stock. Checkout repeats all checks inside the transaction. If prices differ from reviewed prices, return 409 CART_CHANGED with refreshed details; the customer reviews and submits a new key. Never silently charge a higher amount or submit a partial order. Clear local cart only after confirmed success. On ambiguous failures show that order status is being checked and retry using the same key.

Apply compatible lock ordering to every mutation: idempotency record when used -> shop -> existing order -> sorted products. Lock then recheck ownership/version. Use bounded deadlock retries and real MySQL concurrency tests. Stock release and transition must commit together, so repeated cancellation/expiry cannot release twice.

Only approved, active, open, unpaused shops with active owners accept new orders. Shop suspension/approval and checkout must serialize through the shop row. Suspended shops cannot accept new orders, but active vendors can resolve existing orders. Deactivated users lose sessions; admin can resolve outstanding orders. Material identity/address/document changes require a new review version and approval; ordinary contact/hours changes do not. Review actions must reject stale versions.

## APIs and authorization

Implement `/api/v1` routes for auth/CSRF/me/logout, account profile/password; public shops/categories/products; checkout quote; customer orders/history/cancellation; vendor shop/onboarding/documents/products/images/stock adjustments/orders/transitions/reports; admin vendor decisions/document downloads/users/product moderation/categories/order support/audit; liveness/readiness. The detailed route list is in `01_SYSTEM_BLUEPRINT.md` if available. Generate an accurate OpenAPI document and examples from the actual implementation.

All list endpoints have bounded pagination/filter validation. All individual resources enforce server-side role and ownership. Customer cannot read another customer's order; vendor cannot mutate another shop or access customer/admin APIs. Unknown writable fields are rejected. Admin actions require explicit permissions and audit reasons; do not implement user impersonation.

Return consistent data/error envelopes, request IDs, 401/403/404 appropriately, 409 for stale versions/state/cart/idempotency conflicts, 422 validation, 429 throttling and 503 temporary dependency issues. Use UUID strings, decimal strings and UTC ISO timestamps. Never return password hashes, session secrets or unrestricted document keys.

## Security and operations

Use bcrypt through a maintained library, proposed work factor 12 after measuring acceptable latency. Require at least 12 password characters, support spaces, reject values beyond bcrypt's 72-byte UTF-8 limit without silent truncation. Generic login errors; proposed five failures/15 minutes followed by a temporary 15-minute account/IP throttle. Persistent counters must survive process restart.

Use secure HttpOnly SameSite=Lax server-session cookies; production `__Host-` prefix, Path=/, no Domain, HTTPS and narrowly configured trusted proxy. Rotate at login; proposed 30-minute idle and 8-hour absolute expiry. Logout, password change and deactivation invalidate sessions server-side. Do not store auth tokens in localStorage. Use synchronizer CSRF tokens and Origin checks for mutations, including login. SameSite alone is insufficient.

Private document uploads: proposed maximum 10 MB, PDF/JPEG/PNG, verify signatures, random keys and authorized downloads/60-second URLs. Product images: 2 MB, JPEG/PNG/WebP, re-encode and strip metadata. Never expose identity documents in public URLs, logs or seed data. Keep submitted document versions immutable. Document malware-scan deployment choices. Redact credentials/tokens/full signed URLs from logs. Add appropriate CSP/security headers and size limits.

Keep Render deployment configuration and a production runbook. Use persistent MySQL storage and separate durable object storage; do not claim the full system runs reliably on a free tier. If self-hosting MySQL on Render, follow current official guidance, mount `/var/lib/mysql`, keep it private and use native database backups with a restore drill. An external managed MySQL option must be explicit. Do not silently substitute PostgreSQL. Include `.env.example` placeholders, health checks, migration procedure, staging separation, backup/restore and rollback instructions. No secrets in client variables or git.

Reports use only COLLECTED orders and collection timestamps, with local-day boundaries converted to UTC. Label sums “Collected-order value”, since payment is outside the platform. Do not display cancelled/rejected/pending totals as revenue.

## Build sequence and definition of done

Implement phases: 0 repository audit and decisions; 1 foundation/migrations/design system; 2 auth/vendor approval/admin; 3 catalogue/inventory/cart; 4 atomic ordering/state/expiry; 5 complete dashboards/history/reports/accessibility; 6 CI/deployment readiness. Each phase should leave working code and tests, not detached mock screens. Continue through phases unless a genuine external dependency blocks the next step; complete independent work first and identify the exact missing value/action.

Required verification includes:

1. Clean install/migration/seed/build and production-mode startup.
2. Customer/vendor/admin end-to-end journeys on mobile and desktop.
3. Real MySQL race for the last item: exactly one order and no negative stock.
4. Duplicate/lost-response checkout: one reservation/order; payload mismatch returns 409.
5. Mid-transaction failure rollback; price/stock changes require review.
6. Legal/illegal transitions, stale versions, expiry-versus-accept race and double cancellation.
7. Partial resalable restock after preparation and preserved historical snapshots.
8. Cross-user/cross-vendor access denial; public admin signup rejection; CSRF/mass-assignment rejection.
9. Session revocation, upload privacy, suspension versus checkout, offline/reconnect behaviour.
10. Collected-only reports/timezone boundaries, accessible keyboard navigation, 360px and 1280px layout checks.

Use Vitest/Testing Library, API tests against disposable MySQL and Playwright as appropriate. Do not replace database tests with SQLite or mocks for concurrency. Configure CI to lint, typecheck, test, build and run critical browser journeys. Supply development seed data with separate users/shops but require explicit demo mode; never populate production with test accounts automatically.

Provide runnable scripts for dev, build, start, lint, typecheck, tests, database migration, demo seed and trusted admin bootstrap. The README must explain exact commands, environment configuration and how to exercise all three roles. Record known blockers honestly, especially production storage, email account recovery, real vendor document requirements, operating policy and hosting budget. These need operator decisions before public launch, not fake implementations.

At completion summarize implemented behaviour, files, actual checks run/results, startup instructions and unresolved risks. Do not claim production deployment, security certification or passing tests unless verified. If interrupted, leave precise next steps in `docs/implementation-status.md` so the next session continues without restarting.

**PROMPT END**
