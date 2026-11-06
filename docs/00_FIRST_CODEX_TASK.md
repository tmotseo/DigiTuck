# First task: build the DigiTuck foundation

Implement Phase 0 and Phase 1 only. Read AGENTS.md, the system blueprint, master prompt and staged prompts in `docs/specification/`. The phase limit in this task overrides the master prompt's instruction to continue through every phase.

## Deliver

1. Inspect the repository and preserve existing work. Record the MVP decisions and a concrete implementation plan.
2. Scaffold React + TypeScript + Vite in `apps/web` and Express + TypeScript in `apps/api`, with shared contracts in `packages/contracts`.
3. Configure MySQL 8.4, Knex/mysql2 migrations, the blueprint's schema/constraints and explicitly enabled development seeds. Provide Docker Compose for local MySQL. If the execution environment cannot run Docker, use a supported MySQL test service or report the precise blocker; do not substitute SQLite for MySQL verification.
4. Add health endpoints, consistent API errors, frontend/API development routing and production build/start scripts.
5. Implement the design tokens and basic customer, vendor and admin navigation/layouts. These are foundations; do not represent unfinished authentication or role enforcement as implemented.
6. Add `.env.example`, developer setup documentation, lint/typecheck/test scripts and a trusted initial-admin bootstrap command as specified.
7. Verify installation, schema migrations, database connection, type checking, production build and available tests. Fix failures and report checks that could not run.
8. Update the README with exact startup commands and `docs/implementation-status.md` with completed work, actual evidence and next tasks.

The MVP remains collection only, with customer/vendor/admin roles, one shop per order and payment arranged at collection. Use the detailed blueprint for the schema and later order invariants.

Stop at the foundation checkpoint. Authentication and vendor approval are the next implementation task. Production deployment and paid-service provisioning are outside this task.
