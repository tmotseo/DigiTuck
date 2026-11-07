import { randomBytes, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'

export async function seed(db) {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Demo seed refused: use a development database and ALLOW_DEMO_SEED=true explicitly.')
  }
  const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12)
  await db.transaction(async trx => {
    const category = { id: '10000000-0000-4000-8000-000000000001', name: 'Demo meals', slug: 'demo-meals', is_active: true }
    if (!await trx('categories').where({ id: category.id }).first()) await trx('categories').insert(category)
    for (const suffix of [1, 2]) {
      const vendorId = `20000000-0000-4000-8000-00000000000${suffix}`
      const shopId = `30000000-0000-4000-8000-00000000000${suffix}`
      const productId = `40000000-0000-4000-8000-00000000000${suffix}`
      if (!await trx('users').where({ id: vendorId }).first()) {
        await trx('users').insert({ id: vendorId, full_name: `Demo Vendor ${suffix}`, normalized_email: `vendor${suffix}@example.invalid`, normalized_phone: `+27000000000${suffix}`, password_hash: passwordHash, role: 'VENDOR', status: 'INACTIVE' })
      }
      if (!await trx('shops').where({ id: shopId }).first()) {
        await trx('shops').insert({ id: shopId, owner_id: vendorId, slug: `demo-shop-${suffix}`, name: `Demo Shop ${suffix} (fictional)`, phone: `+27000000000${suffix}`, address: 'Fictional collection address', area: 'Demo area', hours_json: JSON.stringify({}), approval_status: 'DRAFT', is_paused: true })
        await trx('vendor_applications').insert({ id: randomUUID(), shop_id: shopId, submission_version: 1, status: 'DRAFT', profile_snapshot_json: JSON.stringify({ name: `Demo Shop ${suffix} (fictional)` }) })
      }
      if (!await trx('products').where({ id: productId }).first()) {
        await trx('products').insert({ id: productId, shop_id: shopId, category_id: category.id, name: 'Demo snack (fictional)', price: '25.00', available_qty: 10, low_stock_threshold: 3 })
        await trx('inventory_movements').insert({ id: randomUUID(), product_id: productId, type: 'ADJUST', quantity_delta: 10, available_after: 10, reason: 'Explicit development demo seed' })
      }
    }
    const customerId = '50000000-0000-4000-8000-000000000001'
    if (!await trx('users').where({ id: customerId }).first()) {
      await trx('users').insert({ id: customerId, full_name: 'Demo Customer', normalized_email: 'customer@example.invalid', normalized_phone: '+270000000003', password_hash: passwordHash, role: 'CUSTOMER', status: 'INACTIVE' })
    }
  })
}
