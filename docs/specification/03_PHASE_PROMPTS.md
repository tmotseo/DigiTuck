# DigiTuck - staged build prompts

Use the master prompt first. These smaller prompts are continuation tasks for the same repository. They inherit `01_SYSTEM_BLUEPRINT.md`, the master prompt and existing decisions. They do not authorize deployment or paid resources. Copy one phase at a time if the build needs separate sessions.

## Phase 0 - inspect and reconcile

Read the repository, source specification and DigiTuck blueprint. Inspect existing code and uncommitted work. Create `docs/decisions/001-mvp-baseline.md`, a requirement-to-feature checklist and `docs/implementation-status.md`. Record collection-only scope, three roles, one shop/order, React/MySQL/Render, exact money, server sessions and proposed expiry/cancellation defaults. Verify package/runtime compatibility in current official docs. Explain conflicts and choose a minimal compatible plan. Preserve existing implementation. Then proceed to the foundation unless blocked by a material conflict.

Acceptance: a concrete module/file plan, no destructive reset, explicit confirmed-source requirements versus proposed defaults, and test strategy tied to important behaviour.

## Phase 1 - foundation and data

Implement the agreed React/TypeScript + Express/TypeScript monorepo, shared schemas, error envelopes and health routes. Configure local MySQL 8.4, Knex/mysql2 migrations and all entities/constraints from the blueprint, including immutable vendor applications, order snapshots, stock movements and idempotency. Add safe development seeds and trusted admin bootstrap. Implement design tokens, role shells and public route scaffolds using real routing. Supply env examples and reproducible scripts. Do not add payment/delivery entities.

Acceptance: a fresh checkout can install, start MySQL, migrate, explicitly seed, typecheck and build. Foreign keys/checks reject invalid values. Production API errors return JSON. Seed is repeatable and blocked by default in production. Record actual checks.

## Phase 2 - accounts and vendor approval

Implement registration, email login, password hashing, durable secure-cookie sessions, CSRF, logout, account update, password change, role/ownership middleware and persistent throttling. Public signup cannot grant admin. Add vendor onboarding, validated private document uploads, immutable submission versions, admin queue and approve/reject/suspend actions with reasons and audit. Material profile changes require reapproval. Provide a local file adapter for development and production storage configuration without secrets.

Acceptance: a vendor can submit and an admin can approve the exact version; pending/rejected shops are not public; other users cannot access the documents. Test direct HTTP role/ownership violations, session invalidation, stale approval and CSRF. Do not rely on route guards for security.

## Phase 3 - catalogue, stock and cart

Connect public discovery to approved shops and real product data. Add name/area/category filters, product search across approved shops with displayed prices for comparison, shop hours/pause behaviour, product CRUD/archive/images, category management and admin moderation. Implement versioned signed stock adjustments with reason and ledger. Build the mobile cart with one-shop enforcement, explicit replace-cart confirmation, quantity limits and local persistence that contains no authentication data. Add checkout quote with authoritative current values and clear stale-cart UI.

Acceptance: guest can browse; customer can prepare a cart; vendor manages only own products; paused/closed/unapproved shops do not accept checkout; archive does not delete history. Price calculations use exact decimals/cents. Verify keyboard and 360px layout. Quote does not reserve stock.

## Phase 4 - transactional orders

Implement the full order service and shared state machine from the master prompt. Checkout claims a database-backed idempotency key, locks shop/products, revalidates, snapshots values, reserves stock and commits events/results atomically. Build customer order confirmation/history/status and vendor transition actions. Implement pending expiry, catch-up on restart and a CLI job. Cancellation before preparation releases all; cancellation afterward requires explicit resalable quantities and writes off the rest. Add expectedVersion and consistent global lock ordering.

Acceptance: real MySQL tests for last-item race, duplicate checkout, unknown network outcome/replay, key mismatch, mid-transaction rollback, changed price, double cancellation, acceptance racing expiry, suspension racing checkout, stale stock writes and partial restock. Test all legal and illegal transitions. No mock database substitutes for these checks.

## Phase 5 - complete the experience

Finish customer, vendor and admin pages using real endpoints. Add visible-order polling, loading/empty/error/offline states, changed-price review, accessible navigation/dialogs and small-screen layouts. Provide low-stock alerts within the application, order timeline, private admin document review and collected-order reports. Use real aggregates and local timezone date boundaries. Do not imply financial reconciliation or add fake SMS/email notifications.

Acceptance: Playwright exercises vendor approval -> product creation -> customer order -> vendor preparation/ready/collection -> customer history/report. Capture mobile/desktop screenshots, inspect for overflow and missing states, and fix issues. Report pending/cancelled values separately from collected-order value.

## Phase 6 - release preparation and handoff

Finish CI, production build/start, Render configuration, safe migrations, environment documentation, security headers, structured redacted logs, storage configuration and native MySQL backup/restore runbooks. Inspect production frontend bundle for accidental secrets. Add deployment smoke checks and rollback instructions appropriate to the selected hosting setup. Do not provision paid services or publish production automatically. Execute all available acceptance tests and clearly record any external-service test that could not run.

Acceptance: README commands are accurate; clean install/migration/build passes; test results are recorded; no core TODO/mock success remains. List exact operator decisions for document types, storage, hosting budget, recovery/support, retention and timeout/cancellation policy. Distinguish implemented, tested and externally blocked work.

## Resume prompt

Continue the existing DigiTuck implementation. Read `docs/implementation-status.md`, current decisions, recent changes and failing tests. Do not restart or resaffold completed work. Compare progress with the master prompt and acceptance matrix, choose the next incomplete phase, implement it, verify it and update the status file with exact results and remaining tasks.

## Independent review prompt

Review the implemented DigiTuck application against the blueprint without assuming previous claims are correct. Inspect role/ownership boundaries, transaction/idempotency behaviour, stock and cancellation invariants, historical snapshots, private documents, sessions/CSRF and deployment persistence. Run relevant checks. Report concrete defects with file references and reproduction steps, then fix confirmed defects in scope. Do not label the app production-ready solely because it builds or screenshots look correct.
