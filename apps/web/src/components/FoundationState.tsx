import { Link } from 'react-router-dom'
export function FoundationState({ title, description, phase = 'Next phase', children }: { title: string; description: string; phase?: string; children?: React.ReactNode }) {
  return <section className="empty-state"><span className="empty-icon" aria-hidden="true">◫</span><span className="status-badge">{phase}</span><h2>{title}</h2><p>{description}</p>{children || <Link className="text-link" to="/shops">Back to Discover →</Link>}</section>
}

