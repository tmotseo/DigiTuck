import express, { type ErrorRequestHandler } from 'express'
import helmet from 'helmet'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ApiError } from '@digituck/contracts'
import { phaseTwo, type PhaseTwoOptions } from './routes/phaseTwo.js'
import { HttpError, ZodError } from './lib/errors.js'
import { MulterError } from 'multer'

export function createApp(options: { checkDatabase: () => Promise<void>; webDirectory?: string; production?: boolean; trustProxyHops?: number; phaseTwo?: PhaseTwoOptions }) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', options.trustProxyHops || false)
  app.use(helmet({ strictTransportSecurity: options.production ? undefined : false }))
  app.use((_req, res, next) => {
    res.locals.requestId = randomUUID()
    res.setHeader('X-Request-ID', res.locals.requestId as string)
    next()
  })
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() })
  app.use(express.json({ limit: '32kb' }))
  const failure = (res: express.Response, status: number, code: string, message: string) => {
    const body: ApiError = { error: { code, message, fieldErrors: {}, requestId: res.locals.requestId as string } }
    res.status(status).json(body)
  }
  app.get('/api/v1/health/live', (_req, res) => {
    res.json({ data: { status: 'ok', service: 'digituck-api' }, meta: { requestId: res.locals.requestId } })
  })
  app.get('/api/v1/health/ready', async (_req, res) => {
    try {
      await options.checkDatabase()
      res.json({ data: { status: 'ready', service: 'digituck-api' }, meta: { requestId: res.locals.requestId } })
    } catch {
      failure(res, 503, 'DEPENDENCY_UNAVAILABLE', 'The database is not ready.')
    }
  })
  if (options.phaseTwo) app.use('/api/v1', phaseTwo(options.phaseTwo))
  // Register before static/SPA handlers: missing APIs must never return index.html.
  app.use('/api', (_req, res) => { failure(res, 404, 'NOT_FOUND', 'API route not found.') })
  if (options.webDirectory) {
    const index = resolve(options.webDirectory, 'index.html')
    if (!existsSync(index)) throw new Error('Frontend build missing. Run npm run build before npm start.')
    app.use('/assets', express.static(resolve(options.webDirectory, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }))
    app.use(express.static(options.webDirectory, { index: false, maxAge: 0 }))
    app.get('/{*path}', (req, res, next) => {
      if (!req.accepts('html')) return next()
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(index)
    })
  }
  app.use((_req, res) => { failure(res, 404, 'NOT_FOUND', 'Route not found.') })
  const errors: ErrorRequestHandler = (error: { status?: number; type?: string }, _req, res, _next) => {
    if (res.headersSent) return _next(error)
    if (error instanceof HttpError) return failure(res, error.status, error.code, error.message)
    if (error instanceof ZodError) return res.status(422).json({ error: { code: 'VALIDATION', message: 'Check the highlighted details.', fieldErrors: error.flatten().fieldErrors, requestId: res.locals.requestId } })
    if (error instanceof MulterError) return failure(res, 422, 'UPLOAD_LIMIT', 'Upload one document up to 10 MB using the required fields.')
    if (error.type === 'entity.parse.failed') return failure(res, 400, 'INVALID_JSON', 'Request body must be valid JSON.')
    if (error.type === 'entity.too.large') return failure(res, 413, 'BODY_TOO_LARGE', 'Request body is too large.')
    if (error.status === 404) return failure(res, 404, 'NOT_FOUND', 'Resource not found.')
    failure(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.')
  }
  app.use(errors)
  return app
}

