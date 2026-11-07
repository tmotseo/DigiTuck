import { fileURLToPath } from 'node:url'
import { readConfig } from '../apps/api/src/config.js'
import { createDatabase } from '../apps/api/src/db/client.js'
const config = readConfig()
const db = createDatabase(config.DATABASE_URL)
const migrations = { directory: fileURLToPath(new URL('../db/migrations', import.meta.url)), loadExtensions: ['.mjs'] }
try {
  switch (process.argv[2]) {
    case 'migrate': console.info(await db.migrate.latest(migrations)); break
    case 'rollback':
      if (config.NODE_ENV === 'production') throw new Error('Production rollback requires an operator-reviewed recovery procedure.')
      console.info(await db.migrate.rollback(migrations)); break
    case 'seed': console.info(await db.seed.run({ directory: fileURLToPath(new URL('../db/seeds', import.meta.url)), loadExtensions: ['.mjs'] })); break
    case 'check': {
      const [rows] = await db.raw('SELECT VERSION() AS version, @@session.time_zone AS timezone')
      console.info(rows)
      console.info(await db.migrate.list(migrations))
      break
    }
    default: throw new Error('Use migrate, rollback, seed or check.')
  }
} catch (error) {
  // Never print driver connection configuration or credentials.
  console.error(error instanceof Error && !('sql' in error) ? error.message.replace(/mysql:\/\/\S+/g, '[redacted]') : 'Database operation failed; verify the local service, migration state and configuration.')
  process.exitCode = 1
} finally { await db.destroy() }

