import type { Knex } from 'knex'
import type { z } from 'zod'
import { decisionSchema } from '@digituck/contracts'
import { conflict, HttpError, notFound } from '../../lib/errors.js'
import { audit } from '../auth/service.js'
import { documentColumns, type ShopRow } from '../vendor/repository.js'
export async function reviews(db: Knex, page: number, limit: number) {
  return db('shops as s').join('users as u','u.id','s.owner_id').select('s.id','s.name','s.approval_status','s.review_version','s.version','s.submitted_at','u.full_name as ownerName').orderBy('s.updated_at','desc').limit(limit).offset((page - 1) * limit)
}
export async function review(db: Knex, id: string, submissionVersion?: number) {
  const shop = await db<ShopRow>('shops').where({ id }).first()
  if (!shop) throw notFound()
  const app = await db('vendor_applications').where({ shop_id: id, submission_version: submissionVersion || shop.review_version }).first()
  if (!app) throw notFound()
  return { shop: { id, name: shop.name, version: shop.version, submissionVersion: shop.review_version, status: shop.approval_status, suspensionReason: shop.suspension_reason }, application: app,
    documents: await db('vendor_documents').select(documentColumns).where({ shop_id: id, submission_version: app.submission_version }),
    versions: await db('vendor_applications').select('submission_version','status','submitted_at','decision_reason').where({ shop_id: id }).orderBy('submission_version','desc') }
}
export async function decide(db: Knex, adminId: string, id: string, input: z.infer<typeof decisionSchema>) {
  await db.transaction(async trx => {
    const shop = await trx<ShopRow>('shops').where({ id }).forUpdate().first()
    if (!shop) throw notFound()
    if (shop.version !== input.expectedVersion || shop.review_version !== input.submissionVersion) throw conflict()
    const app = await trx('vendor_applications').where({ shop_id: id, submission_version: input.submissionVersion }).forUpdate().first()
    if (input.action === 'SUSPEND') {
      if (shop.approval_status !== 'APPROVED') throw new HttpError(409, 'INVALID_STATE', 'Only an approved shop can be suspended.')
      await trx('shops').where({ id }).update({ approval_status: 'SUSPENDED', suspended_at: trx.fn.now(3), suspension_reason: input.reason, version: shop.version + 1 })
    } else {
      const restoring = input.action === 'APPROVE' && shop.suspended_at && app.status === 'APPROVED'
      if (app.status !== 'PENDING' && !restoring) throw new HttpError(409, 'INVALID_STATE', 'Only the current submitted application can be reviewed.')
      const owner = await trx('users').where({ id: shop.owner_id }).first()
      if (!owner || owner.status !== 'ACTIVE') throw new HttpError(409, 'OWNER_INACTIVE', 'The shop owner must be active before review.')
      const status = input.action === 'APPROVE' ? 'APPROVED' : 'REJECTED'
      if (!restoring) await trx('vendor_applications').where({ id: app.id }).update({ status, reviewed_by: adminId, reviewed_at: trx.fn.now(3), decision_reason: input.reason })
      await trx('shops').where({ id }).update({ approval_status: input.action === 'REJECT' && shop.suspended_at ? 'SUSPENDED' : status,
        reviewed_by: adminId, reviewed_at: trx.fn.now(3), rejection_reason: status === 'REJECTED' ? input.reason : null,
        ...(status === 'APPROVED' ? { suspended_at: null, suspension_reason: null } : {}), version: shop.version + 1 })
    }
    await audit(trx, adminId, 'VENDOR_' + input.action, 'shop', id, { submissionVersion: input.submissionVersion, reason: input.reason })
  })
}
export async function setUserStatus(db: Knex, adminId: string, id: string, status: string, reason: string) {
  await db.transaction(async trx => {
    await trx('security_locks').where({ name: 'admin-status' }).forUpdate().first()
    await trx('shops').where({ owner_id: id }).forUpdate().first()
    const user = await trx('users').where({ id }).forUpdate().first()
    if (!user) throw notFound()
    if (status === 'INACTIVE' && user.role === 'ADMIN' && user.status === 'ACTIVE') {
      const count = await trx('users').where({ role: 'ADMIN', status: 'ACTIVE' }).count('* as count').first()
      if (Number(count?.count) <= 1) throw new HttpError(409, 'LAST_ADMIN', 'The last active administrator cannot be deactivated.')
    }
    await trx('users').where({ id }).update({ status, auth_version: user.auth_version + 1 })
    await audit(trx, adminId, 'USER_STATUS_CHANGED', 'user', id, { status, reason })
  })
}
export async function listUsers(db: Knex, page: number, limit: number) { return db('users').select('id','full_name','normalized_email','role','status').orderBy('created_at','desc').limit(limit).offset((page - 1) * limit) }
export async function listAudit(db: Knex, page: number, limit: number) { return db('audit_events').select('id','actor_id','action','entity_type','entity_id','safe_metadata_json','created_at').orderBy('created_at','desc').limit(limit).offset((page - 1) * limit) }
export async function publicShops(db: Knex, page: number, limit: number) { return db('shops as s').join('users as u','u.id','s.owner_id').where({ 's.approval_status':'APPROVED', 'u.status':'ACTIVE' }).whereNull('s.suspended_at').select('s.id','s.slug','s.name','s.description','s.area','s.address','s.is_paused').orderBy('s.name').limit(limit).offset((page - 1) * limit) }

