import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../apps/api/src/app.js'
import { healthSchema } from '@digituck/contracts'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
describe('health and JSON errors', () => {
  const app = createApp({ checkDatabase: async () => {} })
  it('serves liveness with a request ID and no session cookie', async () => {
    const response = await request(app).get('/api/v1/health/live').expect(200)
    expect(healthSchema.safeParse(response.body).success).toBe(true)
    expect(response.headers['x-request-id']).toBe(response.body.meta.requestId)
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(response.headers['cache-control']).toBe('no-store')
  })
  it('reports readiness only after a successful dependency check', async () => {
    await request(app).get('/api/v1/health/ready').expect(200)
    const down = createApp({ checkDatabase: async () => { throw new Error('mysql://secret:password@private-host') } })
    const response = await request(down).get('/api/v1/health/ready').expect(503)
    expect(response.body.error.code).toBe('DEPENDENCY_UNAVAILABLE')
    expect(JSON.stringify(response.body)).not.toMatch(/password|private-host/)
  })
  it('rejects absent APIs, invalid JSON and oversized bodies consistently', async () => {
    for (const method of ['get', 'post'] as const) {
      const response = await request(app)[method]('/api/v1/orders').expect(404).expect('Content-Type', /json/)
      expect(response.body.error.requestId).toBeTruthy()
    }
    await request(app).post('/api/v1/orders').set('Content-Type', 'application/json').send('{').expect(400)
    await request(app).post('/api/v1/orders').send({ text: 'x'.repeat(40000) }).expect(413)
  })
})
describe('production routing', () => {
  let directory: string
  beforeAll(async () => { directory = await mkdtemp(join(tmpdir(), 'digituck-http-')); await writeFile(join(directory, 'index.html'), '<html>DigiTuck test shell</html>') })
  afterAll(async () => { await rm(directory, { recursive: true, force: true }) })
  it('serves deep links but never HTML for missing APIs/assets', async () => {
    const app = createApp({ checkDatabase: async () => {}, webDirectory: directory, production: true })
    await request(app).get('/vendor/orders').set('Accept', 'text/html').expect(200).expect('Content-Type', /html/)
    await request(app).get('/api/v1/missing').set('Accept', 'text/html').expect(404).expect('Content-Type', /json/)
    await request(app).get('/assets/missing.js').expect(404)
    await request(app).post('/vendor/orders').expect(404).expect('Content-Type', /json/)
  })
})

