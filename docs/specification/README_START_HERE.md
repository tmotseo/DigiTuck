# DigiTuck implementation pack

This pack turns the 22-page `PHASE4-DigiTuck.pdf` specification into a proposed buildable first release. It contains architecture, database/API specifications, UI guidance, acceptance criteria and copy-ready Codex prompts. It does not contain a finished application.

## Start here

1. Read `DigiTuck_System_Blueprint.pdf` for the visual overview, proposed scope and screen designs.
2. Open your project repository in Codex. Attach the original specification and this pack's files.
3. Copy the text between PROMPT START and PROMPT END from `02_CODEX_MASTER_PROMPT.md`.
4. Let Codex inspect the existing project and build in phases. Use `03_PHASE_PROMPTS.md` to resume or focus a later session.
5. Review actual test evidence and the product-owner decisions before deploying publicly.

## Files

| File | Purpose |
|---|---|
| `DigiTuck_System_Blueprint.pdf` | Visual overview, wireframes, scope, architecture and build plan |
| `01_SYSTEM_BLUEPRINT.md` | Detailed editable source of requirements, data model, API and acceptance criteria |
| `02_CODEX_MASTER_PROMPT.md` | Main copy-ready implementation instruction |
| `03_PHASE_PROMPTS.md` | Seven implementation stages, resume task and review task |
| `04_REQUIREMENTS_MATRIX.csv` | Traceable features, source pages, implementation phase and acceptance IDs |
| `design/customer_mobile.png` | Proposed mobile customer catalogue and order views |
| `design/vendor_dashboard.png` | Proposed vendor fulfilment view |
| `design/admin_review.png` | Proposed admin approval view |
| `design/core_relationships.mmd` | Focused editable entity relationship diagram |
| `design/order_states.mmd` | Editable order state diagram |

The visual examples use fictional shops, prices, counts and orders. Core scope: pickup only, no online payment, customer/vendor/admin, React + proposed Express backend, MySQL and Render. Proposed operating defaults are identified in the blueprint; they are not confirmations from the product owner. The original specification is not modified.
