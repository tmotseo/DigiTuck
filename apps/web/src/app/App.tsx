import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '../components/AppShell'
import { FoundationState } from '../components/FoundationState'
import { Heading, Notice } from '../components/Forms'
import { AuthPage, AccountPage, Guard } from '../pages/Auth'
import { VendorPage } from '../pages/Vendor'
import { ReviewsPage, ReviewPage, UsersPage, AuditPage } from '../pages/Admin'
import { api } from '../lib/api'
import type { PublicShop } from '@digituck/contracts'
import { ShopCatalogue, VendorProducts } from '../pages/Catalogue'

function Discover() {
  const query = useQuery({ queryKey: ['shops'], queryFn: () => api<PublicShop[]>('/shops') })
  return <><Heading title="Your neighbourhood. Your next bite.">Discover approved local tuckshops in your community.</Heading><div className="collection-strip"><span aria-hidden="true">↗</span><div><strong>Local shops. Collection made simple.</strong><p>Browse products and check stock before visiting your local shop.</p></div><span className="status-badge">Collection only</span></div><h2>Discover local shops</h2><Notice error={query.error} />{query.isPending && <p role="status">Finding your local shops…</p>}{query.data?.length === 0 && <FoundationState title="Your neighbourhood is taking shape" description="Approved shops will appear here. Run a local tuckshop? Apply to join the community." phase="Local community"><Link className="button" to="/vendor/register">Apply as a vendor →</Link></FoundationState>}<div className="workspace-grid">{query.data?.map(shop => <article className="workspace-card" key={shop.id}><span className="status-badge">{shop.is_paused ? 'Temporarily paused' : 'Approved shop'}</span><h2><Link to={"/shops/" + shop.slug}>{shop.name}</Link></h2><p>{shop.description}</p><p>{shop.area} · {shop.address}</p><p>{shop.productCount} products · {shop.availableUnits} units available</p><Link className="button secondary" to={"/shops/" + shop.slug}>View products</Link></article>)}</div></>
}
function FuturePage() { return <><Heading title="More local goodness is on its way" /><FoundationState title="This feature is coming in a later phase" description="Ordering and reports are coming in a later phase. You can browse products and manage your account now." phase="Coming soon" /></> }
export function App() {
  return <Routes>
    <Route element={<AppShell area="customer" />}><Route index element={<Navigate to="/shops" replace />} /><Route path="/shops" element={<Discover />} /><Route path="/shops/:slug" element={<ShopCatalogue />} /><Route path="/login" element={<AuthPage />} /><Route path="/register" element={<AuthPage register />} /><Route path="/vendor/register" element={<AuthPage register vendor />} /><Route element={<Guard />}><Route path="/account" element={<AccountPage />} /></Route><Route element={<Guard role="CUSTOMER" />}>{['orders','orders/:id','cart','checkout'].map(path => <Route key={path} path={path} element={<FuturePage />} />)}</Route><Route path="/search" element={<FuturePage />} /><Route path="*" element={<><Heading title="Page not found" /><Link to="/shops">Back to Discover</Link></>} /></Route>
    <Route element={<Guard role="VENDOR" />}><Route element={<AppShell area="vendor" />}>{['/vendor','/vendor/onboarding','/vendor/shop'].map(path => <Route key={path} path={path} element={<VendorPage />} />)}<Route path="/vendor/products" element={<VendorProducts key="products" />} /><Route path="/vendor/inventory" element={<VendorProducts key="inventory" inventory />} />{['orders','orders/:id','reports'].map(path => <Route key={path} path={'/vendor/' + path} element={<FuturePage />} />)}</Route></Route>
    <Route element={<Guard role="ADMIN" />}><Route element={<AppShell area="admin" />}><Route path="/admin" element={<Navigate to="/admin/vendors" replace />} /><Route path="/admin/vendors" element={<ReviewsPage />} /><Route path="/admin/vendors/:id" element={<ReviewPage />} /><Route path="/admin/users" element={<UsersPage />} /><Route path="/admin/audit" element={<AuditPage />} />{['products','categories','orders/:id'].map(path => <Route key={path} path={'/admin/' + path} element={<FuturePage />} />)}</Route></Route>
  </Routes>
}
