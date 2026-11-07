# 002 — Runtime, compatibility and database verification

Checked 2026-11-06 against official documentation and the npm registry metadata before installation.

- Node 24.22.2 LTS pinned in `.node-version` and `.nvmrc`. The host initially supplied 22.14.0; a portable Node 24.22.2 was downloaded from nodejs.org for verification without replacing the user's system installation.
- React/ReactDOM 19.3.1; Vite 8.3.6 + React plugin 6.2.1; React Router 7.18.5; TanStack Query 5.106.1. Vite requires Node 20.19+ or 22.12+; Router requires Node 20+ and React 18+; Query supports React 18/19.
- Express 5.3.0 requires Node 18+. Knex 3.3.0, mysql2 3.24.6, Zod 4.6.7. Runtime pins and transitive versions are recorded in package-lock.json.
- TypeScript 5.9.3 intentionally replaces the registry's latest 7.x: typescript-eslint 8.72.1 declares TypeScript >=4.8.4 and <6.1.0. ESLint 10.14.0 and Vitest 5.1.0 support the chosen Node runtime.
- MySQL 8.4 InnoDB only. Compose tracks the 8.4 LTS patch line, binds only loopback ports, uses a persistent named development volume and a disposable test profile. UTC connections, utf8mb4, decimal strings and strict checks are preserved. No SQLite/MariaDB substitute.
- `request_key` is the SQL name for the blueprint's idempotency key, avoiding the reserved `KEY` identifier. Extra `shop_id` on order_items plus composite foreign keys enforce the one-shop invariant even before checkout is built.
- MySQL DDL is not transactional. Run migrations once as an explicit command; a failed migration can leave partial tables. Foundation rollback is destructive and permitted only for disposable/nonproduction data. Production recovery requires a reviewed migration/backup plan in Phase 6.
- Session table is compatible with express-mysql-session's documented schema. The library/session middleware integration and auth-version comparisons are deliberately deferred to Phase 2.

Sources: [Node LTS](https://nodejs.org/en/download), [Vite requirements](https://vite.dev/guide/), [Express support](https://expressjs.com/en/support/), [React Router changelog](https://reactrouter.com/start/start/changelog), [TanStack Query requirements](https://tanstack.com/query/latest/docs/framework/react/installation), [MySQL CHECK constraints](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html), [MySQL foreign keys](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html), [session-store schema](https://github.com/chill117/express-mysql-session/blob/master/schema.sql).

See `docs/implementation-status.md` for actual test evidence and environmental limitations, rather than inferring verification from this selection record.
