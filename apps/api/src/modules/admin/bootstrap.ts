import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { Knex } from 'knex'
import { bootstrapSchema, type BootstrapInput } from '@digituck/contracts'

export async function bootstrapAdmin(db: Knex, input: BootstrapInput) {
  const values = bootstrapSchema.parse(input)
  // Do not allow this trusted creation command to grant privileges to existing accounts.
  const passwordHash = await bcrypt.hash(values.password, 12)
  return db.transaction(async trx => {
    const existing = await trx('users').where('normalized_email', values.email).orWhere('normalized_phone', values.phone).first()
    if (existing) throw new Error('An account already uses those details. No changes were made.')
    const id = randomUUID()
    await trx('users').insert({ id, full_name: values.fullName, normalized_email: values.email, normalized_phone: values.phone, password_hash: passwordHash, role: 'ADMIN', status: 'ACTIVE' })
    await trx('audit_events').insert({ id: randomUUID(), actor_id: id, action: 'ADMIN_BOOTSTRAPPED', entity_type: 'user', entity_id: id, safe_metadata_json: JSON.stringify({ source: 'trusted-cli' }) })
    return id
  })
}

