import { config as dotenv } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

// Same root file from src (tsx) and dist (production); never exposed through Vite.
dotenv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true })
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    APP_ORIGIN: z.url().default('http://127.0.0.1:5173'),
    DATABASE_URL: z.string().refine(value => { try { return new URL(value).protocol === 'mysql:' } catch { return false } }, 'Expected a mysql URL'),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(1).default(0),
    SESSION_SECRET: z.string().min(32),
    SESSION_IDLE_MINUTES: z.coerce.number().positive().max(120).default(30),
    SESSION_ABSOLUTE_HOURS: z.coerce.number().positive().max(24).default(8),
    DOCUMENT_TYPES: z.string().regex(/^[a-z0-9-]+(,[a-z0-9-]+)*$/).default('business-proof'),
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_DIRECTORY: z.string().default('.local-storage/private-documents'),
    S3_BUCKET: z.string().optional(), S3_REGION: z.string().optional(), S3_ENDPOINT: z.url().optional()
  }).safeParse(env)
  if (!result.success) throw new Error('Invalid server configuration: ' + result.error.issues.map(issue => issue.path.join('.')).join(', '))
  if (new URL(result.data.APP_ORIGIN).origin !== result.data.APP_ORIGIN) throw new Error('APP_ORIGIN must be an exact origin without a path or trailing slash')
  if (result.data.NODE_ENV === 'production' && !result.data.APP_ORIGIN.startsWith('https://')) throw new Error('Production APP_ORIGIN must use HTTPS')
  if (result.data.NODE_ENV === 'production' && result.data.STORAGE_DRIVER !== 's3') throw new Error('Production requires private S3 storage')
  if (result.data.STORAGE_DRIVER === 's3' && (!result.data.S3_BUCKET || !result.data.S3_REGION)) throw new Error('S3_BUCKET and S3_REGION are required')
  return result.data
}

