# Requirement-to-feature checkpoint

The original matrix in `specification/04_REQUIREMENTS_MATRIX.csv` is preserved. Phases 0–2 implement the foundation, accounts and vendor approval, not the full MVP.

| Requirement | Foundation artifact | Remaining phase / acceptance |
|---|---|---|
| REQ01 collection only | Copy and schema have no delivery/payment entities | Phase 4 checkout; AT04–06 |
| REQ02 roles/permissions | Customer/vendor signup, login/logout, MySQL sessions, CSRF, account/password edits, role/ownership checks, last-admin protection | Phase 2 complete; HTTP/browser coverage AT02/13/14 |
| REQ03 vendor review | Private uploads, frozen snapshots, exact-version review, approval/rejection/suspension with audit | Phase 2 complete; stale/concurrent approvals and privacy tested AT03/16 |
| REQ04 discovery/search | Real routes with explicit unimplemented states | Phase 3 catalogue; AT03/17 |
| REQ05 one-shop/exact pricing | Composite item foreign keys, decimal contracts/cents helpers | Phase 3/4 cart and checkout; AT05/06/15 |
| REQ06 catalogue/stock | Products/categories schema, nonnegative stock checks, vendor routes | Phase 3 CRUD/ledger service; AT04/11 |
| REQ07 status/history | State enum, immutable snapshots, append-only events | Phase 4/5 transitions/history; AT08/09/11 |
| REQ08 transactional idempotency | Unique request and movement constraints | Phase 4 atomic service and races; AT04/05/07/09 |
| REQ09 expiry/restock | Expiry index, item disposition fields/checks | Phase 4 job/cancellation policy; AT09/10 |
| REQ10 responsive UI | Tokens, customer/vendor/admin layouts, navigation, live health/error states | Foundation AT17 subset; full journeys Phase 5 |
| REQ11 reports | Collected timestamp/index and reports placeholder | Phase 5 real aggregates; AT18 |
| REQ12 files/sessions/audit | Durable sessions/revocation/throttling; local private adapter and S3 configuration; authorized downloads and audit screens | Phase 2 local verification complete; live S3/TLS/scanning operational verification remains Phase 6 |
| REQ13 MySQL/history | All 14 blueprint tables, migrations, seed/bootstrap, integration suite | AT01 foundation and AT11 schema subset; order rollback Phase 4 |
| REQ14 Render/operations | Reproducible build/start, same-origin SPA/API, Compose | No deployment; Phase 6 backup/restore/hosting; AT19 |
| REQ15 moderation | Audited vendor decisions and user activation/deactivation with reasons | Phase 2 complete; product/order moderation remains Phase 3/5 |

No test for a later phase is marked passed by the existence of a schema or placeholder route. Exact results belong in implementation-status.md.
