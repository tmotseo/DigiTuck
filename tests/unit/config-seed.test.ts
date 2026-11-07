import { afterEach, describe, expect, it } from 'vitest'
import { readConfig } from '../../apps/api/src/config.js'
const source = new URL('../../db/seeds/001_demo.mjs', import.meta.url).href
const seed = (await import(source)).seed as (db: unknown) => Promise<void>
const original = { mode: process.env.NODE_ENV, seed: process.env.ALLOW_DEMO_SEED }
afterEach(() => {
  if (original.mode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original.mode
  if (original.seed === undefined) delete process.env.ALLOW_DEMO_SEED; else process.env.ALLOW_DEMO_SEED = original.seed
})
describe('configuration and seed safety', () => {
  it('requires HTTPS, durable private storage and a secret in production', () => {
    const env = { NODE_ENV: 'production', DATABASE_URL: 'mysql://test:test@localhost/digituck_test', SESSION_SECRET: 'test-only-configuration-secret-32-characters', APP_ORIGIN: 'http://localhost:5173' }
    expect(() => readConfig(env)).toThrow('HTTPS')
    expect(() => readConfig({ ...env, APP_ORIGIN: 'https://example.invalid' })).toThrow('private S3')
    expect(() => readConfig({ ...env, APP_ORIGIN: 'https://example.invalid', STORAGE_DRIVER: 's3' })).toThrow('S3_BUCKET')
    expect(() => readConfig({ ...env, APP_ORIGIN: 'https://example.invalid', STORAGE_DRIVER: 's3', S3_BUCKET: 'private-test', S3_REGION: 'af-south-1' })).not.toThrow()
    expect(() => readConfig({ ...env, SESSION_SECRET: 'short' })).toThrow('SESSION_SECRET')
  })
  it('rejects missing database config without leaking supplied values', () => {
    expect(() => readConfig({ DATABASE_URL: 'postgres://secret', PORT: 'invalid' })).toThrow('Invalid server configuration')
  })
  it('blocks seeds before database access unless explicitly enabled', async () => {
    process.env.NODE_ENV = 'development'; delete process.env.ALLOW_DEMO_SEED
    await expect(seed(null)).rejects.toThrow('Demo seed refused')
  })
  it('always refuses production demo data even with opt-in', async () => {
    process.env.NODE_ENV = 'production'; process.env.ALLOW_DEMO_SEED = 'true'
    await expect(seed(null)).rejects.toThrow('Demo seed refused')
  })
})

