import type { ApiError, SafeUser } from '@digituck/contracts'
import { useQuery } from '@tanstack/react-query'

export class RequestError extends Error {
  constructor(public status: number, public detail: ApiError['error']) { super(detail.message) }
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (method !== 'GET') {
    const token = await api<{ csrfToken: string }>('/auth/csrf')
    headers['X-CSRF-Token'] = token.csrfToken
    if (!(body instanceof FormData)) headers['Content-Type'] = 'application/json'
  }
  const response = await fetch('/api/v1' + path, { method, credentials: 'same-origin', headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) })
  if (response.status === 204) return undefined as T
  const result = await response.json()
  if (!response.ok) throw new RequestError(response.status, result.error || { message: 'Request failed. Please try again.', code: 'REQUEST_FAILED', fieldErrors: {}, requestId: '' })
  return result.data as T
}
export function useUser() {
  return useQuery({ queryKey: ['me'], retry: false, queryFn: async () => {
    try { return await api<SafeUser>('/auth/me') } catch (error) { if (error instanceof RequestError && error.status === 401) return null; throw error }
  } })
}
export const homeFor = (role: SafeUser['role']) => role === 'ADMIN' ? '/admin/vendors' : role === 'VENDOR' ? '/vendor' : '/shops'
