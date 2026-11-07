import { useState } from 'react'
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { SafeUser } from '@digituck/contracts'
import { api, useUser, homeFor } from '../lib/api'
import { Field, Feedback, Heading, Notice, useAction } from '../components/Forms'

export function Guard({ role }: { role?: SafeUser['role'] }) {
  const user = useUser()
  if (user.isPending) return <p role="status">Checking your session…</p>
  if (user.error) return <Notice error={user.error} />
  if (!user.data) return <Navigate to="/login" replace />
  if (role && user.data.role !== role) return <><Heading title="This workspace belongs to another role" /><Link to={homeFor(user.data.role)}>Go to your workspace</Link></>
  return <Outlet />
}
export function AuthPage({ register = false, vendor = false }: { register?: boolean; vendor?: boolean }) {
  // Router transitions can reuse AuthPage. A mode key gives each form fresh state.
  return <AuthForm key={register ? vendor ? 'vendor' : 'customer' : 'login'} register={register} vendor={vendor} />
}
function AuthForm({ register, vendor }: { register: boolean; vendor: boolean }) {
  const [role, setRole] = useState(vendor ? 'VENDOR' : 'CUSTOMER'), action = useAction(), navigate = useNavigate(), cache = useQueryClient()
  return <><Heading title={register ? 'Join your neighbourhood' : 'Welcome back'}>{register ? 'Shop locally or apply to open your own tuckshop.' : 'Sign in to your DigiTuck account.'}</Heading>
    <form className="form-card narrow" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void action.run(async () => {
      const input = { email: data.get('email'), password: data.get('password'), ...(register ? { fullName: data.get('fullName'), phone: data.get('phone'), role } : {}) }
      const user = await api<SafeUser>(register ? '/auth/register' : '/auth/login', 'POST', input)
      cache.clear(); cache.setQueryData(['me'], user); navigate(homeFor(user.role), { replace: true })
    }) }}>
      <Feedback action={action} /><fieldset disabled={action.pending}>
      {register && <><Field label="Account type"><select value={role} onChange={event => setRole(event.target.value)}><option value="CUSTOMER">Customer — discover local shops</option><option value="VENDOR">Vendor — apply for a shop</option></select></Field><Field label="Full name"><input name="fullName" autoComplete="name" required minLength={2} maxLength={120} /></Field><Field label="Phone number"><input name="phone" type="tel" autoComplete="tel" placeholder="+27821234567" required /></Field></>}
      <Field label="Email"><input name="email" type="email" autoComplete="email" required maxLength={254} /></Field>
      <Field label="Password"><input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={12} /></Field>
      {register && <p className="help-text">Use at least 12 characters, up to 72 UTF-8 bytes. Vendor applications are reviewed before a shop is listed.</p>}
      <button className="button" type="submit">{action.pending ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button></fieldset>
      <p>{register ? 'Already registered?' : 'New to DigiTuck?'} <Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p>
      <p><Link to={vendor ? '/register' : '/vendor/register'}>{vendor ? 'Register as a customer' : 'Register as a vendor'}</Link></p>
    </form></>
}
export function AccountPage() {
  const { data: user } = useUser(), cache = useQueryClient(), navigate = useNavigate(), action = useAction(), password = useAction()
  if (!user) return null
  return <><Heading title="Your account">Keep your contact details up to date.</Heading><div className="account-grid">
    <form className="form-card" onSubmit={event => { event.preventDefault(); const fields = new FormData(event.currentTarget); void action.run(async () => { const updated = await api<SafeUser>('/account', 'PATCH', { fullName: fields.get('fullName'), phone: fields.get('phone') }); cache.setQueryData(['me'], updated); await cache.invalidateQueries({ queryKey: ['vendor'] }) }, 'Account updated.') }}><h2>Personal details</h2><Feedback action={action} /><fieldset disabled={action.pending}><Field label="Full name"><input name="fullName" defaultValue={user.fullName} required minLength={2} maxLength={120} autoComplete="name" /></Field><Field label="Phone number"><input name="phone" defaultValue={user.phone} required type="tel" autoComplete="tel" /></Field><Field label="Email"><input value={user.email} readOnly /></Field>{user.role === 'VENDOR' && <p className="help-text">Changing your legal name starts a new shop review. Your shop will be hidden until it is approved again.</p>}<button className="button">Save details</button></fieldset></form>
    <form className="form-card" onSubmit={event => { event.preventDefault(); const fields = new FormData(event.currentTarget); void password.run(async () => { await api('/account/password', 'POST', { currentPassword: fields.get('currentPassword'), newPassword: fields.get('newPassword') }); cache.clear(); navigate('/login', { replace: true }) }) }}><h2>Change password</h2><p>Changing your password signs you out on every device.</p><Feedback action={password} /><fieldset disabled={password.pending}><Field label="Current password"><input name="currentPassword" type="password" autoComplete="current-password" required minLength={12} /></Field><Field label="New password"><input name="newPassword" type="password" autoComplete="new-password" required minLength={12} /></Field><button className="button">Change password & sign out</button></fieldset></form>
  </div></>
}
