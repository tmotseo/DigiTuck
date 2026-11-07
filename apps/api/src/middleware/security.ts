import session from 'express-session'
import MySQLSession from 'express-mysql-session'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { Request, RequestHandler } from 'express'
import type { Knex } from 'knex'
import type { SafeUser } from '@digituck/contracts'
import { HttpError } from '../lib/errors.js'
import { findUser, safeUser } from '../modules/auth/repository.js'

declare module 'express-session' {
  interface SessionData { userId?: string; authVersion?: number; startedAt?: number; lastSeen?: number; csrfToken?: string; persisted?: boolean }
}
export interface SecurityConfig { secret: string; origins: string[]; production: boolean; idleMs?: number; absoluteMs?: number }
export function makeSessionStore(databaseUrl: string) {
  const url = new URL(databaseUrl)
  const Store = MySQLSession(session)
  const store = new Store({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1), createDatabaseTable: false, clearExpired: true, checkExpirationInterval: 60000, ...(url.searchParams.get('ssl') === 'true' ? { ssl: { rejectUnauthorized: true } } : {}) })
  const get = store.get.bind(store)
  store.get = (id: string, callback?: (error: unknown, data?: session.SessionData | null) => void) => {
    const result = get(id).then((data: session.SessionData | null) => {
      // Also marks sessions written before this fix. The marker stays server-side.
      if (data) data.persisted = true
      return data
    })
    if (callback) void result.then(data => callback(null, data), error => callback(error))
    return result
  }
  store.set = (id: string, data: session.SessionData, callback?: (error?: unknown) => void) => {
    const existing = data.persisted === true
    data.persisted = true
    const expires = Math.round(new Date(data.cookie.expires || Date.now() + (store.options.expiration || 86400000)).getTime() / 1000)
    // Never upsert a loaded session: DELETE (logout) and UPDATE serialize in InnoDB.
    // An UPDATE arriving after DELETE affects zero rows, rather than resurrecting it.
    const result = store.query(existing
      ? 'UPDATE sessions SET expires = ?, data = ? WHERE session_id = ?'
      : 'INSERT INTO sessions (expires, data, session_id) VALUES (?, ?, ?)',
    [expires, JSON.stringify(data), id]).then(() => undefined)
    if (callback) void result.then(() => callback(), error => callback(error))
    return result
  }
  return store
}
export const saveSession = (req: Request) => new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()))
export const destroySession = (req: Request) => new Promise<void>((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()))
export const regenerateSession = (req: Request) => new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()))
export const newToken = () => randomBytes(32).toString('hex')
export function security(db: Knex, store: session.Store, config: SecurityConfig) {
  if (config.secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters')
  const cookieName = config.production ? '__Host-digituck.sid' : 'digituck.sid'
  const middleware = session({ name: cookieName, secret: config.secret, store, resave: false, saveUninitialized: false, rolling: true,
    cookie: { httpOnly: true, secure: config.production, sameSite: 'lax', path: '/', maxAge: config.idleMs || 1800000 } })
  const authenticate: RequestHandler = async (req, res, next) => {
    if (!req.session.userId) return next()
    const now = Date.now()
    const user = await findUser(db, req.session.userId)
    if (!user || user.status !== 'ACTIVE' || user.auth_version !== req.session.authVersion ||
      now - (req.session.startedAt || 0) > (config.absoluteMs || 28800000) ||
      now - (req.session.lastSeen || 0) > (config.idleMs || 1800000)) {
      await destroySession(req)
      res.clearCookie(cookieName, { path: '/', httpOnly: true, secure: config.production, sameSite: 'lax' })
      throw new HttpError(401, 'SESSION_EXPIRED', 'Please sign in again.')
    }
    res.locals.user = safeUser(user)
    req.session.lastSeen = now
    next()
  }
  const csrf: RequestHandler = (req, _res, next) => {
    if (['GET','HEAD','OPTIONS'].includes(req.method)) return next()
    const expected = req.session.csrfToken, supplied = req.get('X-CSRF-Token')
    if (!config.origins.includes(req.get('Origin') || '') || !expected || !supplied || !/^[a-f0-9]{64}$/.test(supplied) ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) throw new HttpError(403, 'CSRF_INVALID', 'Refresh this page and try again.')
    next()
  }
  return { middleware, authenticate, csrf, cookieName }
}
export function requireRole(...roles: SafeUser['role'][]): RequestHandler {
  return (_req, res, next) => {
    const user = res.locals.user as SafeUser | undefined
    if (!user) throw new HttpError(401, 'AUTH_REQUIRED', 'Please sign in.')
    if (roles.length && !roles.includes(user.role)) throw new HttpError(403, 'FORBIDDEN', 'This action is not available to your account.')
    next()
  }
}

