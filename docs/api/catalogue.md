# Catalogue API

All paths use `/api/v1`. Responses retain `{ data, meta: { requestId } }` and standard error envelopes. Product lists are `{ items, total, availableUnits, page, limit }`. Prices are ZAR decimal strings. Pagination uses `page >= 1`, `limit 1..100` (default 20).

| Method/path | Access | Body/result |
|---|---|---|
| GET `/categories` | Public | Up to 100 active `{ id, name }` categories |
| GET `/shops?page=1&limit=20` | Public | Existing shop fields plus `productCount`, `availableUnits`; approved, unsuspended shops with active owners only |
| GET `/shops/:slug?page=1&limit=20` | Public | `{ shop, products }`; 404 if unavailable |
| GET `/vendor/products?page=1&limit=20` | Vendor | Own unarchived products and totals, including hidden products |
| POST `/vendor/products` | Vendor + CSRF/Origin | Product fields plus `initialQuantity`; 201 `{ id }` |
| PATCH `/vendor/products/:id` | Owning vendor + CSRF/Origin | Product fields plus `expectedVersion`; `{ updated: true }` |
| POST `/vendor/products/:id/stock` | Owning vendor + CSRF/Origin | `expectedVersion`, signed nonzero integer `quantityDelta`, `reason` (3..1000 chars); `{ updated: true }` |
| DELETE `/vendor/products/:id` | Owning vendor + CSRF/Origin | `expectedVersion`; soft archive, `{ updated: true }` |

Product fields: `name` (2..160 trimmed characters), `description` (0..2000), `categoryId` (active category UUID), positive `price` (e.g. `12.50`, DECIMAL(10,2)), `lowStockThreshold` (integer 0..1,000,000), `isVisible` (boolean). Initial and resulting stock must be 0..1,000,000. Unknown fields are rejected.

Returned products: `id`, `name`, `description`, `categoryId`, `categoryName`, `price`, `availableQuantity`, `lowStockThreshold`, `isVisible`, `moderationHidden`, `version`. Internal image keys and owner information are not returned.

Errors: 401 missing session, 403 wrong role/CSRF/Origin, 404 inaccessible/archived product or private shop, 409 `SHOP_REQUIRED`/`STALE_VERSION`, 422 validation/category/stock errors. Refresh after a version conflict; do not automatically reapply a stock adjustment.
