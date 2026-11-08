import type { Knex } from 'knex'
import type { Product } from '@digituck/contracts'

export function products(db: Knex, shopId: string, publicOnly = false) {
  const query = db('products as p').join('categories as c', 'c.id', 'p.category_id').where('p.shop_id', shopId).whereNull('p.archived_at')
  if (publicOnly) query.where('p.is_visible', true).whereNull('p.moderation_hidden_at').where('c.is_active', true)
  return query
}
export const publicShopsQuery = (db: Knex) => db('shops as s').join('users as u', 'u.id', 's.owner_id').where({ 's.approval_status': 'APPROVED', 'u.status': 'ACTIVE' }).whereNull('s.suspended_at')
export const shopColumns = ['s.id', 's.slug', 's.name', 's.description', 's.area', 's.address', 's.is_paused']
export interface ProductRow { id: string; name: string; description: string; category_id: string; category_name: string; price: string; available_qty: number; low_stock_threshold: number; is_visible: number; moderation_hidden_at: unknown; version: number }
export const productColumns = ['p.id', 'p.name', 'p.description', 'p.category_id', 'c.name as category_name', 'p.price', 'p.available_qty', 'p.low_stock_threshold', 'p.is_visible', 'p.moderation_hidden_at', 'p.version']
export function present(row: ProductRow): Product {
  return { id: row.id, name: row.name, description: row.description || '', categoryId: row.category_id, categoryName: row.category_name, price: row.price, availableQuantity: row.available_qty, lowStockThreshold: row.low_stock_threshold, isVisible: Boolean(row.is_visible), moderationHidden: !!row.moderation_hidden_at, version: row.version }
}
