import { useState, type ReactNode } from 'react'
import { RequestError } from '../lib/api'

export function Notice({ error }: { error: unknown }) {
  if (!error) return null
  return <div className="form-error" role="alert"><p>{error instanceof Error ? error.message : 'Something went wrong. Please try again.'}</p>{error instanceof RequestError && Object.entries(error.detail.fieldErrors || {}).map(([field, messages]) => <p key={field}>{field}: {messages.join(' ')}</p>)}</div>
}
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label> }
export function Heading({ title, children }: { title: string; children?: ReactNode }) { return <div className="page-heading"><p className="eyebrow">YOUR NEIGHBOURHOOD, CONNECTED</p><h1>{title}</h1>{children && <p>{children}</p>}</div> }
export function useAction() {
  const [pending, setPending] = useState(false), [error, setError] = useState<unknown>(null), [message, setMessage] = useState('')
  async function run(action: () => Promise<unknown>, success = '') { setPending(true); setError(null); setMessage(''); try { await action(); setMessage(success) } catch (e) { setError(e) } finally { setPending(false) } }
  return { pending, error, message, run }
}
export function Feedback({ action }: { action: ReturnType<typeof useAction> }) { return <><Notice error={action.error} />{action.message && <p className="success-note" role="status">{action.message}</p>}</> }
