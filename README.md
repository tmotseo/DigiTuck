# DigiTuck

Collection-only local tuckshops. **Phases 0–2 are implemented:** React/Express/MySQL foundation, customer/vendor accounts, private vendor applications and administrator approval. Catalogue/cart (Phase 3) and ordering (Phase 4) are not implemented. No deployment or paid services.

## Requirements

- Node **24.22.2 LTS**, npm **11.18.0**; runtime pins in `.nvmrc` and `.node-version`.
- **MySQL 8.4**, either native or Docker Desktop with a running Linux engine. SQLite/MariaDB are not substitutes for integration tests.
- Ports 5173 (web), 4000 (API), 3307 (development DB), 3308 (optional test DB).

Run commands from the repository root. On PowerShell installations that block npm.ps1, use `npm.cmd` / `npx.cmd`.

## First startup

```powershell
npm ci
# Only if .env does not already exist:
Copy-Item .env.example .env
notepad .env
```

Replace all password placeholders. Match `MYSQL_PASSWORD` with the URL-encoded password in `DATABASE_URL`; use separate root/test passwords. Set `SESSION_SECRET` to at least 32 random characters. For example, generate a value locally with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` and paste it into your untracked `.env`. Never commit secrets.

```powershell
npm run db:up
npm run db:migrate
npm run db:check
npm run dev
```

Open **[http://127.0.0.1:5173](http://127.0.0.1:5173)**. Use that exact host: `APP_ORIGIN=http://127.0.0.1:5173` enables CSRF Origin validation. Vite proxies `/api` to loopback port 4000. `npm run dev` watches shared contracts, API and frontend. Stop with Ctrl+C. Changing the API port also requires updating the Vite proxy target.

For native MySQL, skip `db:up`, create a UTF-8 `digituck` database and database-scoped migration user, then configure `DATABASE_URL`. Trigger creation with binary logging needs operator permission; local Compose sets `log_bin_trust_function_creators=ON`. Use separate restricted application credentials before deployment. `db:down` stops Compose without deleting its volume. Do not use `down -v` on valuable data.

On macOS/Linux, the initial copy is `cp .env.example .env`; npm commands are identical. Machine-specific native runtime details are in [local verification](docs/runbooks/local-verification.md).

## Exercise Phase 2

1. Register at `/register` as a customer or `/vendor/register` as a vendor. Passwords require 12+ characters and at most 72 UTF-8 bytes. Email/phone are normalized and unique. Public signup cannot create an administrator.
2. Sign in at `/login`. `/account` supports name/phone edits and password changes; email remains read-only. Password changes sign out every session. Sign out is in the top bar.
3. As a vendor, open `/vendor`: save business details, upload the required private documents, then submit. The default checklist is `business-proof`; configure `DOCUMENT_TYPES` as comma-separated identifiers after the owner decides the real checklist.
4. Create an administrator through the trusted CLI below, then sign in normally. At `/admin/vendors`, open an application, review its exact snapshot/documents and supply a reason to approve, reject or suspend it. `/admin/users` manages active status; `/admin/audit` shows immutable audit history.
5. Only approved shops with active owners appear at `/shops`. Changing shop name/address/area or the owner's legal name starts reapproval and hides the shop. To replace submitted documents, start a new revision and upload a new set. Suspension survives revision until an administrator approves it.

Vendor/admin endpoints enforce roles and ownership on the server. All mutations need both a session CSRF token (`GET /api/v1/auth/csrf`, then `X-CSRF-Token`) and the configured Origin, including login and uploads. Sessions persist in MySQL, rotate on login, expire after 30 idle minutes/eight absolute hours, and are revoked by logout, password changes or account deactivation. Login throttling persists by hashed account/IP; account limit five attempts/15 minutes, IP limit 30/15 minutes. Successful login clears account failures; expired buckets are pruned after 24 hours.

## Trusted administrator bootstrap

Run after migrations in a trusted terminal. There is no HTTP admin bootstrap. Existing users are never promoted or overwritten; the last active administrator cannot be deactivated.

```powershell
$env:ADMIN_FULL_NAME = Read-Host 'Administrator full name'
$env:ADMIN_EMAIL = Read-Host 'Administrator email'
$env:ADMIN_PHONE = Read-Host 'International phone, e.g. +27821234567'
$env:ADMIN_PASSWORD = Read-Host 'Password (12+ characters, max 72 UTF-8 bytes)' -MaskInput
npm run admin:bootstrap
Remove-Item Env:ADMIN_FULL_NAME, Env:ADMIN_EMAIL, Env:ADMIN_PHONE, Env:ADMIN_PASSWORD
```

`-MaskInput` requires PowerShell 7.1+. On Bash, read the four variables interactively (`read -r -s ADMIN_PASSWORD` for the password), export them, run `npm run admin:bootstrap`, then unset them. Never put operator passwords in tracked files or command-line arguments.

## Private storage and production configuration

Development uses `STORAGE_DRIVER=local` and `.local-storage/private-documents`, outside public web assets. Files are limited to 10 MB, detected PDF/JPEG/PNG signatures, random object keys, and authenticated attachment downloads. Submitted profiles/document references remain immutable in MySQL. Operators must approve actual document requirements, retention and a malware-scanning deployment choice before public launch; signature checks are not antivirus scanning.

Production fails closed unless `APP_ORIGIN` uses HTTPS and `STORAGE_DRIVER=s3` with `S3_BUCKET` and `S3_REGION`. Optional `S3_ENDPOINT` supports compatible object stores; credentials use the standard AWS SDK credential provider. Configure a private bucket with public access blocked and least-privilege credentials. The adapter requests AES256 server-side encryption and never returns object keys or public URLs. **Live S3 access has not been verified and no bucket was provisioned.**

```powershell
npm run build
# After configuring HTTPS origin, private S3, DB and SESSION_SECRET:
npm start
```

`npm start` sets production mode and serves the built SPA and `/api/v1` on loopback port 4000. HTTPS termination and `TRUST_PROXY_HOPS` (0 or 1) must match the real proxy topology before launch. Production cookies use `__Host-`, Secure, HttpOnly, SameSite=Lax, Path=/ and no Domain. Plain HTTP cannot exercise production login. No migration or seed runs at startup. Network binding/deployment remains Phase 6.

- `/api/v1/health/live`: process liveness.
- `/api/v1/health/ready`: database connectivity and migration `002_phase_two.mjs`, otherwise redacted 503.
- API responses use request IDs and no-store caching; unknown API routes return JSON, never the SPA.

## Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Database and browser suites **reset a disposable database**. Use a separate `TEST_DATABASE_URL` whose database name ends in `_test`; never point it at business data. Both suites verify genuine MySQL 8.4 and require explicit reset authorization. Do not run them concurrently against the same database.

```powershell
# Docker users only; native MySQL users create a separate test database/user:
docker compose --env-file .env -f infra/compose.yaml --profile test up -d --wait mysql-test
$env:ALLOW_DB_TEST_RESET = 'true'
npm run test:db
npx playwright install chromium
npm run build
npm run test:e2e
Remove-Item Env:ALLOW_DB_TEST_RESET
```

Browser tests start a disposable test-only server on 4173 serving the actual production frontend build with HTTP test cookies, private temporary storage and a test-only administrator. They exercise registration, vendor submission, admin approval, public listing, route protection and responsive layouts at 360px/1280px. Production secure-cookie flags are separately verified in HTTP integration tests. Browser tests are not a production TLS/S3 deployment test.

See [implementation status](docs/implementation-status.md) for actual counts and limitations. Integration tests cover immutable records, real-MySQL constraints, CSRF, role/ownership denial, session rotation/revocation/expiry, persistent throttling, file validation/access, stale/concurrent approvals and last-admin protection.

## Optional demo seed

```powershell
$env:ALLOW_DEMO_SEED = 'true'
npm run db:seed
Remove-Item Env:ALLOW_DEMO_SEED
```

Seeds are repeatable, opt-in and forbidden in production. Fictional draft shops and inactive users have random undisclosed passwords and cannot log in. No administrator or verification document is seeded.

MySQL DDL auto-commits. A failed migration may leave partial tables; do not blindly retry or reset valuable data. `db:rollback` drops the last completed migration and is forbidden in production. Prepare recovery for non-disposable data.

## Repository map

`apps/web`: React pages/layouts/forms; `apps/api`: Express authentication, vendor/admin services and storage; `packages/contracts`: strict schemas; `db`: versioned schema/triggers/seeds; `scripts`: migration/bootstrap/test server; `tests`: unit, MySQL and browser suites; `docs/specification`: preserved requirements.

See [Phase 2 decisions](docs/decisions/003-phase-two.md), [API routes and request schemas](docs/api/phase-two.json), [requirements](docs/requirements-checklist.md), [blueprint](docs/specification/01_SYSTEM_BLUEPRINT.md) and [phase prompts](docs/specification/03_PHASE_PROMPTS.md). Recovery email, hosting, backup restoration and retention remain prelaunch decisions. No online payment, delivery or driver workflow is included.
