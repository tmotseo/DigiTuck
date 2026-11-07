import { fileURLToPath } from 'node:url'
import { readConfig } from './config.js'
import { createDatabase } from './db/client.js'
import { createApp } from './app.js'
import { makeSessionStore } from './middleware/security.js'
import { localStorage, s3Storage } from './lib/storage.js'
import { resolve } from 'node:path'

const config = readConfig()
const db = createDatabase(config.DATABASE_URL)
const store = makeSessionStore(config.DATABASE_URL)
const storage = config.STORAGE_DRIVER === 's3' ? s3Storage({ bucket: config.S3_BUCKET!, region: config.S3_REGION!, endpoint: config.S3_ENDPOINT }) : localStorage(resolve(fileURLToPath(new URL('../../../', import.meta.url)), config.STORAGE_DIRECTORY))
const app = createApp({
  phaseTwo: { db, store, storage, documentTypes: config.DOCUMENT_TYPES.split(',').map(value => value.trim()).filter(Boolean), security: { secret: config.SESSION_SECRET, origins: [config.APP_ORIGIN], production: config.NODE_ENV === 'production', idleMs: config.SESSION_IDLE_MINUTES * 60000, absoluteMs: config.SESSION_ABSOLUTE_HOURS * 3600000 } },
  checkDatabase: async () => {
    await db.raw('SELECT 1')
    const migrated = await db('knex_migrations').where({ name: '002_phase_two.mjs' }).first()
    if (!migrated) throw new Error('Foundation migration is not applied')
  },
  production: config.NODE_ENV === 'production', trustProxyHops: config.TRUST_PROXY_HOPS,
  ...(config.NODE_ENV === 'production' ? { webDirectory: fileURLToPath(new URL('../../web/dist', import.meta.url)) } : {})
})
const server = app.listen(config.PORT, '127.0.0.1', () => console.info(JSON.stringify({ event: 'listening', port: config.PORT })))
// Deployment binding is deliberately not enabled at this local foundation checkpoint.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    server.close(() => { void Promise.all([db.destroy(), store.close()]).finally(() => process.exit(0)) })
    setTimeout(() => process.exit(1), 10000).unref()
  })
}

