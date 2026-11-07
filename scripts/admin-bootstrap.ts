import { readConfig } from '../apps/api/src/config.js'
import { createDatabase } from '../apps/api/src/db/client.js'
import { bootstrapAdmin } from '../apps/api/src/modules/admin/bootstrap.js'
import { bootstrapSchema } from '@digituck/contracts'
const config = readConfig()
const parsed = bootstrapSchema.safeParse({ fullName: process.env.ADMIN_FULL_NAME, email: process.env.ADMIN_EMAIL, phone: process.env.ADMIN_PHONE, password: process.env.ADMIN_PASSWORD })
if (!parsed.success) {
  console.error('Set valid ADMIN_FULL_NAME, ADMIN_EMAIL, ADMIN_PHONE and ADMIN_PASSWORD. Password: 12+ characters, at most 72 UTF-8 bytes. Phone: international + format.')
  process.exitCode = 1
} else {
  const db = createDatabase(config.DATABASE_URL)
  try {
    const id = await bootstrapAdmin(db, parsed.data)
    console.info('Administrator created: ' + id + '. Login is not implemented until Phase 2.')
  } catch {
    console.error('Bootstrap failed. Check the database/migrations and whether the account already exists. No existing account was promoted.')
    process.exitCode = 1
  } finally { delete process.env.ADMIN_PASSWORD; await db.destroy() }
}

