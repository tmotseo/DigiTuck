import { beforeAll, afterAll, it, expect } from 'vitest'
import request from 'supertest'
import { fileURLToPath } from 'node:url'
import '../../apps/api/src/config.js'
import { createDatabase } from '../../apps/api/src/db/client.js'
import { createApp } from '../../apps/api/src/app.js'
import { makeSessionStore } from '../../apps/api/src/middleware/security.js'
import { localStorage } from '../../apps/api/src/lib/storage.js'
import { change } from '../../apps/api/src/modules/catalogue/service.js'

const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.endsWith('_test') || process.env.ALLOW_DB_TEST_RESET !== 'true') throw new Error('Disposable MySQL test database required.')
const db = createDatabase(url), store = makeSessionStore(url), origin = 'http://localhost:4173'
const app = createApp({ checkDatabase: async () => {}, phaseTwo: { db, store, storage: localStorage('.git/unused-catalogue-storage'), documentTypes: [], security: { secret: 'catalogue-test-only-secret-32-characters', origins: [origin], production: false } } })
const vendor = request.agent(app), other = request.agent(app), customer = request.agent(app)
type Agent = typeof vendor
async function mutate(agent: Agent, path: string, body: object, method: 'post' | 'patch' | 'put' | 'delete' = 'post') {
  const csrf = await agent.get('/api/v1/auth/csrf')
  return agent[method]('/api/v1' + path).set('Origin', origin).set('X-CSRF-Token', csrf.body.data.csrfToken).send(body)
}
let owner: string, shop: string, slug: string, productId: string
const input = { name: 'Fresh bread', description: 'Baked daily', categoryId: 'ca000000-0000-4000-8000-000000000001', price: '12.50', lowStockThreshold: 5, isVisible: true }
beforeAll(async () => {
  const migrations = { directory: fileURLToPath(new URL('../../db/migrations', import.meta.url)), loadExtensions: ['.mjs'] }
  await db.migrate.rollback(migrations, true); await db.migrate.latest(migrations)
  let phone = 0
  for (const [agent, role] of [[vendor, 'VENDOR'], [other, 'VENDOR'], [customer, 'CUSTOMER']] as const) {
    const result = await mutate(agent, '/auth/register', { fullName: 'Catalogue User', email: `catalogue${++phone}@example.invalid`, phone: '+2782111000' + phone, password: 'catalogue test password', role })
    expect(result.status).toBe(201)
    if (agent === vendor) owner = result.body.data.id
    if (role === 'VENDOR') expect((await mutate(agent, '/vendor/shop', { name: 'Catalogue shop ' + phone, description: '', phone: '+2782111000' + phone, address: '12 Main Street', area: 'Soweto', hours: [], isPaused: false, expectedVersion: 0 }, 'put')).status).toBe(200)
  }
  const row = await db('shops').where({ owner_id: owner }).first(); shop = row.id; slug = row.slug
})
afterAll(async () => { await store.close(); await db.destroy() })
it('creates stock in a private draft shop with strict validation and ownership', async () => {
  expect((await mutate(customer, '/vendor/products', { ...input, initialQuantity: 8 })).status).toBe(403)
  expect((await mutate(vendor, '/vendor/products', { ...input, initialQuantity: -1 })).status).toBe(422)
  expect((await mutate(vendor, '/vendor/products', { ...input, initialQuantity: 1, shopId: shop })).status).toBe(422)
  expect((await mutate(vendor, '/vendor/products', { ...input, price: '0.00', initialQuantity: 1 })).status).toBe(422)
  const created = await mutate(vendor, '/vendor/products', { ...input, initialQuantity: 8 })
  expect(created.status).toBe(201); productId = created.body.data.id
  expect((await db('inventory_movements').where({ product_id: productId }).first()).quantity_delta).toBe(8)
  await request(app).get('/api/v1/shops/' + slug).expect(404)
  expect((await mutate(other, '/vendor/products/' + productId, { ...input, expectedVersion: 1 }, 'patch')).status).toBe(404)
  expect((await mutate(other, '/vendor/products/' + productId + '/stock', { expectedVersion: 1, quantityDelta: 1, reason: 'Delivery' })).status).toBe(404)
  expect((await mutate(other, '/vendor/products/' + productId, { expectedVersion: 1 }, 'delete')).status).toBe(404)
})
it('publishes exact counts and stock, and excludes hidden/moderated/inactive categories', async () => {
  await db('shops').where({ id: shop }).update({ approval_status: 'APPROVED' })
  let catalogue = (await request(app).get('/api/v1/shops/' + slug).expect(200)).body.data
  expect(catalogue.products).toMatchObject({ total: 1, availableUnits: 8 })
  expect(catalogue.products.items[0]).toMatchObject({ price: '12.50', availableQuantity: 8 })
  expect((await request(app).get('/api/v1/shops')).body.data[0]).toMatchObject({ productCount: 1, availableUnits: 8 })
  expect((await mutate(vendor, '/vendor/products', { ...input, name: 'Private item', isVisible: false, initialQuantity: 30 })).status).toBe(201)
  expect((await request(app).get('/api/v1/shops/' + slug)).body.data.products.total).toBe(1)
  await db('products').where({ id: productId }).update({ moderation_hidden_at: db.fn.now() })
  expect((await request(app).get('/api/v1/shops/' + slug)).body.data.products.total).toBe(0)
  await db('products').where({ id: productId }).update({ moderation_hidden_at: null })
  await db('categories').where({ id: input.categoryId }).update({ is_active: false })
  expect((await request(app).get('/api/v1/shops/' + slug)).body.data.products.total).toBe(0)
  await db('categories').where({ id: input.categoryId }).update({ is_active: true })
  catalogue = (await request(app).get('/api/v1/shops/' + slug + '?limit=1')).body.data
  expect(catalogue.products.items).toHaveLength(1)
  await request(app).get('/api/v1/shops/' + slug + '?limit=101').expect(422)
})
it('serializes competing stock edits in real MySQL; rejects stale retries and negative stock atomically', async () => {
  const results = await Promise.allSettled([
    change(db, owner, productId, 1, { quantityDelta: -8, reason: 'Sold in store' }),
    change(db, owner, productId, 1, { quantityDelta: -8, reason: 'Concurrent sale' })
  ])
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
  expect((await db('products').where({ id: productId }).first()).available_qty).toBe(0)
  expect(await db('inventory_movements').where({ product_id: productId })).toHaveLength(2)
  expect((await mutate(vendor, `/vendor/products/${productId}/stock`, { expectedVersion: 2, quantityDelta: -1, reason: 'Invalid removal' })).status).toBe(422)
  expect(await db('inventory_movements').where({ product_id: productId })).toHaveLength(2)
  expect((await request(app).get('/api/v1/shops/' + slug)).body.data.products).toMatchObject({ total: 1, availableUnits: 0 })
  expect((await mutate(vendor, `/vendor/products/${productId}/stock`, { expectedVersion: 2, quantityDelta: 12, reason: 'New delivery' })).status).toBe(200)
  expect((await mutate(vendor, `/vendor/products/${productId}/stock`, { expectedVersion: 2, quantityDelta: 12, reason: 'New delivery' })).status).toBe(409)
})
it('edits and archives without deleting history; hides suspended shops and inactive owners', async () => {
  expect((await mutate(vendor, '/vendor/products/' + productId, { ...input, price: '15.25', expectedVersion: 3 }, 'patch')).status).toBe(200)
  expect((await request(app).get('/api/v1/shops/' + slug)).body.data.products.items[0].price).toBe('15.25')
  await db('shops').where({ id: shop }).update({ approval_status: 'SUSPENDED' })
  await request(app).get('/api/v1/shops/' + slug).expect(404)
  await db('shops').where({ id: shop }).update({ approval_status: 'APPROVED' })
  await db('users').where({ id: owner }).update({ status: 'INACTIVE' })
  await request(app).get('/api/v1/shops/' + slug).expect(404)
  await db('users').where({ id: owner }).update({ status: 'ACTIVE' })
  expect((await mutate(vendor, '/vendor/products/' + productId, { expectedVersion: 4 }, 'delete')).status).toBe(200)
  expect((await request(app).get('/api/v1/shops/' + slug)).body.data.products).toMatchObject({ total: 0, availableUnits: 0 })
  expect((await db('products').where({ id: productId }).first()).archived_at).not.toBeNull()
  expect(await db('inventory_movements').where({ product_id: productId })).toHaveLength(3)
})
