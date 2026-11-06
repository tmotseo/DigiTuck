# DigiTuck - system blueprint

Version 1.0 | 5 November 2026 | Proposed implementation baseline

Prepared from `PHASE4-DigiTuck.pdf`, 22 pages. Page references below use physical PDF page numbers. This blueprint resolves conflicting requirements; decisions marked **proposed** need product-owner confirmation before a live launch. The pack is a design and implementation brief, not a built or tested application.

## 1. Product and first release

DigiTuck helps customers find a local tuckshop, check its products and prices, place an order, and collect it when ready. Vendors maintain stock and fulfil orders. Administrators review vendor applications and handle account or catalogue moderation.

**MVP: one shop per order, collection only, payment arranged with the shop at collection.** The application does not process, verify, or reconcile payments. Use ZAR, English, and Africa/Johannesburg for business display time as proposed launch defaults. Store timestamps in UTC.

### Scope decisions and specification corrections

| ID | Source issue | Implementation decision | Basis |
|---|---|---|---|
| D01 | pp.3-4 exclude delivery/payments; pp.8-9 and 17 include them | No delivery drivers, delivery address, payment gateway, payment table, or payment form in MVP | Follow explicit first-release scope |
| D02 | p.4 postpones admin; pp.2, 15, 19-22 require approval | Include a small admin console: review vendors, suspend accounts/shops, moderate products, inspect audit history | Approval cannot function without it |
| D03 | p.4 puts responsiveness, validation, testing and history in future work | Include these baseline qualities and basic order history now | Needed for usable and verifiable ordering |
| D04 | p.5 labels React in presentation and application layers | Keep React in the browser; introduce Express server services for business rules and database access | React alone is not the proposed API layer |
| D05 | pp.10-11 define only four entities | Add shops, categories, documents, sessions, events, stock ledger, idempotency and audit records | Supports actual workflows and ownership |
| D06 | pp.4, 10 and 19 use different order statuses | Use PENDING, ACCEPTED, PREPARING, READY, COLLECTED, REJECTED, CANCELLED, EXPIRED | One shared state machine; expiry is proposed |
| D07 | pp.15 and 17 mention separate admin records, student numbers and username login | One users table, email login, no student number or username requirement | Avoid duplicate auth and unsupported fields |
| D08 | p.15 proposes permanent user deletion; history is required elsewhere | Deactivate users; archive products; preserve order snapshots and audit history | Historical records must remain understandable |
| D09 | p.21 says admin cannot access other vendors' dashboards | Apply ownership limits to vendors; admin uses explicit, audited moderation endpoints | Resolves conflict with admin role elsewhere |
| D10 | p.22 suggests JWT; p.20 asks secure sessions | Proposed: server-side sessions in MySQL, secure cookies, CSRF protection and server-side logout | Simpler revocation for one browser application |
| D11 | p.11 avoids duplicated names; p.14 requires line prices | Snapshot product name, unit price, shop name and pickup address on the order | Intentional historical data, not mutable catalogue duplication |
| D12 | p.7 says save cart when offline | Save only cart IDs, quantities and cached display values locally; revalidate online; never silently submit offline orders | Avoid stale stock and unexpected orders |
| D13 | pp.19-20 call reports sales reports | Report collected-order value, order counts and product quantities; label value as unverified against payment | No payment ledger exists in MVP |

### Include now

Customer/vendor registration and login; role/ownership enforcement; vendor application and private supporting documents; admin review; approved shop discovery; name/area/category search; catalogue and product images; single-shop cart; server checkout validation; order reference and status timeline; basic history; vendor products, stock, opening hours, pause switch and fulfilment queue; simple collected-order reports; secure sessions; audit records; automated critical-path tests; documented deployment and backups.

### Later releases

Online payments and refunds; delivery and driver accounts; multi-shop checkout; map/geolocation search; native apps; SMS/WhatsApp/email campaigns; loyalty/reviews; staff accounts and multi-branch vendors; advanced analytics. Do not expose fake controls for these in MVP. Account recovery by verified email is a separate pre-public-launch decision because no email service is specified.

## 2. Actors, permissions and boundaries

| Capability | Guest | Customer | Vendor | Admin |
|---|---|---|---|---|
| Browse approved active shops and visible products | Yes | Yes | Yes | Yes |
| Save a local browsing cart | Yes | Yes | No purchase role | No purchase role |
| Submit/read/cancel customer orders | No | Own only; cancellation rules apply | No | Read for support; exceptional cancellation with reason |
| Edit shop profile, hours, products and available stock | No | No | Own shop; draft management allowed while pending | Moderate via dedicated audited actions |
| Read fulfilment queue and advance orders | No | No | Own shop only | Support access; no vendor impersonation |
| Upload/review verification documents | No | No | Own upload and status only | Review privately |
| Approve, reject or suspend shops | No | No | No | Yes, with reason and audit |
| Manage users/categories and inspect audit trail | No | No | No | Yes |
| Grant admin role | No | No | No | Trusted operator CLI only in MVP |

Proposed: one role per account, one shop per vendor. Vendors cannot grant themselves approval or change their role. There is no public admin sign-up. Seed an initial admin through a documented command using a secret supplied outside source control. An admin cannot deactivate the last active administrator. Deactivation revokes sessions. Return 404 for inaccessible individual resources where exposing existence would leak information.

## 3. Navigation and page inventory

Public routes: `/`, `/shops`, `/shops/:slug`, `/login`, `/register`, `/vendor/register`.

| Area | Route | Main task and required states |
|---|---|---|
| Discover | `/shops?area=&q=&category=` | Area selector, search, approved shop cards, open/closed, empty results, retry |
| Product search | `/search?q=&area=&category=` | Products across approved shops with shop name, price and availability for comparison; no claim that differently named products are identical |
| Shop catalogue | `/shops/:slug` | Pickup location, hours, categories, product price and availability, paused notice |
| Cart | `/cart` | Quantities, one-shop constraint, remove/clear, updated totals, stale/stock warning |
| Checkout | `/checkout` | Confirm pickup location and order notes, current prices, no payment form |
| Confirmation | `/orders/:id` | Reference, actual status, item snapshots, address, cancellation and retry state |
| Customer history | `/orders` | Own orders, date/status filters, paginated results, empty state |
| Profile | `/account` | Name, phone, password change, logout; email read-only until verification flow exists |
| Vendor onboarding | `/vendor/onboarding` | Shop details, document checklist, submit, pending/rejected/approved state |
| Vendor dashboard | `/vendor` | Pending count, ready count, low stock and actionable queue |
| Vendor orders | `/vendor/orders` and `/:id` | Tabs by status, items, notes, age, allowed actions, version conflict feedback |
| Vendor catalogue | `/vendor/products` and `/:id/edit` | Create/edit/archive, category, image, price, visibility, validation |
| Inventory | `/vendor/inventory` | Available stock, low stock filter, adjustment with reason and version check |
| Business | `/vendor/shop` | Contact, pickup address, area, hours and pause switch; material changes trigger review |
| Reports | `/vendor/reports` | Date range, collected count/value, best-selling quantities; no payment claims |
| Admin queue | `/admin/vendors` and `/:id` | Review submitted details/documents, approve/reject with reason |
| Admin users | `/admin/users` | Search, role/status, deactivate/reactivate with reason, session revocation |
| Admin moderation | `/admin/products`, `/admin/categories` | Hide/restore product with reason; manage categories |
| Admin support | `/admin/orders/:id` | Inspect history; exceptional cancel under normal stock-disposition rules |
| Admin audit | `/admin/audit` | Actor, action, resource and time filters, paginated history |

Customer mobile navigation: Discover, Orders, Account; a contextual cart button displays item count. Vendor desktop navigation: Overview, Orders, Products, Inventory, Reports, Business. Admin: Vendor reviews, Users, Products, Categories, Audit. All protected routes validate the session on load; frontend guards are convenience, not authorization.

## 4. Proposed UI design

Direction: warm, practical and trustworthy. Use a cream background, deep green navigation/actions, orange accents, clear prices, compact product cards and large touch targets. Avoid imagery-heavy hero sections: customers should reach shops quickly on mobile data. Illustrative wireframes in the PDF use fictional shop names, prices and orders; they are not live data.

| Token | Value / rule |
|---|---|
| Background / surface | `#F7F8F2` / `#FFFFFF` |
| Primary / primary hover | `#145A43` / `#0D4030` |
| Text / secondary text | `#17352B` / `#56665E` |
| Accent / border | `#F0AD4E` / `#DCE4DD`; dark text on orange |
| Error / information | `#B42318` / `#175CD3`; include labels/icons |
| Typography | System UI sans; 16px body; 14px helper; 24-32px section titles |
| Spacing / radii | 4px spacing scale; 12px cards; 8px fields/buttons |
| Layout | Mobile 320-767px; tablet 768-1023px; desktop 1024px+; max width 1200px |
| Interaction | Minimum 44px touch target; visible focus; keyboard operation; no hover-only actions |

Required components: AppShell, RoleNavigation, AreaSelector, SearchField, ShopCard, ProductCard, QuantityStepper, CartSummary, OrderTimeline, StatusBadge, OrderQueueCard, DataTable, FormField, DocumentChecklist, ConfirmationDialog, Toast/InlineAlert, Pagination and EmptyState.

Screen rules: announce status updates with restrained aria-live; show skeletons for initial loads, preserve content during refresh, and show retry after failures. Do not communicate order state by colour alone. Confirm replacement when a customer adds an item from another shop. Show old/new price side by side when checkout changes. Preserve entered form data after validation errors. Use explicit verbs: “Place pickup order”, “Accept order”, “Mark ready”, “Confirm collected”. Collection requires a vendor confirmation, never a customer self-complete button. No fabricated countdown estimates: preparation estimate is optional and vendor supplied.

Offline: display “You are offline. Your cart is saved on this device.” Disable checkout until online and revalidate on reconnection. After a request times out, say “Checking whether your order was placed” and retry with the same idempotency key. Never announce success before the server confirms it.

## 5. Technical architecture

Preserve the specified React, MySQL and Render choices. Proposed greenfield implementation:

| Layer | Technology | Responsibility |
|---|---|---|
| Browser | React + TypeScript + Vite | Responsive application, React Router, accessible forms, local cart |
| Remote state | TanStack Query | Fetching, caching, invalidation, polling and request-state UI |
| API | Node.js supported LTS + Express + TypeScript | REST controllers, auth, permissions, application services |
| Validation | Zod shared request schemas | Reject unknown writable fields and invalid input on the server |
| Persistence | MySQL 8.4 InnoDB; Knex + mysql2 | Migrations, bound queries, transactions, locking, repositories |
| Sessions | Maintained express-session-compatible MySQL store | Server-side session persistence and revocation |
| Files | Object storage with private documents and controlled image access | Durable media outside ephemeral web-service storage |
| Tests | Vitest, React Testing Library, API integration tests, Playwright | Business rules, real MySQL concurrency, complete journeys |
| Delivery | GitHub checks + Render web service | Build React, serve assets and API from one origin |

Pin a currently supported Node LTS patch compatible with chosen packages; check official requirements when creating the repository, commit a lockfile and runtime version, and use `npm ci` in CI. Do not assume “latest” package APIs match examples. Keep existing compatible project choices if a repository already exists; report material conflicts before replacing a framework.

Production: browser --HTTPS--> Express (`/api/v1` + built React assets) --private network/TLS as appropriate--> MySQL. Express also accesses object storage using server credentials. No database connection strings or storage secrets reach the browser. For development, proxy `/api` through Vite to Express. SPA fallbacks must not turn missing API routes into HTML responses.

Suggested repository:

```text
apps/web/src/{app,features,components,lib,styles}
apps/api/src/{routes,middleware,modules,db,jobs,lib}
packages/contracts/src/
db/{migrations,seeds}/
tests/{integration,e2e}/
docs/{decisions,api,runbooks}/
infra/
```

Within each API module: router -> request schema -> controller -> service -> repository. Controllers do not perform ad-hoc SQL. Services own business transactions. All queries in a transaction use the transaction connection. A background expiry loop can run in the API for the initial single-instance deployment; the same idempotent job must also have a CLI entry point and catch up after restarts.

## 6. Data model and constraints

Use UUID identifiers exposed as strings; a human order reference is separate, randomly generated and unique (for example `DT-K7Q9M2XA`), and is not an access credential. Foreign keys use RESTRICT for historical business records. Names and addresses use UTF-8 (`utf8mb4`). Soft-archive products. Do not store passwords, uploaded files or sessions in frontend localStorage.

| Entity | Core fields | Keys / checks |
|---|---|---|
| users | id, full_name, normalized_email, normalized_phone, password_hash, role, status, created_at, updated_at | Unique email/phone; role CUSTOMER/VENDOR/ADMIN; status ACTIVE/INACTIVE; hash VARCHAR(255) |
| sessions | Maintained session-store schema plus user association or auth-version strategy | Expiry index; logout, password change and deactivation invalidate sessions |
| shops | id, owner_id, slug, name, description, phone, address, area, timezone, hours_json, approval_status, is_paused, review_version, version, rejection_reason, reviewed_by, reviewed_at, submitted_at | Unique owner/slug; approval DRAFT/PENDING/APPROVED/REJECTED/SUSPENDED |
| vendor_applications | id, shop_id, submission_version, profile_snapshot_json, status, submitted_at, reviewed_by, reviewed_at, decision_reason | Unique shop/version; immutable submitted profile; review references this exact version |
| vendor_documents | id, shop_id, submission_version, type, object_key, original_name, detected_mime, bytes, uploaded_at, superseded_at | Private random object key; indexed shop/version; immutable submitted version |
| categories | id, name, slug, is_active | Unique slug; disable rather than break referenced products |
| products | id, shop_id, category_id, name, description, price, available_qty, low_stock_threshold, image_key, is_visible, moderation_hidden_at, archived_at, version, created_at, updated_at | DECIMAL(10,2) price > 0; stock/threshold integers >= 0; indexed shop/category/visibility |
| orders | id, reference, customer_id, shop_id, status, total_amount, currency, notes, shop_name_snapshot, pickup_address_snapshot, expires_at, collected_at, version, created_at, updated_at | Unique reference; ZAR; total > 0; indexes (customer_id,created_at), (shop_id,status,created_at), (status,expires_at) |
| order_items | id, order_id, product_id, name_snapshot, unit_price, quantity, line_total, restocked_qty, written_off_qty | Unique order/product; quantity 1..99; decimal prices; disposition cannot exceed quantity |
| order_events | id, order_id, actor_id nullable for system, from_status, to_status, reason, restock_detail_json, created_at | Append-only; indexed order/time; never expose internal notes to customers |
| inventory_movements | id, product_id, order_id nullable, actor_id nullable, type, quantity_delta, available_after, reason, created_at | RESERVE, RELEASE, ADJUST; unique order/product/type for order movements; stock >= 0 |
| idempotency_requests | id, user_id, operation, key, request_hash, resource_id, response_status, response_json, created_at, expires_at | Unique (user_id,operation,key); checkout key retained with order; redact responses |
| audit_events | id, actor_id nullable, action, entity_type, entity_id, safe_metadata_json, created_at | Append-only; no raw credentials, tokens or document contents |
| auth_rate_limits | hashed_account_key, hashed_ip_key, window_start, failure_count, blocked_until | Expiring persistent counters; no plaintext attempted passwords |

Order items intentionally snapshot names/prices. Shop name and pickup address are also frozen at order placement. The current shop can still show contact updates separately. Currency values are decimal strings in JSON (`"25.00"`), stored as DECIMAL, and calculated with an exact decimal library or checked integer cents. Never use binary floating-point arithmetic for totals. Limits proposed: 50 distinct products/order, quantity 1..99 per line, notes <= 500 characters; reject totals outside database precision.

No carts table is required for the local-cart MVP. No Payments, Deliveries or Driver entities. Document types are configurable; the specification does not establish a statutory document checklist. Business hours are a validated weekday schedule in shop timezone; MVP intervals remain within a day, with overnight hours split across days.

Create a draft vendor application version before uploading its documents. Link documents to the application through a foreign key on shop/submission version; freeze both profile and document references on submission. An admin decision updates the application and shop state in one transaction. Submitted versions remain readable for audit even after a replacement application.

## 7. Ordering, stock and status rules

### Order state transitions

| From | To | Actor and condition | Stock effect |
|---|---|---|---|
| New request | PENDING | Customer; approved, active, open, unpaused shop; current prices and stock | Reserve by subtracting available stock once |
| PENDING | ACCEPTED | Owner vendor before expires_at | None |
| PENDING | REJECTED | Owner vendor, reason required | Return all reserved quantities once |
| PENDING | CANCELLED | Customer owns order; or vendor/admin with reason | Return all reserved quantities once |
| PENDING | EXPIRED | System at expires_at; proposed 15-minute timeout | Return all reserved quantities once |
| ACCEPTED | PREPARING | Owner vendor | None |
| ACCEPTED | CANCELLED | Vendor/admin with reason | Return all reserved quantities once |
| PREPARING | READY | Owner vendor | None |
| READY | COLLECTED | Vendor confirms actual handover | None; reservation becomes collected sale quantity |
| PREPARING or READY | CANCELLED | Vendor/admin; reason and per-item resalable quantities required | Return only explicitly resalable units; record remainder as written off |

Terminal states COLLECTED/REJECTED/CANCELLED/EXPIRED cannot change. Customer cannot cancel after acceptance. An exceptional admin cancellation follows the same inventory rules and writes an audit event. Cancelling prepared food must not automatically put it back on sale. No auto-expiry after acceptance in MVP; vendors resolve uncollected orders explicitly. Expose the pending deadline to both customer and vendor. Check expiry inside accept/cancel transactions, not only in the scheduled job.

### Checkout transaction

1. Authenticate active customer, validate CSRF and request schema; coalesce/reject duplicate product IDs deterministically. Require `Idempotency-Key` and a canonical request hash. No client-provided owner/customer/role/status is trusted.
2. Begin one transaction. Claim the idempotency record with a database unique constraint. A simultaneous identical request waits/replays the committed result; same key with different content returns 409. Roll back failed mutations. Do not create a second order after an ambiguous network response.
3. Lock the shop row, then requested product rows in ascending ID order. Recheck shop approval, owner activity, opening hours, pause state, product visibility/moderation and product ownership inside the transaction.
4. Compare client-reviewed unit prices against current database prices. If any differ, return `CART_CHANGED` (409) with the refreshed cart; customer must review and submit a new key. Reject unavailable or insufficient items without partial orders.
5. Calculate exact line totals and total. Insert order and snapshots, reserve stock with conditional non-negative updates, write RESERVE movements and initial event, complete the idempotency record, then commit. A failure rolls everything back.
6. Return the confirmed order ID/reference/status. Clear the local cart only after confirmed success. Poll visible active orders every 15 seconds; back off on errors and stop when hidden or terminal.

Global lock ordering: idempotency record (when applicable), shop, existing order, then product IDs ascending. Read IDs without locking as necessary, then lock and recheck ownership. Inventory adjustments, moderation actions affecting orderability, status transitions and expiry must use compatible ordering. Retry deadlocks a small bounded number of times; use the same request key. Test on MySQL, not SQLite.

### Concurrency and recovery

Stock is **available to order**, not a physical-stock count. Reserving 3 out of 10 makes availability 7. Collection leaves 7. Full cancellation restores 10 once. A partial restock of 1 after preparation leaves availability 8 and writes off 2. Vendor stock changes are signed adjustments with a reason and expected version, not stale absolute overwrites. REST writes use expectedVersion; stale edits/status changes return 409 and updated state.

Shop suspension prevents new checkout immediately. An active vendor can still view and resolve existing orders under suspension; a deactivated vendor cannot log in, so admin handles pending orders. Do not silently cancel all orders as a side effect of a profile change. Approval/ordering races serialize through the shop lock; vendor-account deactivation must also lock the owned shop before changing the account state so it serializes with checkout. Material changes to legal owner, business identity, address or documents create a new review version and return the shop to PENDING; public visibility/ordering resumes only after review. Contact/hours/pause changes do not require reapproval. Preserve the submitted review version so an admin cannot approve a moving target.

## 8. REST API contract

Prefix `/api/v1`. Use JSON, UUID strings, UTC ISO timestamps and decimal strings. Success `{ "data": ..., "meta": ... }`; failure `{ "error": { "code": "...", "message": "...", "fieldErrors": {...}, "requestId": "..." } }`. Pagination defaults 20, max 100; validate filters and sort enums. Never return password hashes, session values or object-storage secrets.

| Method and path | Access | Purpose |
|---|---|---|
| GET `/auth/csrf` | Public session | Issue CSRF token for subsequent mutations |
| POST `/auth/register` | Public + CSRF + rate limit | CUSTOMER or VENDOR only |
| POST `/auth/login` | Public + CSRF + rate limit | Email/password; regenerate session |
| POST `/auth/logout` | Session + CSRF | Destroy server session, expire cookie |
| GET `/auth/me` | Session | Current safe user and shop state |
| PATCH `/account` | Session + CSRF | Own name/phone only |
| POST `/account/password` | Session + CSRF | Verify current password, replace hash, revoke other sessions |
| GET `/shops`, `/shops/:slug`, `/shops/:slug/products` | Public | Approved active shops; search/filters |
| GET `/products?q=&area=&category=` | Public | Paginated matching products from approved active shops; include shop, price and availability for comparison |
| GET `/categories` | Public | Active categories |
| POST `/checkout/quote` | Customer + CSRF | Validate draft and return current prices; does not reserve |
| POST `/orders` | Customer + CSRF + idempotency | Atomic pickup checkout |
| GET `/orders`, `/orders/:id` | Customer owner | History/status and snapshots |
| POST `/orders/:id/cancel` | Customer owner + CSRF | Pending-only cancellation, expectedVersion |
| GET/PUT `/vendor/shop` | Vendor owner + CSRF on PUT | Own profile/hours/pause; material-change review rules |
| POST `/vendor/documents` | Vendor owner + CSRF | Validated multipart private upload |
| GET/DELETE `/vendor/documents/:id` | Vendor owner | Metadata/delete only draft unused document; CSRF on DELETE |
| POST `/vendor/shop/submit` | Vendor owner + CSRF | Freeze review version; required fields/docs validation |
| GET/POST `/vendor/products` | Vendor owner | List/create; CSRF on POST |
| PATCH/DELETE `/vendor/products/:id` | Vendor owner + CSRF | Update/archive, expectedVersion |
| POST `/vendor/products/:id/image` | Vendor owner + CSRF | Validate/re-encode image; replace key safely |
| POST `/vendor/products/:id/stock-adjustments` | Vendor owner + CSRF + idempotency | Delta/reason/expectedVersion; audited |
| GET `/vendor/orders`, `/vendor/orders/:id` | Vendor owner | Fulfilment queue/details |
| POST `/vendor/orders/:id/transitions` | Vendor owner + CSRF | Allowed next status, reason/disposition/version |
| GET `/vendor/reports` | Vendor owner | Collected-order aggregates by bounded date range |
| GET `/admin/vendors`, `/admin/vendors/:id` | Admin | Review queue and exact submission version |
| GET `/admin/documents/:id/download` | Admin | Private authorized attachment or short-lived URL |
| POST `/admin/vendors/:id/decision` | Admin + CSRF | Approve/reject/suspend/reactivate; version/reason |
| GET `/admin/users` | Admin | Paginated safe user search |
| PATCH `/admin/users/:id/status` | Admin + CSRF | Deactivate/reactivate; revoke sessions; reason |
| GET `/admin/products`; PATCH `/admin/products/:id/moderation` | Admin | Search; hide/restore with reason and CSRF |
| POST `/admin/categories`; PATCH `/admin/categories/:id` | Admin + CSRF | Create/update/deactivate categories |
| GET `/admin/orders/:id`; POST `/admin/orders/:id/cancel` | Admin | Support read; exceptional cancel with CSRF/reason/disposition |
| GET `/admin/audit` | Admin | Paginated audit filters |
| GET `/health/live`, `/health/ready` | Infra | Process health / required dependencies; no secret diagnostics |

Status codes: 201 create; 200 read/update/replay; 204 logout/archive where appropriate; 400 malformed; 401 no valid session; 403 wrong role/CSRF; 404 absent/inaccessible resource; 409 version, cart, idempotency or state conflict; 422 field/business validation; 429 throttled; 503 temporary dependency failure. Retried successful checkout may return original 201 or documented 200; pick one in OpenAPI and test it.

Example POST `/orders`:

```json
{
  "shopId": "shop-uuid",
  "items": [
    {"productId": "product-uuid", "quantity": 2, "expectedUnitPrice": "25.00"}
  ],
  "notes": "Please pack together."
}
```

Header `Idempotency-Key: <UUID generated once for this submission>`. UUID strings above are descriptive placeholders; actual fixtures must contain valid UUIDs. The server sets customer ID, order status, totals, timestamps and pickup snapshots. Quote is advisory; POST `/orders` must repeat every validation atomically.

## 9. Security and reliability

Use a maintained password hashing library. To follow the source's bcrypt choice, use an appropriate measured work factor (proposed 12), enforce the library's 72-byte UTF-8 limit without truncation, require at least 12 characters and allow spaces. Generic login failures must not reveal account existence. Five failed attempts in 15 minutes trigger a proposed temporary 15-minute throttle with account and IP controls; successful authentication resets appropriate counters. Do not permanently lock accounts based on unauthenticated requests.

Use a maintained server-session implementation and MySQL store, not Express MemoryStore in production. Set Secure, HttpOnly, SameSite=Lax, Path=/ and no Domain in production; use `__Host-` cookie prefix there. Configure trusted proxy narrowly for Render. Rotate the session at login and privilege changes; enforce a proposed 30-minute idle limit and 8-hour absolute lifetime; destroy on logout and revoke on password/status changes. Use a synchronizer CSRF token plus Origin checks on mutations, including login. SameSite is an additional protection, not the whole defence. Do not put auth tokens in localStorage.

Every resource action checks role, active account and ownership on the server. Use explicit write-field allowlists to prevent changes to roles, approval or totals. Parameterize SQL; avoid concatenated search/sort fragments. Use output encoding, a restrictive practical CSP, security headers, request-size limits and dependency review. Keep sensitive pages/API responses private/no-store; cache versioned public assets separately.

Documents: proposed 10 MB max, PDF/JPEG/PNG only; verify file signatures, sanitize names and store under random private keys. Product images: proposed 2 MB max, JPEG/PNG/WebP, decode/re-encode and strip metadata. Reject SVG/HTML/executable content. Authorize every document request and use attachment disposition or expiring links (proposed 60 seconds); do not embed identity documents in public pages or logs. Add malware scanning where the deployment supports it and document that deployment decision. Uploaded files are not served from a public web directory.

Logs contain request IDs, action/status and durations; redact passwords, session IDs, CSRF tokens, full document URLs and unnecessary personal details. Audit approval, suspension, stock adjustments, moderation and exceptional order actions. Handle uncertain responses through idempotency, not optimistic success. Restrict database credentials to required privileges; use a separate migration role where practical.

## 10. Deployment and operations

Keep Render as the specified hosting target. One Render web service can build and serve the frontend and API. Use a private MySQL service with a persistent disk, or an explicitly chosen externally managed MySQL provider; record which. Render's documented self-hosted MySQL setup is not a managed MySQL service. Do not silently change to PostgreSQL for a free tier.

Render filesystems are ephemeral outside an attached persistent disk. Persistent disks require an eligible paid service, and free web services do not support them. Store durable documents/images in object storage. Do not promise that the complete production system is free. Free web services can sleep when idle; assess this before using them for vendor order queues. Pricing and limits must be rechecked at purchase time. [S1-S3]

For MySQL on Render, mount the data disk at the documented `/var/lib/mysql`, keep access internal, and configure native database backups to a separate durable destination. A raw disk snapshot is not a substitute for a tested MySQL backup/restore procedure. Target daily backups and a monthly restore exercise as proposed operating defaults; recovery targets remain a product-owner decision. [S1]

Document environment variables: `NODE_ENV`, `PORT`, `APP_ORIGIN`, `DATABASE_URL`, `SESSION_SECRET`, trusted proxy settings, storage endpoint/region/bucket/credentials, pending timeout, session expiry and logging level. Supply `.env.example` with placeholders, never real credentials. Server secrets must never use frontend-exposed variable prefixes.

CI gate: install from lockfile -> lint -> typecheck -> unit tests -> real MySQL integration tests -> production build -> Playwright critical journeys. Stage with a separate database and storage prefix. Run migrations once with a release step appropriate to the chosen Render plan. Avoid simultaneous migration on every replica startup. Migration changes must be compatible with rollback or have an explicit recovery plan. Readiness should fail if required dependencies are unavailable; liveness should not expose secrets.

Before public launch, configure real document requirements and retention, privacy/terms text appropriate to the operator, support contact, account recovery, storage access and backups. These are operational decisions, not established legal conclusions. No automatic production deployment is authorized by this planning pack.

## 11. Implementation sequence and team

| Phase | Outcome | Acceptance gate |
|---|---|---|
| 0 - Reconcile | Inspect repository, source spec, decisions and package compatibility | Written plan; no destructive reset or framework replacement |
| 1 - Foundation | Monorepo, database migrations, shared contracts, design tokens, health routes | Clean install/build; MySQL migrations and disposable demo seed |
| 2 - Accounts and approval | Auth, session/CSRF, onboarding, document privacy, admin decisions | Unapproved vendor cannot receive orders; cross-account access denied |
| 3 - Catalogue and cart | Public discovery, vendor products/stock, local single-shop cart | Browse-to-cart works on mobile; price/stock validated on server |
| 4 - Orders | Atomic checkout, snapshots, idempotency, transitions, expiry and stock dispositions | Last-item race and timeout retry pass; all transitions enforced |
| 5 - Experience and reports | Dashboards, polling, history, accessible states, reports | Customer/vendor/admin end-to-end journeys pass |
| 6 - Release preparation | CI, deployment config, backup/restore guide, security checks | Repeatable staging setup; honest record of tests and launch blockers |

Suggested six-person ownership (adapt to skills): A customer UI; B vendor/admin UI; C auth/onboarding API; D order/inventory API; E database/contracts/integration; F QA/CI/deployment. Pair E and F with feature owners from the first phase. Agree API contracts early, integrate small pull requests daily, and keep migrations reviewed. This is a sequencing plan, not an unverified completion-date promise.

## 12. Acceptance tests

| ID | Scenario | Required evidence |
|---|---|---|
| AT01 | Clean install -> migrate -> seed -> build -> run | Reproducible README and passing commands |
| AT02 | Customer, vendor and admin permissions | API tests bypassing frontend guards; cross-vendor/customer IDs denied |
| AT03 | Vendor applies and admin reviews | Private docs; immutable version; pending invisible, approved visible |
| AT04 | Two customers buy the final available item concurrently | Exactly one committed order; quantity never negative |
| AT05 | Double click / lost checkout response | Same key yields one order/reservation; changed payload gives 409 |
| AT06 | Price or stock changed after adding to cart | Explicit refresh/review; no silent higher total or partial order |
| AT07 | Exception halfway through checkout | No orphan order, items, stock movement or successful key record |
| AT08 | Every legal/illegal status transition | Legal actions succeed; stale/terminal/unauthorized actions fail |
| AT09 | Cancel/reject/expiry called twice or racing acceptance | Exactly one terminal decision; correct single restock |
| AT10 | Cancel after preparation | Only explicit resalable units return; remainder written off |
| AT11 | Change product name/price, archive product, edit address | Previous order snapshots remain unchanged |
| AT12 | Vendor suspension races checkout | No order accepted after suspension commits; existing resolution remains possible |
| AT13 | Logout/password change/deactivation | Server session unusable afterward; no UI-only revocation |
| AT14 | Missing/invalid CSRF and malicious writable fields | Request rejected; roles/totals/approval cannot be overwritten |
| AT15 | Offline cart / expired session / reconnect | Cart retained safely; no automatic placement; fresh validation |
| AT16 | Invalid file / oversized file / other vendor's document | Rejected or 404; no public identity-document URL |
| AT17 | Mobile and keyboard journeys | 360px and 1280px screenshots; labels, focus, contrast, no overflow |
| AT18 | Reporting date boundaries | Collected only; local-day range correctly converted to UTC; not payment revenue |
| AT19 | Backup restored to isolated database | Documented restore with row counts and a read-only smoke check |
| AT20 | Production-mode startup | Built SPA deep links and API JSON errors work; secrets absent from bundle |

Do not report these tests as passed until the application has been implemented and actually run. This document supplies the acceptance contract only.

## 13. Product-owner decisions before launch

Proposed defaults allow implementation to proceed: pickup-only; one shop and one role per account; React/Express/MySQL; ZAR; English; Africa/Johannesburg; admin approval; 15-minute pending expiry; customer cancellation before acceptance; vendor/admin cancellation with inventory disposition thereafter. Confirm operating area, document types, hosting budget/provider, support/account recovery, opening-hours policy, data retention and backup recovery targets before a public rollout. If delivery/payments are required for the first release, re-scope explicitly instead of adding isolated UI fields.

## 14. Sources and interpretation

Primary requirements: supplied `PHASE4-DigiTuck.pdf`, pp.1-22. Technology recommendations and scope resolutions are authored proposals; the original does not specify Express, TypeScript, Knex or cookie sessions.

Official technical references checked 5 November 2026:

- S1 Render MySQL deployment: https://render.com/docs/deploy-mysql
- S2 Render persistent disks: https://render.com/docs/disks
- S3 Render free instances: https://render.com/docs/free
- S4 Express production security: https://expressjs.com/advanced/best-practice-security/
- S5 Vite supported templates and runtime requirements: https://vite.dev/guide/
- S6 Knex transactions: https://knexjs.org/guide/transactions.html
- S7 Knex query builder / locking: https://knexjs.org/guide/query-builder.html
- S8 MySQL 8.4 locking reads: https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html
- S9 OWASP session management: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- S10 Node.js release schedule: https://github.com/nodejs/Release

Use current official documentation when implementation begins. No provider pricing, availability or software-version compatibility guarantee is implied.
