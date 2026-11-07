import { ZodError } from 'zod'
export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}
export function conflict() { return new HttpError(409, 'STALE_VERSION', 'This application changed. Refresh and review the current version.') }
export function notFound() { return new HttpError(404, 'NOT_FOUND', 'Resource not found.') }
export function isDuplicate(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY' }
export { ZodError }

