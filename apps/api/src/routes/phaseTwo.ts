import { Router, type Response } from 'express'
import type session from 'express-session'
import type { Knex } from 'knex'
import multer from 'multer'
import { z } from 'zod'
import { accountSchema, registrationSchema, loginSchema, passwordChangeSchema, profileSchema, versionSchema, decisionSchema, userStatusSchema, paginationSchema, type SafeUser } from '@digituck/contracts'
import { security, requireRole, newToken, saveSession, regenerateSession, destroySession, type SecurityConfig } from '../middleware/security.js'
import { register, login, editAccount, changePassword, claimAttempt } from '../modules/auth/service.js'
import { findUser, safeUser } from '../modules/auth/repository.js'
import * as vendor from '../modules/vendor/service.js'
import * as admin from '../modules/admin/service.js'
import { HttpError } from '../lib/errors.js'
import type { PrivateStorage } from '../lib/storage.js'

export interface PhaseTwoOptions { db: Knex; store: session.Store; security: SecurityConfig; storage: PrivateStorage; documentTypes: string[] }
export function phaseTwo(options: PhaseTwoOptions) {
  const { db, storage, documentTypes } = options
  const router = Router(), guards = security(db, options.store, options.security)
  const send = (res: Response, data: unknown, status = 200) => res.status(status).json({ data, meta: { requestId: res.locals.requestId } })
  const user = (res: Response) => res.locals.user as SafeUser
  const id = (value: unknown) => z.uuid().parse(value)
  router.use(guards.middleware, guards.authenticate, guards.csrf)
  router.get('/auth/csrf', async (req, res) => { req.session.csrfToken ||= newToken(); await saveSession(req); send(res, { csrfToken: req.session.csrfToken }) })
  router.get('/auth/me', requireRole(), (_req, res) => { send(res, user(res)) })
  router.post('/auth/register', async (req, res) => {
    const input = registrationSchema.parse(req.body)
    await claimAttempt(db, options.security.secret, input.email, req.ip || 'unknown', true)
    const userId = await register(db, input)
    const account = (await findUser(db, userId))!
    await regenerateSession(req)
    Object.assign(req.session, { userId, authVersion: account.auth_version, startedAt: Date.now(), lastSeen: Date.now(), csrfToken: newToken() })
    await saveSession(req)
    send(res, safeUser(account), 201)
  })
  router.post('/auth/login', async (req, res) => {
    const input = loginSchema.parse(req.body)
    const account = await login(db, options.security.secret, input.email, input.password, req.ip || 'unknown')
    await regenerateSession(req)
    Object.assign(req.session, { userId: account.id, authVersion: account.auth_version, startedAt: Date.now(), lastSeen: Date.now(), csrfToken: newToken() })
    await saveSession(req)
    send(res, safeUser(account))
  })
  router.post('/auth/logout', requireRole(), async (req, res) => {
    await destroySession(req)
    res.clearCookie(guards.cookieName, { path: '/', httpOnly: true, secure: options.security.production, sameSite: 'lax' })
    res.status(204).end()
  })
  router.patch('/account', requireRole(), async (req, res) => { await editAccount(db, user(res).id, accountSchema.parse(req.body)); send(res, safeUser((await findUser(db, user(res).id))!)) })
  router.post('/account/password', requireRole(), async (req, res) => {
    await claimAttempt(db, options.security.secret, 'password:' + user(res).id, req.ip || 'unknown')
    await changePassword(db, user(res).id, passwordChangeSchema.parse(req.body))
    await destroySession(req)
    res.clearCookie(guards.cookieName, { path: '/', httpOnly: true, secure: options.security.production, sameSite: 'lax' })
    res.status(204).end()
  })
  router.get('/shops', async (req, res) => { const p = paginationSchema.parse(req.query); send(res, await admin.publicShops(db, p.page, p.limit)) })
  router.use('/vendor', requireRole('VENDOR'))
  router.get('/vendor/shop', async (_req, res) => { send(res, await vendor.viewShop(db, user(res).id, documentTypes)) })
  router.put('/vendor/shop', async (req, res) => { await vendor.saveProfile(db, user(res).id, profileSchema.parse(req.body)); send(res, await vendor.viewShop(db, user(res).id, documentTypes)) })
  router.post('/vendor/shop/revise', async (req, res) => { await vendor.revise(db, user(res).id, versionSchema.parse(req.body).expectedVersion); send(res, await vendor.viewShop(db, user(res).id, documentTypes)) })
  router.post('/vendor/shop/submit', async (req, res) => { await vendor.submitApplication(db, user(res).id, versionSchema.parse(req.body).expectedVersion, documentTypes); send(res, await vendor.viewShop(db, user(res).id, documentTypes)) })
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10485760, files: 1, fields: 2, parts: 3, fieldSize: 200, fieldNameSize: 50 } })
  router.post('/vendor/documents', upload.single('document'), async (req, res) => {
    if (!req.file) throw new HttpError(422, 'FILE_REQUIRED', 'Select a document.')
    const input = z.strictObject({ type: z.string().max(80), expectedVersion: z.coerce.number().int().positive() }).parse(req.body)
    await vendor.uploadDocument(db, storage, user(res).id, input, req.file, documentTypes)
    send(res, await vendor.viewShop(db, user(res).id, documentTypes), 201)
  })
  router.delete('/vendor/documents/:id', async (req, res) => { await vendor.removeDocument(db, storage, user(res).id, id(req.params.id), versionSchema.parse(req.body).expectedVersion); send(res, await vendor.viewShop(db, user(res).id, documentTypes)) })
  const download = async (res: Response, documentId: unknown) => {
    const file = await vendor.downloadDocument(db, storage, user(res), id(documentId))
    res.attachment(file.name).type(file.mime).set('X-Content-Type-Options', 'nosniff').send(file.bytes)
  }
  router.get('/vendor/documents/:id/download', async (req, res) => { await download(res, req.params.id) })
  router.use('/admin', requireRole('ADMIN'))
  router.get('/admin/vendors', async (req, res) => { const p = paginationSchema.parse(req.query); send(res, await admin.reviews(db, p.page, p.limit)) })
  router.get('/admin/vendors/:id', async (req, res) => { const query = z.strictObject({ submissionVersion: z.coerce.number().int().positive().optional() }).parse(req.query); send(res, await admin.review(db, id(req.params.id), query.submissionVersion)) })
  router.post('/admin/vendors/:id/decision', async (req, res) => { await admin.decide(db, user(res).id, id(req.params.id), decisionSchema.parse(req.body)); send(res, await admin.review(db, id(req.params.id))) })
  router.get('/admin/documents/:id/download', async (req, res) => { await download(res, req.params.id) })
  router.get('/admin/users', async (req, res) => { const p = paginationSchema.parse(req.query); send(res, await admin.listUsers(db, p.page, p.limit)) })
  router.patch('/admin/users/:id/status', async (req, res) => { const input = userStatusSchema.parse(req.body); await admin.setUserStatus(db, user(res).id, id(req.params.id), input.status, input.reason); send(res, { updated: true }) })
  router.get('/admin/audit', async (req, res) => { const p = paginationSchema.parse(req.query); send(res, await admin.listAudit(db, p.page, p.limit)) })
  return router
}

