# 004 — Vendor catalogue and inventory

2026-11-08. Scope is the requested vendor Products/Inventory tabs and customer vendor catalogue, not the entire Phase 3 cart or ordering phase.

- Preserve existing React, Express, Knex, MySQL and exact dependency pins/lockfile. No new dependency is required. Checked official [Vite runtime requirements](https://vite.dev/guide/) and [Knex transactions](https://knexjs.org/guide/transactions.html); existing Node 24 runtime remains compatible.
- Reuse foundation products/inventory_movements tables. Migration 003 inserts real default categories separately from demo data, ignores existing slugs and preserves referenced categories on rollback.
- A product count means distinct visible, unarchived, unmoderated products in active categories. Available units means the sum of their available quantities, including zero. Both counts are independent of pagination and read in the same MySQL snapshot as catalogue rows. Draft shops remain private; approved shops with active owners can be browsed even when paused.
- Allow vendors to prepare their own catalogue after saving business details, before approval. Server role/ownership checks and existing CSRF/Origin protections cover every mutation. Strict contracts reject stock changes through product-edit requests and reject ownership/moderation field injection.
- Product prices stay decimal strings. Initial inventory and signed stock adjustments write an append-only movement in the same transaction as the product. Lock shop then product, check expectedVersion under lock, reject negative/excessive stock, increment version. A repeated request with the old version is rejected, preventing duplicate adjustment after a lost response. Vendors explicitly reload before retrying.
- Archive instead of delete; preserve ledger and future historical references. Low stock is available quantity at or below the configured threshold. The UI filter explicitly applies to the current page.
- Customer catalogue polls every 15 seconds while visible; focus/navigation also refresh queries. Mutations invalidate vendor, shop-list and catalogue queries. No promise of push updates or stock reservation.
- Product image upload, carts, orders, search and reports remain separate work. Existing edits in Vendor.tsx are preserved.
