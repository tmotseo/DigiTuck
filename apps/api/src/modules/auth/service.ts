import { randomUUID, createHmac, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { Knex } from 'knex'
import type { z } from 'zod'
import { registrationSchema, accountSchema, passwordChangeSchema } from '@digituck/contracts'
import { HttpError, isDuplicate } from '../../lib/errors.js'
import { findByEmail, type UserRow } from './repository.js'
import { draftVersion } from '../vendor/service.js'
import { profile, type ShopRow } from '../vendor/repository.js'
const dummyHash = bcrypt.hashSync(randomBytes(24).toString('hex'), 12)
export async function audit(db: Knex, actorId: string | null, action: string, entityType: string, entityId: string, metadata: object = {}) {
  await db('audit_events').insert({ id: randomUUID(), actor_id: actorId, action, entity_type: entityType, entity_id: entityId, safe_metadata_json: JSON.stringify(metadata) })
}
export async function register(db: Knex, input: z.infer<typeof registrationSchema>) {
  const id = randomUUID()
  const passwordHash = await bcrypt.hash(input.password, 12)
  try {
    await db.transaction(async trx => {
      await trx('users').insert({ id, full_name: input.fullName, normalized_email: input.email, normalized_phone: input.phone, password_hash: passwordHash, role: input.role, status: 'ACTIVE' })
      await audit(trx, id, 'ACCOUNT_REGISTERED', 'user', id)
    })
  } catch (error) {
    if (isDuplicate(error)) throw new HttpError(409, 'ACCOUNT_CONFLICT', 'An account cannot be created with these details.')
    throw error
  }
  return id
}
const hashKey = (secret: string, value: string) => createHmac('sha256', secret).update(value).digest('hex')
export async function claimAttempt(db: Knex, secret: string, email: string, ip: string, registration = false) {
  // Retain only recent buckets; active blocks last at most fifteen minutes.
  await db('auth_rate_limits').where('window_start', '<', new Date(Date.now() - 86400000)).delete()
  const zero = '0'.repeat(64)
  const keys = registration ? [{ account: zero, ip: hashKey(secret, 'registration:' + ip), limit: 10 }] : [
    { account: hashKey(secret, email), ip: zero, limit: 5 },
    { account: zero, ip: hashKey(secret, ip), limit: 30 }
  ]
  keys.sort((a, b) => (a.account + a.ip).localeCompare(b.account + b.ip))
  const now = Date.now(), window = new Date(Math.floor(now / 900000) * 900000)
  const allowed = await db.transaction(async trx => {
    for (const key of keys) {
      await trx('auth_rate_limits').insert({ hashed_account_key: key.account, hashed_ip_key: key.ip, window_start: window, failure_count: 0 }).onConflict().ignore()
      const rows = await trx('auth_rate_limits').where({ hashed_account_key: key.account, hashed_ip_key: key.ip }).orderBy('window_start').forUpdate()
      if (rows.some(row => row.blocked_until && Date.parse(row.blocked_until + 'Z') > now)) return false
      const current = rows.find(row => Date.parse(row.window_start + 'Z') === window.getTime())
      if (Number(current?.failure_count || 0) >= key.limit) return false
    }
    for (const key of keys) {
      const query = trx('auth_rate_limits').where({ hashed_account_key: key.account, hashed_ip_key: key.ip, window_start: window })
      await query.clone().increment('failure_count', 1)
      const row = await query.clone().first()
      if (row.failure_count >= key.limit) await query.clone().update({ blocked_until: new Date(now + 900000) })
    }
    return true
  })
  if (!allowed) throw new HttpError(429, 'LOGIN_THROTTLED', 'Too many attempts. Try again in 15 minutes.')
}
export async function login(db: Knex, secret: string, email: string, password: string, ip: string) {
  await claimAttempt(db, secret, email, ip)
  const user = await findByEmail(db, email)
  const valid = await bcrypt.compare(password, user?.password_hash || dummyHash)
  if (!valid || !user || user.status !== 'ACTIVE') throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
  await db('auth_rate_limits').where({ hashed_account_key: hashKey(secret, email), hashed_ip_key: '0'.repeat(64) }).delete()
  return user
}
export async function editAccount(db: Knex, userId: string, input: z.infer<typeof accountSchema>) {
  try {
    await db.transaction(async trx => {
      const shop = await trx<ShopRow>('shops').where({ owner_id: userId }).forUpdate().first()
      const account = await trx<UserRow>('users').where({ id: userId }).forUpdate().first()
      if (!account || account.status !== 'ACTIVE') throw new HttpError(403, 'FORBIDDEN', 'Account is not active.')
      if (shop && account.full_name !== input.fullName) {
        const application = await trx('vendor_applications').where({ shop_id: shop.id, submission_version: shop.review_version }).first()
        if (application.submitted_at) await draftVersion(trx, shop, profile(shop))
        await trx('shops').where({ id: shop.id }).increment('version', 1)
      }
      await trx('users').where({ id: userId }).update({ full_name: input.fullName, normalized_phone: input.phone })
      await audit(trx, userId, 'ACCOUNT_UPDATED', 'user', userId)
    })
  } catch (error) {
    if (isDuplicate(error)) throw new HttpError(409, 'ACCOUNT_CONFLICT', 'Those account details cannot be used.')
    throw error
  }
}
export async function changePassword(db: Knex, userId: string, input: z.infer<typeof passwordChangeSchema>) {
  const newHash = await bcrypt.hash(input.newPassword, 12)
  await db.transaction(async trx => {
    const user = await trx<UserRow>('users').where({ id: userId }).forUpdate().first()
    if (!user || user.status !== 'ACTIVE' || !await bcrypt.compare(input.currentPassword, user.password_hash)) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.')
    await trx('users').where({ id: userId }).update({ password_hash: newHash, auth_version: user.auth_version + 1 })
    await audit(trx, userId, 'PASSWORD_CHANGED', 'user', userId)
  })
}

