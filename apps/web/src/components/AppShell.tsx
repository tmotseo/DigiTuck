import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, useUser, homeFor } from '../lib/api'
import { Notice, useAction } from './Forms'
export type Area = 'customer' | 'vendor' | 'admin'
const navigation: Record<Area, { to: string; label: string; symbol: string }[]> = {
  customer: [{to:'/shops',label:'Discover',symbol:'⌂'},{to:'/orders',label:'Orders',symbol:'▤'},{to:'/account',label:'Account',symbol:'○'}],
  vendor: [{to:'/vendor',label:'Overview',symbol:'◫'},{to:'/vendor/orders',label:'Orders',symbol:'▤'},{to:'/vendor/products',label:'Products',symbol:'▦'},{to:'/vendor/inventory',label:'Inventory',symbol:'▥'},{to:'/vendor/reports',label:'Reports',symbol:'↗'},{to:'/vendor/shop',label:'Business',symbol:'⌂'}],
  admin: [{to:'/admin/vendors',label:'Vendor reviews',symbol:'▤'},{to:'/admin/users',label:'Users',symbol:'○'},{to:'/admin/products',label:'Products',symbol:'▦'},{to:'/admin/categories',label:'Categories',symbol:'◫'},{to:'/admin/audit',label:'Audit',symbol:'≡'}]
}
export function AppShell({ area }: { area: Area }) {
  const { data: user } = useUser(), cache = useQueryClient(), navigate = useNavigate(), action = useAction()
  const location = useLocation()
  const main = useRef<HTMLElement>(null)
  useEffect(() => { main.current?.focus(); window.scrollTo(0, 0) }, [location.pathname])
  return <div className={'app-shell ' + area}>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="topbar">
      <Link className="brand" to="/shops"><span className="brand-icon" aria-hidden="true">D</span>DigiTuck<span className="brand-dot">.</span></Link>
      <div className="topbar-note">Local shops. Collection made simple.</div>
      {user ? <button className="button secondary" disabled={action.pending} onClick={() => void action.run(async () => { await api('/auth/logout', 'POST'); cache.clear(); navigate('/login', { replace: true }) })}>Sign out</button> : <Link className="button secondary" to="/login">Sign in</Link>}
    </header>
    <div className="shell-body">
      <aside className="side-nav">
        <p className="nav-caption">{area === 'customer' ? 'YOUR NEIGHBOURHOOD' : area === 'vendor' ? 'VENDOR WORKSPACE' : 'ADMIN WORKSPACE'}</p>
        <nav aria-label={area + ' navigation'}>{navigation[area].map(item => <NavLink key={item.to} to={item.to} end={item.to === '/vendor'}><span aria-hidden="true">{item.symbol}</span>{item.label}</NavLink>)}</nav>
        <div className="nav-bottom"><span className="mini-label">YOUR COMMUNITY</span><Link to="/shops">Discover shops ↗</Link>{user ? <><Link to={homeFor(user.role)}>My workspace ↗</Link><Link to="/account">My account ↗</Link><p>Signed in as {user.fullName}</p></> : <><Link to="/vendor/register">Become a vendor ↗</Link><Link to="/register">Create an account ↗</Link></>}</div>
      </aside>
      <main ref={main} tabIndex={-1} id="main"><Notice error={action.error} /><Outlet /><footer className="page-footer"><span>DigiTuck · Built for your community</span><span>Collection only · Pay at collection</span></footer></main>
    </div>
    {area === 'customer' && <nav className="mobile-nav" aria-label="Mobile customer navigation">{navigation.customer.map(item => <NavLink key={item.to} to={item.to}><span aria-hidden="true">{item.symbol}</span>{item.label}</NavLink>)}</nav>}
  </div>
}

