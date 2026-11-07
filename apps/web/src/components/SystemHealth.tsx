import { useQuery } from '@tanstack/react-query'
import { healthSchema } from '@digituck/contracts'
async function health(path: string) {
  const response = await fetch('/api/v1/health/' + path, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Service unavailable')
  return healthSchema.parse(await response.json()).data
}
export function SystemHealth() {
  const live = useQuery({ queryKey: ['health', 'live'], queryFn: () => health('live') })
  const ready = useQuery({ queryKey: ['health', 'ready'], queryFn: () => health('ready') })
  return <section className="system-health" aria-label="Development service status">
    <div><span className="eyebrow">CONNECTED FOUNDATION</span><h2>Service status</h2></div>
    <div className="health-items" aria-live="polite"><span><i className={live.isSuccess ? 'ok' : 'waiting'} />API <strong>{live.isPending ? 'Checking…' : live.isSuccess ? 'Online' : 'Unavailable'}</strong></span><span><i className={ready.isSuccess ? 'ok' : 'waiting'} />MySQL <strong>{ready.isPending ? 'Checking…' : ready.isSuccess ? 'Ready' : 'Not ready'}</strong></span></div>
    {(live.isError || ready.isError) && <div className="health-error"><p>The foundation is running, but a required service is unavailable. No shop or order data is shown.</p><button onClick={() => { void live.refetch(); void ready.refetch() }}>Check again</button></div>}
  </section>
}

