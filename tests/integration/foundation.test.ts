import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import '../../apps/api/src/config.js'
import { createDatabase } from '../../apps/api/src/db/client.js'
import { bootstrapAdmin } from '../../apps/api/src/modules/admin/bootstrap.js'

const url = process.env.TEST_DATABASE_URL
if (!url || process.env.ALLOW_DB_TEST_RESET !== 'true') throw new Error('Real MySQL tests require TEST_DATABASE_URL and ALLOW_DB_TEST_RESET=true. No database was changed.')
const parsed = new URL(url)
if (!parsed.pathname.endsWith('_test')) throw new Error('Disposable test database name must end in _test.')
const db = createDatabase(url)
const migrations = { directory: fileURLToPath(new URL('../../db/migrations', import.meta.url)), loadExtensions: ['.mjs'] }
const seeds = { directory: fileURLToPath(new URL('../../db/seeds', import.meta.url)), loadExtensions: ['.mjs'] }
const ids = { customer: '50000000-0000-4000-8000-000000000001', vendor: '20000000-0000-4000-8000-000000000001', shop: '30000000-0000-4000-8000-000000000001', otherShop: '30000000-0000-4000-8000-000000000002', product: '40000000-0000-4000-8000-000000000001', otherProduct: '40000000-0000-4000-8000-000000000002' }
const orderId = randomUUID()
beforeAll(async () => {
  const [rows] = await db.raw('SELECT VERSION() AS version')
  if (!String(rows[0].version).startsWith('8.4.')) throw new Error('Tests require genuine MySQL 8.4, not SQLite/MariaDB.')
  await db.migrate.rollback(migrations, true)
  await db.migrate.latest(migrations)
  process.env.NODE_ENV = 'test'; process.env.ALLOW_DEMO_SEED = 'true'
  await db.seed.run(seeds)
})
afterAll(async () => { await db.destroy() })
describe('MySQL foundation', () => {
  it('migrates once and seeds repeatedly without changing existing data', async () => {
    expect((await db.migrate.latest(migrations))[1]).toHaveLength(0)
    await db('products').where({ id: ids.product }).update({ available_qty: 7 })
    await db.seed.run(seeds)
    expect(await db('users').count('* as count').first()).toMatchObject({ count: 3 })
    expect((await db('products').where({ id: ids.product }).first()).available_qty).toBe(7)
    expect(await db('inventory_movements').count('* as count').first()).toMatchObject({ count: 2 })
    expect((await db('products').where({ id: ids.product }).first()).price).toBe('25.00')
  })
  it('enforces stock, money, enum, unique and foreign-key constraints', async () => {
    await expect(db('products').where({ id: ids.product }).update({ available_qty: -1 })).rejects.toThrow()
    await expect(db('products').where({ id: ids.product }).update({ price: '0.00' })).rejects.toThrow()
    await expect(db('users').where({ id: ids.customer }).update({ role: 'DRIVER' })).rejects.toThrow()
    await expect(db('products').where({ id: ids.product }).update({ category_id: randomUUID() })).rejects.toThrow()
    await expect(db('users').where({ id: ids.customer }).update({ normalized_email: 'vendor1@example.invalid' })).rejects.toThrow()
    await expect(db('shops').where({ id: ids.otherShop }).update({ owner_id: ids.vendor })).rejects.toThrow()
  })
  it('freezes submitted profiles and documents but allows review metadata', async () => {
    const docId = randomUUID()
    await db('vendor_documents').insert({ id: docId, shop_id: ids.shop, submission_version: 1, type: 'demo', object_key: randomUUID(), original_name: 'example.pdf', detected_mime: 'application/pdf', bytes: 100 })
    await db('vendor_applications').where({ shop_id: ids.shop }).update({ status: 'PENDING', submitted_at: db.fn.now(3) })
    await expect(db('vendor_applications').where({ shop_id: ids.shop }).update({ profile_snapshot_json: '{}' })).rejects.toThrow()
    await expect(db('vendor_documents').where({ id: docId }).update({ object_key: 'replacement' })).rejects.toThrow()
    await expect(db('vendor_documents').where({ id: docId }).delete()).rejects.toThrow()
    await expect(db('vendor_documents').insert({ id: randomUUID(), shop_id: ids.shop, submission_version: 1, type: 'demo', object_key: randomUUID(), original_name: 'example.pdf', detected_mime: 'application/pdf', bytes: 100 })).rejects.toThrow()
    await db('vendor_applications').where({ shop_id: ids.shop }).update({ status: 'REJECTED', decision_reason: 'Integration test' })
  })
  it('enforces one-shop order items, exact lines and immutable snapshots', async () => {
    await db('orders').insert({ id: orderId, reference: 'DT-TEST-' + randomUUID().slice(0,8), customer_id: ids.customer, shop_id: ids.shop, total_amount: '50.00', shop_name_snapshot: 'Original shop', pickup_address_snapshot: 'Original address', expires_at: '2030-01-01 00:00:00' })
    const item = { id: randomUUID(), order_id: orderId, product_id: ids.product, shop_id: ids.shop, name_snapshot: 'Original snack', unit_price: '25.00', quantity: 2, line_total: '50.00' }
    await expect(db('order_items').insert({ ...item, product_id: ids.otherProduct })).rejects.toThrow()
    await expect(db('order_items').insert({ ...item, line_total: '49.99' })).rejects.toThrow()
    await db('order_items').insert(item)
    await expect(db('order_items').where({ id: item.id }).update({ restocked_qty: 3 })).rejects.toThrow()
    await db('products').where({ id: ids.product }).update({ name: 'Changed', price: '30.00', archived_at: db.fn.now(3) })
    expect((await db('order_items').where({ id: item.id }).first()).name_snapshot).toBe('Original snack')
    await expect(db('orders').where({ id: orderId }).update({ shop_name_snapshot: 'Rewritten' })).rejects.toThrow()
    await expect(db('order_items').where({ id: item.id }).update({ unit_price: '30.00', line_total: '60.00' })).rejects.toThrow()
    await expect(db('orders').where({ id: orderId }).delete()).rejects.toThrow()
  })
  it('enforces idempotency and reservation uniqueness; history is append-only', async () => {
    const key = { id: randomUUID(), user_id: ids.customer, operation: 'checkout', request_key: randomUUID(), request_hash: 'a'.repeat(64) }
    await db('idempotency_requests').insert(key)
    await expect(db('idempotency_requests').insert({ ...key, id: randomUUID() })).rejects.toThrow()
    const movement = { id: randomUUID(), product_id: ids.product, order_id: orderId, type: 'RESERVE', quantity_delta: -2, available_after: 5, reason: 'Schema test' }
    await db('inventory_movements').insert(movement)
    await expect(db('inventory_movements').insert({ ...movement, id: randomUUID() })).rejects.toThrow()
    await expect(db('inventory_movements').where({ id: movement.id }).delete()).rejects.toThrow()
    const event = { id: randomUUID(), order_id: orderId, to_status: 'PENDING' }
    await db('order_events').insert(event)
    await expect(db('order_events').where({ id: event.id }).update({ reason: 'rewrite' })).rejects.toThrow()
  })
  it('creates an audited bcrypt admin, never promotes existing accounts', async () => {
    const input = { fullName: 'Test Operator', email: 'operator@example.invalid', phone: '+27820000001', password: 'temporary test passphrase' }
    const id = await bootstrapAdmin(db, input)
    const user = await db('users').where({ id }).first()
    expect(user.role).toBe('ADMIN')
    expect(await bcrypt.compare(input.password, user.password_hash)).toBe(true)
    expect(await db('audit_events').where({ entity_id: id }).count('* as count').first()).toMatchObject({ count: 1 })
    await expect(bootstrapAdmin(db, input)).rejects.toThrow('already uses')
    await expect(bootstrapAdmin(db, { ...input, email: 'customer@example.invalid', phone: '+27820000002' })).rejects.toThrow('already uses')
    expect((await db('users').where({ id: ids.customer }).first()).role).toBe('CUSTOMER')
    await expect(db('audit_events').where({ entity_id: id }).delete()).rejects.toThrow()
  })
})

