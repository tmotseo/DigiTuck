# DigiTuck

DigiTuck is a planned web application for discovering local tuckshops, placing pickup orders, managing stock and fulfilling orders.

## Current status

This starter contains the specification, interface concepts and implementation instructions. Application code has not been built yet.

The first release covers customer, vendor and admin roles, one shop per order, collection only and payment arranged at the shop. The proposed implementation uses React/TypeScript, Express/TypeScript and MySQL, with Render as the hosting target.

## Start the build

Open this repository in Codex and send:

```text
Read AGENTS.md and docs/00_FIRST_CODEX_TASK.md. Complete the first
DigiTuck foundation task, using docs/specification/ as the requirements.
Implement and verify Phase 0 and Phase 1 only, then report the actual
results and startup commands. Keep application deployment for a later task.
```

## Project documents

- [First Codex task](docs/00_FIRST_CODEX_TASK.md)
- [System blueprint](docs/specification/01_SYSTEM_BLUEPRINT.md)
- [Visual design PDF](docs/specification/DigiTuck_System_Blueprint.pdf)
- [Master implementation prompt](docs/specification/02_CODEX_MASTER_PROMPT.md)
- [Staged prompts](docs/specification/03_PHASE_PROMPTS.md)
- [Requirements checklist](docs/specification/04_REQUIREMENTS_MATRIX.csv)
- [Implementation status](docs/implementation-status.md)

The master prompt describes the complete target system. The first task limits this initial build to its foundation. Later tasks add authentication, vendor approval, catalogue/cart, orders and reports in that order.

Startup commands will be documented after the initial application is implemented and verified. Proposed operating policies are identified in the blueprint and should be confirmed before a public launch.
