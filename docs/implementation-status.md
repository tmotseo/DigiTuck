# Implementation status — Phase 2 checkpoint

Updated **2026-11-07**, Africa/Johannesburg. Scope: foundation verification followed by accounts and vendor approval. **Stop after Phase 2; no deployment or paid resources.**

## Foundation preserved and verified

Read AGENTS.md, first task, blueprint, master prompt and phase prompts before continuing. Re-ran the existing foundation checks before feature changes: lint, typecheck, 11 unit/API tests, six real-MySQL tests and production build passed. Preserved the React/Express/TypeScript/npm-workspace design, MySQL schema/triggers, seeds, trusted bootstrap and supplied specification/design assets.

Remote main contains the specification pack, while the local Phase 0/1 foundation was uncommitted. The Phase 2 review branch therefore includes the foundation too. The remote base commit is `34b895ceca96300ae829440677e644b0c31b6661` (tree `e41f0537520549958629068717c1c1b55146721f`). Publishing uses the GitHub connector with that existing parent; no unrelated root history or force push.

## Implemented

- Customer/vendor registration, normalized unique email/phone, bcrypt work factor 12, password byte limits, generic login errors, logout, own name/phone edits and password changes. Email is read-only; no public admin signup.
- MySQL-backed sessions, login rotation, HttpOnly/SameSite cookies, production Secure `__Host-` cookie, idle/absolute expiry and auth-version revocation on password/status changes. No tokens in browser storage.
- Synchronizer CSRF and exact Origin checks on every mutation including login and multipart uploads. Persistent account/IP throttle buckets, transactional attempt claims and expiration cleanup.
- Server-side role and ownership enforcement, protected frontend routes and last-active-admin protection under a database lock. Account deactivation revokes sessions and hides owned shops.
- Vendor business profile, validated opening hours, pause flag, document checklist, signature/MIME/size validation, private randomized file storage, authenticated attachment downloads, submit/status/rejection/suspension screens.
- Immutable submitted snapshots and document references. Material business/owner identity changes create a new draft and hide the shop. Revisions preserve suspension. Optimistic shop versions and exact submission versions prevent stale or concurrent approvals.
- Admin review of current/historical submissions, approve/reject/suspend with reasons, user status management and append-only audit history. Only approved shops with active owners are public.
- Responsive login, registration, account, vendor onboarding and administrator pages using existing tokens/layouts. Later-phase catalogue/orders remain clearly unavailable.
- Private local storage adapter and S3 production configuration; production rejects HTTP origins and local-file storage. No bucket/service provisioned.
- Updated README startup/testing instructions, `.env.example`, Phase 2 decision record, requirement mapping and `docs/api/phase-two.json` OpenAPI route/request documentation.

## Verification evidence

Runtime: **Node 24.22.2**, npm **11.18.0**, native **MySQL Community 8.4.13**, loopback port 3307. Test database is a separate disposable `digituck_test`, never the development database. MySQL tests do not use SQLite or mock database persistence.

| Check | Actual result |
|---|---|
| Clean `npm ci --no-fund --no-audit` | Passed; 402 packages. Informational esbuild install-script notice; no policy changes required and build succeeded. |
| `npm run lint` | Passed. |
| `npm run typecheck` | Passed. |
| `npm test` | **12 passed**, including production HTTPS/private-storage/secret configuration guards. |
| `npm run test:db` | **17 passed**: six foundation and eleven Phase 2 real-MySQL tests, including approved-shop visibility after owner deactivation and material address changes. |
| `npm run db:check` | MySQL **8.4.13**, UTC **+00:00**, migrations 001 and 002 applied, no pending migrations. |
| Frontend secret/build hygiene | Configured database/password/session values absent from built JS; `.env`, dependencies, builds and test artifacts ignored by Git. |
| `npm run build` | Passed after clean installation: contracts/API TypeScript and Vite production frontend (76 modules). |
| `npm run test:e2e` | **4 passed**, Chromium at 1280×900 and 360×800, repeated after clean install and visual fix. Full vendor registration → profile → upload → submit → admin login/review/approve → public listing; protected-route/API checks, no page errors or horizontal overflow. |
| Production-cookie integration | Verified `Secure`, `HttpOnly`, `SameSite=Lax`, `__Host-`, Path=/, no Domain with a trusted HTTPS proxy request. This is not a live TLS deployment test. |
| Private storage integration | Local real-file upload/download and unauthorized denial passed. Invalid signature, MIME mismatch, oversize uploads and submitted-document replacement/deletion rejected. |
| Visual inspection | Inspected desktop admin and mobile vendor screenshots. Fixed an off-screen skip-link appearing in full-page captures; browser suite rerun passed. Screenshots/traces are ignored test artifacts. |

Database coverage includes the six foundation tests plus Phase 2 registration/uniqueness/hash checks, role/ownership denial, CSRF/Origin, durable sessions across independent app/store instances, rotation/logout/password/status revocation, idle/absolute expiry, persistent throttling, private document validation/download, snapshot freeze, exact-version review, competing approvals, suspension/rejection/revision history and last-admin protection.

Failures fixed during implementation: invalid Zod chaining, test TypeScript strictness, API prefix mismatch during wiring, and a production-cookie test inadvertently sharing a session-store instance with a different middleware configuration. Each app in that test now owns its own store, as real server instances do.

## Limits and operator decisions

- Docker Desktop's Linux engine remains unavailable on this workstation. Compose syntax passed in Phase 1; container startup is unverified. Native MySQL supplied actual integration verification. Its ignored runtime/data under `.git/` must not be reinitialized.
- Live S3/object-store permissions, production TLS/proxy topology, malware scanning, retention, backup restoration and deployment were **not** verified. Production configuration exists; external infrastructure does not.
- `business-proof` is a configurable development checklist, not an asserted legal requirement. The owner must decide real documents, retention and recovery/support before launch. No email recovery provider is configured.
- Local Git Credential Manager cannot authenticate noninteractively. Connector-based Git objects/branch/PR preserve the existing GitHub history. This does not repair workstation Git credentials; preserve the workspace when restoring them.
- No real vendor/admin account or private identity document was created in the development database. Browser fixtures exist only in the disposable test database and use explicit test-only credentials.
- Phase 3 catalogue/cart, Phase 4 orders/stock races, Phase 5 full operations/reports and Phase 6 release/backup work remain pending. No claim of production readiness or security certification.

See README for exact commands and `docs/runbooks/local-verification.md` for this workstation's temporary native runtime. Review branch: `codex/phase-2-login-vendor-approval`. Do not merge or deploy automatically.
