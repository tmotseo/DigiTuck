// Runs only against a disposable real MySQL database. Never a deployment entrypoint.
import '../apps/api/src/config.js'
import { fileURLToPath } from 'node:url'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDatabase } from '../apps/api/src/db/client.js'
import { makeSessionStore } from '../apps/api/src/middleware/security.js'
import { createApp } from '../apps/api/src/app.js'
import { localStorage } from '../apps/api/src/lib/storage.js'
import { bootstrapAdmin } from '../apps/api/src/modules/admin/bootstrap.js'
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.endsWith('_test') || process.env.ALLOW_DB_TEST_RESET !== 'true') throw new Error('Browser tests require disposable TEST_DATABASE_URL ending _test and ALLOW_DB_TEST_RESET=true.')
const db = createDatabase(url)
const [rows] = await db.raw('SELECT VERSION() AS version')
if (!String(rows[0].version).startsWith('8.4.')) throw new Error('Real MySQL 8.4 is required.')
const migrations = { directory: fileURLToPath(new URL('../db/migrations', import.meta.url)), loadExtensions: ['.mjs'] }
await db.migrate.rollback(migrations, true); await db.migrate.latest(migrations)
await bootstrapAdmin(db, { fullName: 'Browser Test Admin', email: 'browser-admin@example.invalid', phone: '+27820000000', password: 'browser-only test passphrase' })
const directory = await mkdtemp(join(tmpdir(), 'digituck-browser-')), store = makeSessionStore(url)
const app = createApp({ webDirectory: fileURLToPath(new URL('../apps/web/dist', import.meta.url)), checkDatabase: async () => { await db.raw('SELECT 1') }, phaseTwo: { db, store, storage: localStorage(directory), documentTypes: ['business-proof'], security: { secret: 'test-only-browser-session-secret-32-characters', origins: ['http://127.0.0.1:4173'], production: false } } })
const server = app.listen(4173, '127.0.0.1')
for (const signal of ['SIGINT','SIGTERM'] as const) process.once(signal, () => { server.close(() => { void Promise.all([db.destroy(), store.close(), rm(directory, { recursive: true, force: true })]).finally(() => process.exit(0)) }) })
