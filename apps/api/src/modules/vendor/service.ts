import type { Knex } from 'knex'
import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { fileTypeFromBuffer } from 'file-type'
import type { ShopProfile } from '@digituck/contracts'
import { audit } from '../auth/service.js'
import { conflict, HttpError, notFound } from '../../lib/errors.js'
import { ownShop, profile, profileColumns, documentColumns, type ShopRow } from './repository.js'
import type { PrivateStorage } from '../../lib/storage.js'

export async function viewShop(db: Knex, owner: string, requiredTypes: string[]) {
  const shop = await ownShop(db, owner)
  if (!shop) return { shop: null, application: null, documents: [], requiredTypes }
  const application = await db('vendor_applications').where({ shop_id: shop.id, submission_version: shop.review_version }).first()
  const documents = await db('vendor_documents').select(documentColumns).where({ shop_id: shop.id, submission_version: shop.review_version })
  return { shop: { id: shop.id, slug: shop.slug, ...profile(shop), version: shop.version, submissionVersion: shop.review_version, status: shop.approval_status, suspensionReason: shop.suspension_reason, rejectionReason: shop.rejection_reason }, application, documents, requiredTypes }
}
export async function draftVersion(trx: Knex, shop: ShopRow, snapshot: object) {
  const version = shop.review_version + 1
  await trx('vendor_applications').insert({ id: randomUUID(), shop_id: shop.id, submission_version: version, profile_snapshot_json: JSON.stringify(snapshot), status: 'DRAFT' })
  await trx('shops').where({ id: shop.id }).update({ review_version: version, approval_status: shop.suspended_at ? 'SUSPENDED' : 'DRAFT', rejection_reason: null, reviewed_by: null, reviewed_at: null, submitted_at: null })
}
export async function saveProfile(db: Knex, owner: string, input: ShopProfile) {
  await db.transaction(async trx => {
    const shop = await trx<ShopRow>('shops').where({ owner_id: owner }).forUpdate().first()
    if (!shop) {
      if (input.expectedVersion !== 0) throw conflict()
      const id = randomUUID()
      await trx('shops').insert({ id, owner_id: owner, slug: 'shop-' + id, ...profileColumns(input), approval_status: 'DRAFT' })
      await trx('vendor_applications').insert({ id: randomUUID(), shop_id: id, submission_version: 1, profile_snapshot_json: JSON.stringify(input), status: 'DRAFT' })
      await audit(trx, owner, 'SHOP_CREATED', 'shop', id)
      return
    }
    if (shop.version !== input.expectedVersion) throw conflict()
    const application = await trx('vendor_applications').where({ shop_id: shop.id, submission_version: shop.review_version }).forUpdate().first()
    const material = shop.name !== input.name || shop.address !== input.address || shop.area !== input.area
    if (material && application.submitted_at) await draftVersion(trx, shop, input)
    else if (!application.submitted_at) await trx('vendor_applications').where({ id: application.id }).update({ profile_snapshot_json: JSON.stringify(input) })
    await trx('shops').where({ id: shop.id }).update({ ...profileColumns(input), version: shop.version + 1 })
    await audit(trx, owner, material ? 'SHOP_MATERIAL_CHANGED' : 'SHOP_UPDATED', 'shop', shop.id, { previousVersion: shop.version })
  })
}
export async function revise(db: Knex, owner: string, expectedVersion: number) {
  await db.transaction(async trx => {
    const shop = await trx<ShopRow>('shops').where({ owner_id: owner }).forUpdate().first()
    if (!shop) throw notFound()
    if (shop.version !== expectedVersion) throw conflict()
    const app = await trx('vendor_applications').where({ shop_id: shop.id, submission_version: shop.review_version }).first()
    if (!app.submitted_at) throw new HttpError(409, 'ALREADY_DRAFT', 'This application is already a draft.')
    await draftVersion(trx, shop, profile(shop))
    await trx('shops').where({ id: shop.id }).increment('version', 1)
    await audit(trx, owner, 'APPLICATION_REVISED', 'shop', shop.id, { previousSubmission: shop.review_version })
  })
}
export async function submitApplication(db: Knex, owner: string, expectedVersion: number, requiredTypes: string[]) {
  await db.transaction(async trx => {
    const shop = await trx<ShopRow>('shops').where({ owner_id: owner }).forUpdate().first()
    if (!shop) throw notFound()
    if (shop.version !== expectedVersion) throw conflict()
    const application = await trx('vendor_applications').where({ shop_id: shop.id, submission_version: shop.review_version }).forUpdate().first()
    if (application.status !== 'DRAFT') throw new HttpError(409, 'ALREADY_SUBMITTED', 'This version has already been submitted.')
    const docs = await trx('vendor_documents').where({ shop_id: shop.id, submission_version: shop.review_version })
    if (requiredTypes.some(type => !docs.some(doc => doc.type === type))) throw new HttpError(422, 'DOCUMENTS_REQUIRED', 'Upload each document on the checklist before submitting.')
    const ownerUser = await trx('users').where({ id: owner }).first()
    if (!ownerUser || ownerUser.status !== 'ACTIVE') throw new HttpError(403, 'FORBIDDEN', 'Account is not active.')
    await trx('vendor_applications').where({ id: application.id }).update({ profile_snapshot_json: JSON.stringify({ ...profile(shop), ownerName: ownerUser.full_name }), status: 'PENDING', submitted_at: trx.fn.now(3) })
    await trx('shops').where({ id: shop.id }).update({ approval_status: shop.suspended_at ? 'SUSPENDED' : 'PENDING', submitted_at: trx.fn.now(3), version: shop.version + 1 })
    await audit(trx, owner, 'APPLICATION_SUBMITTED', 'shop', shop.id, { submissionVersion: shop.review_version })
  })
}
export async function uploadDocument(db: Knex, storage: PrivateStorage, owner: string, input: { type: string; expectedVersion: number }, file: Express.Multer.File, types: string[]) {
  if (!types.includes(input.type)) throw new HttpError(422, 'DOCUMENT_TYPE', 'Select a document type from the checklist.')
  const detected = await fileTypeFromBuffer(file.buffer).catch(() => undefined)
  if (!detected || !['application/pdf','image/jpeg','image/png'].includes(detected.mime) || detected.mime !== file.mimetype || file.size > 10485760) throw new HttpError(422, 'INVALID_FILE', 'Upload a valid PDF, JPEG or PNG up to 10 MB.')
  const key = randomUUID()
  await storage.put(key, file.buffer, detected.mime)
  try {
    await db.transaction(async trx => {
      const shop = await trx<ShopRow>('shops').where({ owner_id: owner }).forUpdate().first()
      if (!shop) throw notFound()
      if (shop.version !== input.expectedVersion) throw conflict()
      const app = await trx('vendor_applications').where({ shop_id: shop.id, submission_version: shop.review_version }).forUpdate().first()
      if (app.status !== 'DRAFT') throw new HttpError(409, 'SUBMISSION_FROZEN', 'Create a new revision before changing submitted documents.')
      const count = await trx('vendor_documents').where({ shop_id: shop.id, submission_version: shop.review_version }).count('* as count').first()
      if (Number(count?.count) >= 10) throw new HttpError(422, 'DOCUMENT_LIMIT', 'A version can contain at most 10 documents.')
      await trx('vendor_documents').insert({ id: randomUUID(), shop_id: shop.id, submission_version: shop.review_version, type: input.type, object_key: key, original_name: basename(file.originalname).replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120) || 'document', detected_mime: detected.mime, bytes: file.size })
      await trx('shops').where({ id: shop.id }).increment('version', 1)
      await audit(trx, owner, 'DOCUMENT_UPLOADED', 'shop', shop.id, { submissionVersion: shop.review_version, type: input.type })
    })
  } catch (error) { await storage.remove(key); throw error }
}
export async function removeDocument(db: Knex, storage: PrivateStorage, owner: string, id: string, expectedVersion: number) {
  const key = await db.transaction(async trx => {
    const shop = await trx<ShopRow>('shops').where({ owner_id: owner }).forUpdate().first()
    const doc = shop && await trx('vendor_documents').where({ id, shop_id: shop.id, submission_version: shop.review_version }).first()
    if (!shop || !doc) throw notFound()
    if (shop.version !== expectedVersion) throw conflict()
    const app = await trx('vendor_applications').where({ shop_id: shop.id, submission_version: shop.review_version }).first()
    if (app.status !== 'DRAFT') throw new HttpError(409, 'SUBMISSION_FROZEN', 'Submitted documents cannot be deleted.')
    await trx('vendor_documents').where({ id }).delete()
    await trx('shops').where({ id: shop.id }).increment('version', 1)
    await audit(trx, owner, 'DOCUMENT_REMOVED', 'shop', shop.id)
    return doc.object_key as string
  })
  await storage.remove(key)
}
export async function downloadDocument(db: Knex, storage: PrivateStorage, user: { id: string; role: string }, id: string) {
  const doc = await db('vendor_documents as d').join('shops as s', 's.id', 'd.shop_id').select('d.*', 's.owner_id').where('d.id', id).first()
  if (!doc || (user.role !== 'ADMIN' && (user.role !== 'VENDOR' || doc.owner_id !== user.id))) throw notFound()
  if (user.role === 'ADMIN') await audit(db, user.id, 'DOCUMENT_REVIEWED', 'document', id)
  return { bytes: await storage.get(doc.object_key), mime: doc.detected_mime as string, name: doc.original_name as string }
}

