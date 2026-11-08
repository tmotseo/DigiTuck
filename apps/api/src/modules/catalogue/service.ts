import { randomUUID } from 'node:crypto'
import type { Knex } from 'knex'
import type { ProductInput } from '@digituck/contracts'
import { HttpError } from '../../lib/errors.js'
import { ownShop } from '../vendor/repository.js'
import { products, productColumns, present, publicShopsQuery, shopColumns, type ProductRow } from './repository.js'

const missing = () => new HttpError(404, 'NOT_FOUND', 'Product or shop not found.')
export async function categories(db: Knex) { return db('categories').where({ is_active: true }).select('id', 'name').orderBy('name').limit(100) }
async function summary(db: Knex, shopId: string, publicOnly: boolean) {
  const row = await products(db, shopId, publicOnly).count('p.id as total').sum('p.available_qty as units').first()
  return { total: Number(row?.total || 0), availableUnits: Number(row?.units || 0) }
}
export async function list(db: Knex, shopId: string, page: number, limit: number, publicOnly = false) {
  const totals = await summary(db, shopId, publicOnly)
  const rows: ProductRow[] = await products(db, shopId, publicOnly).select(productColumns).orderBy('p.name').orderBy('p.id').limit(limit).offset((page - 1) * limit)
  return { items: rows.map(present), ...totals, page, limit }
}
export async function vendorList(db: Knex, owner: string, page: number, limit: number) {
  const shop = await ownShop(db, owner)
  if (!shop) throw new HttpError(409, 'SHOP_REQUIRED', 'Save your business details before adding products.')
  return db.transaction(trx => list(trx, shop.id, page, limit))
}
export async function publicShops(db: Knex, page: number, limit: number) {
  return db.transaction(async trx => {
    const shops = await publicShopsQuery(trx).select(shopColumns).orderBy('s.name').orderBy('s.id').limit(limit).offset((page - 1) * limit)
    return Promise.all(shops.map(async shop => { const counts = await summary(trx, shop.id, true); return { ...shop, is_paused: Boolean(shop.is_paused), productCount: counts.total, availableUnits: counts.availableUnits } }))
  })
}
export async function publicCatalogue(db: Knex, slug: string, page: number, limit: number) {
  return db.transaction(async trx => {
    const shop = await publicShopsQuery(trx).where('s.slug', slug).select(shopColumns).first()
    if (!shop) throw missing()
    return { shop: { ...shop, is_paused: Boolean(shop.is_paused) }, products: await list(trx, shop.id, page, limit, true) }
  })
}
const columns = (input: ProductInput) => ({ name: input.name, description: input.description, price: input.price, category_id: input.categoryId, low_stock_threshold: input.lowStockThreshold, is_visible: input.isVisible })
async function categoryExists(db: Knex, id: string) {
  if (!await db('categories').where({ id, is_active: true }).first()) throw new HttpError(422, 'CATEGORY_INVALID', 'Choose an active category.')
}
async function lockShop(trx: Knex, owner: string) {
  const shop = await trx('shops').where({ owner_id: owner }).forUpdate().first()
  if (!shop) throw new HttpError(409, 'SHOP_REQUIRED', 'Save your business details before adding products.')
  return shop
}
async function movement(trx: Knex, owner: string, id: string, delta: number, after: number, reason: string) {
  await trx('inventory_movements').insert({ id: randomUUID(), product_id: id, actor_id: owner, type: 'ADJUST', quantity_delta: delta, available_after: after, reason })
}
export async function create(db: Knex, owner: string, input: ProductInput & { initialQuantity: number }) {
  return db.transaction(async trx => {
    const shop = await lockShop(trx, owner)
    await categoryExists(trx, input.categoryId)
    const id = randomUUID()
    await trx('products').insert({ id, shop_id: shop.id, ...columns(input), available_qty: input.initialQuantity })
    if (input.initialQuantity) await movement(trx, owner, id, input.initialQuantity, input.initialQuantity, 'Initial inventory')
    return { id }
  })
}
export async function change(db: Knex, owner: string, id: string, expectedVersion: number, update: { product: ProductInput } | { quantityDelta: number; reason: string } | { archive: true }) {
  return db.transaction(async trx => {
    const shop = await lockShop(trx, owner)
    const product = await trx('products').where({ id, shop_id: shop.id }).whereNull('archived_at').forUpdate().first()
    if (!product) throw missing()
    if (product.version !== expectedVersion) throw new HttpError(409, 'STALE_VERSION', 'This product changed. Reload the latest products before trying again. If editing details, cancel and reopen the editor.')
    let values: Record<string, unknown>
    if ('product' in update) {
      await categoryExists(trx, update.product.categoryId)
      values = columns(update.product)
    } else if ('archive' in update) values = { archived_at: trx.fn.now(3), is_visible: false }
    else {
      const quantity = product.available_qty + update.quantityDelta
      if (quantity < 0 || quantity > 1_000_000) throw new HttpError(422, 'INVALID_STOCK', 'Available stock must stay between 0 and 1,000,000.')
      values = { available_qty: quantity }
      await movement(trx, owner, id, update.quantityDelta, quantity, update.reason)
    }
    await trx('products').where({ id }).update({ ...values, version: product.version + 1 })
    return { updated: true }
  })
}
