# DigiTuck project guidance

Read the current user task first. Follow its scope; the master prompt describes the complete target application and does not expand a task limited to one phase.

## Requirements

- Read `docs/specification/01_SYSTEM_BLUEPRINT.md` and `docs/specification/02_CODEX_MASTER_PROMPT.md` before implementing features.
- Initial task: `docs/00_FIRST_CODEX_TASK.md` (Phase 0 and Phase 1).
- Preserve existing work. Inspect the repository before scaffolding or modifying files.
- Keep React, MySQL and the collection-only baseline. TypeScript, Express, Knex and server sessions are the proposed implementation choices.
- Keep one shop per order. No online payments, delivery or driver workflow in the initial scope.
- Record material implementation choices under `docs/decisions/` and update `docs/implementation-status.md` with actual results.

## Quality

- Check current official package/runtime requirements and commit compatible dependency pins and a lockfile.
- Use environment placeholders in examples; keep credentials and uploaded private documents out of source control.
- Enforce validation and ownership server-side as those features are implemented.
- Use exact money arithmetic, historical order snapshots, MySQL transactions and database-backed idempotency for the order phase.
- Test concurrency with real MySQL rather than SQLite or a mock database.
- Run checks appropriate to each change. Distinguish passed, failed and blocked checks honestly.
- Keep the README startup instructions accurate. Do not claim that the app is built, tested or deployed without evidence.
