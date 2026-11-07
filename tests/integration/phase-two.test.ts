import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import request from 'supertest'
import { fileURLToPath } from 'node:url'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import '../../apps/api/src/config.js'
import { createDatabase } from '../../apps/api/src/db/client.js'
import { createApp } from '../../apps/api/src/app.js'
import { makeSessionStore } from '../../apps/api/src/middleware/security.js'
import { localStorage } from '../../apps/api/src/lib/storage.js'
import { bootstrapAdmin } from '../../apps/api/src/modules/admin/bootstrap.js'

const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.endsWith('_test') || process.env.ALLOW_DB_TEST_RESET !== 'true') throw new Error('Use disposable TEST_DATABASE_URL ending _test and ALLOW_DB_TEST_RESET=true.')
const db = createDatabase(url), store = makeSessionStore(url), stores = [store]
const origin = 'http://localhost:4173', password = 'test-only long passphrase', secret = 'integration-only-secret-32-characters-long'
let directory: string
const storage = localStorage(join(tmpdir(), 'unused'))
const options = { db, store, storage, documentTypes: ['business-proof'], security: { secret, origins: [origin], production: false } }
const app = createApp({ checkDatabase: async () => { await db.raw('SELECT 1') }, phaseTwo: options })
type Agent = ReturnType<typeof request.agent>
const vendor = request.agent(app), customer = request.agent(app), other = request.agent(app), admin = request.agent(app)
const path = (value: string) => '/api/v1' + value
async function mutate(agent: Agent, route: string, body: object, method: 'post' | 'put' | 'patch' | 'delete' = 'post') {
  const csrf = await agent.get(path('/auth/csrf')).expect(200)
  return agent[method](path(route)).set('Origin', origin).set('X-CSRF-Token', csrf.body.data.csrfToken).send(body)
}
async function register(agent: Agent, name: string, role = 'CUSTOMER') { return mutate(agent, '/auth/register', { fullName: name, email: name + '@example.invalid', phone: '+2782' + String(++phone).padStart(7, '0'), password, role }) }
let phone = 100, vendorId: string, adminId: string, documentId: string, shopId: string
const profile = { name: 'Integration tuckshop', description: 'Local favourites', phone: '+27821112222', address: '12 Community Street', area: 'Soweto', hours: [{ day: 1, open: '08:00', close: '17:00' }], isPaused: false }
async function vendorState() { return (await vendor.get(path('/vendor/shop')).expect(200)).body.data }
async function upload(agent: Agent, version: number, bytes = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF'), mime = 'application/pdf') {
  const csrf = await agent.get(path('/auth/csrf')).expect(200)
  return agent.post(path('/vendor/documents')).set('Origin', origin).set('X-CSRF-Token', csrf.body.data.csrfToken).field('expectedVersion', version).field('type', 'business-proof').attach('document', bytes, { filename: 'business.pdf', contentType: mime })
}
beforeAll(async () => {
  const [rows] = await db.raw('SELECT VERSION() AS version'); expect(rows[0].version).toMatch(/^8\.4\./)
  const migrations = { directory: fileURLToPath(new URL('../../db/migrations', import.meta.url)), loadExtensions: ['.mjs'] }
  await db.migrate.rollback(migrations, true); await db.migrate.latest(migrations)
  directory = await mkdtemp(join(tmpdir(), 'digituck-phase2-')); Object.assign(storage, localStorage(directory))
  adminId = await bootstrapAdmin(db, { fullName: 'Review Admin', email: 'admin@example.invalid', phone: '+27820000000', password })
})
afterAll(async () => { await Promise.all(stores.map(value => value.close())); await db.destroy(); if (directory) await rm(directory, { recursive: true, force: true }) })
describe('Phase 2 with real MySQL', () => {
  it('requires CSRF and exact Origin before registration; rejects public admin registration', async () => {
    await request(app).post(path('/auth/register')).send({}).expect(403)
    const csrf = await customer.get(path('/auth/csrf')).expect(200)
    await customer.post(path('/auth/register')).set('Origin', 'https://evil.invalid').set('X-CSRF-Token', csrf.body.data.csrfToken).send({}).expect(403)
    expect((await register(customer, 'adminAttempt', 'ADMIN')).status).toBe(422)
  })
  it('registers normalised unique accounts with hashed passwords and role checks', async () => {
    const result = await register(vendor, 'Vendor', 'VENDOR'); expect(result.status).toBe(201); vendorId = result.body.data.id
    expect(result.body.data.email).toBe('vendor@example.invalid'); expect(result.body.data.password_hash).toBeUndefined()
    expect((await db('users').where({ id: vendorId }).first()).password_hash).toMatch(/^\$2[aby]\$12\$/)
    expect((await register(customer, 'customer')).status).toBe(201)
    expect((await register(other, 'otherVendor', 'VENDOR')).status).toBe(201)
    expect((await mutate(request.agent(app), '/auth/register', { fullName: 'Duplicate', email: ' VENDOR@EXAMPLE.INVALID ', phone: '+27829999999', password, role: 'CUSTOMER' })).status).toBe(409)
    await customer.get(path('/vendor/shop')).expect(403); await vendor.get(path('/admin/vendors')).expect(403)
    await request(app).get(path('/admin/users')).expect(401)
  })
  it('rotates sessions on login and stores them durably across app instances', async () => {
    const fresh = request.agent(app), csrf = await fresh.get(path('/auth/csrf'))
    const login = await mutate(fresh, '/auth/login', { email: 'vendor@example.invalid', password }); expect(login.status).toBe(200)
    const cookie = login.headers['set-cookie']![0]!.split(';')[0]!
    expect(cookie).not.toBe(csrf.headers['set-cookie']![0]!.split(';')[0]); expect(login.headers['set-cookie']![0]).toContain('HttpOnly'); expect(login.headers['set-cookie']![0]).toContain('SameSite=Lax')
    const secondStore = makeSessionStore(url!); stores.push(secondStore)
    const secondApp = createApp({ checkDatabase: async () => {}, phaseTwo: { ...options, store: secondStore } })
    await request(secondApp).get(path('/auth/me')).set('Cookie', cookie).expect(200)
    expect((await mutate(fresh, '/auth/logout', {})).status).toBe(204)
    await request(secondApp).get(path('/auth/me')).set('Cookie', cookie).expect(401)
  })
  it('persists throttling in MySQL across clients without revealing account existence', async () => {
    for (let i = 0; i < 5; i++) expect((await mutate(request.agent(app), '/auth/login', { email: 'missing@example.invalid', password })).status).toBe(401)
    expect((await mutate(request.agent(app), '/auth/login', { email: 'missing@example.invalid', password })).status).toBe(429)
    expect(Number((await db('auth_rate_limits').whereNotNull('blocked_until').count('* as count').first())?.count)).toBeGreaterThan(0)
  })
  it('enforces idle and absolute expiry from durable session data and secure production cookies', async () => {
    for (const field of ['lastSeen', 'startedAt']) {
      const agent = request.agent(app)
      expect((await mutate(agent, '/auth/login', { email: 'vendor@example.invalid', password })).status).toBe(200)
      const sessions = await db('sessions').select('session_id', 'data')
      for (const row of sessions) {
        const data = JSON.parse(row.data)
        if (data.userId === vendorId) { data[field] = 1; await db('sessions').where({ session_id: row.session_id }).update({ data: JSON.stringify(data) }) }
      }
      await agent.get(path('/auth/me')).expect(401)
    }
    await vendor.get(path('/auth/me')).expect(401)
    expect((await mutate(vendor, '/auth/login', { email: 'vendor@example.invalid', password })).status).toBe(200)
    const secureStore = makeSessionStore(url!); stores.push(secureStore)
    const secureApp = createApp({ checkDatabase: async () => {}, trustProxyHops: 1, production: true, phaseTwo: { ...options, store: secureStore, security: { ...options.security, production: true } } })
    const result = await request(secureApp).get(path('/auth/csrf')).set('X-Forwarded-Proto', 'https').expect(200)
    expect(result.headers['set-cookie']![0]).toMatch(/^__Host-digituck.sid=/)
    expect(result.headers['set-cookie']![0]).toContain('Secure')
    expect(result.headers['set-cookie']![0]).toContain('Path=/')
    expect(result.headers['set-cookie']![0]).not.toContain('Domain=')
  })
  it('edits only the signed-in account and revokes every session after password change', async () => {
    const second = request.agent(app); expect((await mutate(second, '/auth/login', { email: 'customer@example.invalid', password })).status).toBe(200)
    expect((await mutate(customer, '/account', { fullName: 'Customer Edited', phone: '+27821113333', role: 'ADMIN' }, 'patch')).status).toBe(422)
    expect((await mutate(customer, '/account', { fullName: 'Customer Edited', phone: '+27821113333' }, 'patch')).status).toBe(200)
    expect((await mutate(customer, '/account/password', { currentPassword: password, newPassword: 'replacement long password' })).status).toBe(204)
    await second.get(path('/auth/me')).expect(401); await customer.get(path('/auth/me')).expect(401)
  })
  it('requires valid private documents and freezes submitted versions', async () => {
    let response = await mutate(vendor, '/vendor/shop', { ...profile, expectedVersion: 0 }, 'put'); expect(response.status).toBe(200); shopId = response.body.data.shop.id
    let state = await vendorState()
    expect((await mutate(vendor, '/vendor/shop/submit', { expectedVersion: state.shop.version })).status).toBe(422)
    expect((await upload(vendor, state.shop.version, Buffer.from('<html>evil</html>'))).status).toBe(422)
    expect((await upload(vendor, state.shop.version, Buffer.from('%PDF-1.7\n%%EOF'), 'image/png')).status).toBe(422)
    expect((await upload(vendor, state.shop.version, Buffer.alloc(10485761))).status).toBe(422)
    response = await upload(vendor, state.shop.version); expect(response.status).toBe(201); documentId = response.body.data.documents[0].id
    expect(response.body.data.documents[0].object_key).toBeUndefined()
    await other.get(path('/vendor/documents/' + documentId + '/download')).expect(404)
    await request(app).get(path('/vendor/documents/' + documentId + '/download')).expect(401)
    await vendor.get(path('/vendor/documents/' + documentId + '/download')).expect(200).expect('Content-Disposition', /attachment/)
    await request(app).get('/uploads/' + documentId).expect(404)
    state = await vendorState(); expect((await mutate(vendor, '/vendor/shop/submit', { expectedVersion: state.shop.version })).status).toBe(200)
    state = await vendorState(); expect((await upload(vendor, state.shop.version)).status).toBe(409)
    expect((await mutate(vendor, '/vendor/documents/' + documentId, { expectedVersion: state.shop.version }, 'delete')).status).toBe(409)
    await expect(db('vendor_applications').where({ shop_id: shopId }).update({ profile_snapshot_json: '{}' })).rejects.toThrow()
    expect((await request(app).get(path('/shops'))).body.data).toHaveLength(0)
  })
  it('rejects stale and concurrent approvals and exposes only approved shops', async () => {
    expect((await mutate(admin, '/auth/login', { email: 'admin@example.invalid', password })).status).toBe(200)
    const state = await vendorState(), decision = { expectedVersion: state.shop.version, submissionVersion: 1, action: 'APPROVE', reason: 'Documents verified' }
    expect((await mutate(admin, '/admin/vendors/' + shopId + '/decision', { ...decision, expectedVersion: state.shop.version - 1 })).status).toBe(409)
    const token = (await admin.get(path('/auth/csrf'))).body.data.csrfToken
    const responses = await Promise.all([1,2].map(() => admin.post(path('/admin/vendors/' + shopId + '/decision')).set('Origin', origin).set('X-CSRF-Token', token).send(decision)))
    expect(responses.map(value => value.status).sort()).toEqual([200,409])
    expect((await request(app).get(path('/shops'))).body.data).toHaveLength(1)
    await admin.get(path('/admin/documents/' + documentId + '/download')).expect(200)
    expect(Number((await db('audit_events').where({ action: 'VENDOR_APPROVE' }).count('* as count').first())?.count)).toBe(1)
  })
  it('suspension survives revision and rejection; approval must name the new version', async () => {
    let state = await vendorState()
    expect((await mutate(admin, '/admin/vendors/' + shopId + '/decision', { expectedVersion: state.shop.version, submissionVersion: 1, action: 'SUSPEND', reason: 'Review required again' })).status).toBe(200)
    state = await vendorState(); expect((await mutate(vendor, '/vendor/shop', { ...profile, name: 'Changed name', expectedVersion: state.shop.version }, 'put')).status).toBe(200)
    state = await vendorState(); expect(state.shop.status).toBe('SUSPENDED'); expect(state.shop.submissionVersion).toBe(2)
    expect((await upload(vendor, state.shop.version)).status).toBe(201); state = await vendorState()
    expect((await mutate(vendor, '/vendor/shop/submit', { expectedVersion: state.shop.version })).status).toBe(200); state = await vendorState()
    expect((await mutate(admin, '/admin/vendors/' + shopId + '/decision', { expectedVersion: state.shop.version, submissionVersion: 1, action: 'APPROVE', reason: 'Old review attempt' })).status).toBe(409)
    expect((await mutate(admin, '/admin/vendors/' + shopId + '/decision', { expectedVersion: state.shop.version, submissionVersion: 2, action: 'REJECT', reason: 'Please correct proof' })).status).toBe(200)
    state = await vendorState(); expect(state.shop.status).toBe('SUSPENDED'); expect(state.application.decision_reason).toBe('Please correct proof')
    expect((await request(app).get(path('/shops'))).body.data).toHaveLength(0)
    const history = await admin.get(path('/admin/vendors/' + shopId + '?submissionVersion=1')).expect(200)
    expect(history.body.data.application.status).toBe('APPROVED'); expect(history.body.data.documents[0].id).toBe(documentId)
  })
  it('legal-name edits require reapproval, inactive users lose access, and last admin is protected', async () => {
    const before = await vendorState()
    expect((await mutate(vendor, '/account', { fullName: 'Changed Legal Name', phone: '+27821114444' }, 'patch')).status).toBe(200)
    expect((await vendorState()).shop.submissionVersion).toBe(before.shop.submissionVersion + 1)
    expect((await mutate(admin, '/admin/users/' + vendorId + '/status', { status: 'INACTIVE', reason: 'Account deactivated for review' }, 'patch')).status).toBe(200)
    await vendor.get(path('/vendor/shop')).expect(401)
    expect((await mutate(admin, '/admin/users/' + adminId + '/status', { status: 'INACTIVE', reason: 'Attempt last admin removal' }, 'patch')).status).toBe(409)
    const events = await admin.get(path('/admin/audit')).expect(200); expect(events.body.data.length).toBeGreaterThan(0)
  })
  it('hides approved shops immediately on owner deactivation or material address changes', async () => {
    const saved = await mutate(other, '/vendor/shop', { ...profile, name: 'Second shop', expectedVersion: 0 }, 'put'); expect(saved.status).toBe(200)
    const uploaded = await upload(other, saved.body.data.shop.version); expect(uploaded.status).toBe(201)
    const submitted = await mutate(other, '/vendor/shop/submit', { expectedVersion: uploaded.body.data.shop.version }); expect(submitted.status).toBe(200)
    const shop = submitted.body.data.shop
    expect((await mutate(admin, '/admin/vendors/' + shop.id + '/decision', { expectedVersion: shop.version, submissionVersion: 1, action: 'APPROVE', reason: 'All details verified' })).status).toBe(200)
    expect((await request(app).get(path('/shops'))).body.data).toHaveLength(1)
    const owner = (await other.get(path('/auth/me'))).body.data.id
    expect((await mutate(admin, '/admin/users/' + owner + '/status', { status: 'INACTIVE', reason: 'Temporary account restriction' }, 'patch')).status).toBe(200)
    expect((await request(app).get(path('/shops'))).body.data).toHaveLength(0)
    await other.get(path('/auth/me')).expect(401)
    expect((await mutate(admin, '/admin/users/' + owner + '/status', { status: 'ACTIVE', reason: 'Account restriction resolved' }, 'patch')).status).toBe(200)
    expect((await mutate(other, '/auth/login', { email: 'othervendor@example.invalid', password })).status).toBe(200)
    const current = (await other.get(path('/vendor/shop'))).body.data.shop
    const changed = await mutate(other, '/vendor/shop', { ...profile, name: 'Second shop', address: '99 New Collection Road', expectedVersion: current.version }, 'put')
    expect(changed.status).toBe(200); expect(changed.body.data.shop.status).toBe('DRAFT'); expect(changed.body.data.shop.submissionVersion).toBe(2)
    expect((await request(app).get(path('/shops'))).body.data).toHaveLength(0)
    const old = (await admin.get(path('/admin/vendors/' + shop.id + '?submissionVersion=1'))).body.data.application
    expect((typeof old.profile_snapshot_json === 'string' ? JSON.parse(old.profile_snapshot_json) : old.profile_snapshot_json).address).toBe(profile.address)
  })
})
