'use client'

import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, KeyRound, LockKeyhole, RefreshCw, ShieldCheck, Trash2, Users, X } from 'lucide-react'
import { PaginationControls } from '@/components/admin/pagination-controls'

type Tab = 'Admins' | 'Sessions' | 'Two-factor'
type Admin = { id: string; email: string; is_active: boolean; created_at: string; totp_enabled: boolean }
type AdminSession = { id: string; ip: string | null; user_agent: string | null; created_at: string; last_seen_at: string; revoked_at: string | null; current: boolean }

const inputClass = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground'
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50'
const outlineClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50'

export function SecurityPanel() {
  const [tab, setTab] = useState<Tab>('Admins')
  const [password, setPassword] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [admins, setAdmins] = useState<Admin[]>([])
  const [adminPage, setAdminPage] = useState(1)
  const [adminPageSize, setAdminPageSize] = useState(10)
  const [adminTotal, setAdminTotal] = useState(0)
  const [sessions, setSessions] = useState<AdminSession[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [qr, setQr] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function refreshAdmins(nextPage = adminPage, nextPageSize = adminPageSize) {
    const response = await fetch(`/api/admin/security/admins?page=${nextPage}&page_size=${nextPageSize}`, { headers: { 'x-admin-password': password } })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Unable to load administrators')
    setAdmins(result.items ?? [])
    setAdminTotal(result.pagination?.total ?? 0)
    setAdminPage(nextPage)
  }

  async function refreshSessions(nextPage = page) {
    const response = await fetch(`/api/admin/security/sessions?page=${nextPage}&pageSize=10`, { headers: { 'x-admin-password': password } })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Unable to load sessions')
    setSessions(result.sessions ?? [])
    setTotal(result.total ?? 0)
    setPage(nextPage)
  }

  async function unlock() {
    setBusy(true); setError(''); setMessage('')
    try { await refreshAdmins(); await refreshSessions(1); setAuthorized(true); setMessage('Security settings unlocked.') }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'Re-authentication failed'); setAuthorized(false) }
    finally { setBusy(false) }
  }

  async function act(action: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('')
    try { await action() }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'Security action failed') }
    finally { setBusy(false) }
  }

  async function send(url: string, method: string, body?: Record<string, unknown>) {
    const response = await fetch(url, { method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify({ ...body, admin_password: password }) } : {}) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Security action failed')
    return result
  }

  return <section className="mx-auto max-w-5xl">
    <header className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Platform</p><h1 className="mt-1 text-2xl font-bold">Security</h1><p className="mt-1 text-sm text-muted-foreground">Manage administrator access, active sessions, and two-factor authentication.</p></header>
    <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Security settings">{(['Admins', 'Sessions', 'Two-factor'] as Tab[]).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === item ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-muted'}`}>{item}</button>)}</div>
    <div className="rounded-2xl border border-border bg-card p-5">
      {!authorized ? <form onSubmit={(event) => { event.preventDefault(); void unlock() }} className="max-w-md"><div className="mb-4 flex items-start gap-3"><LockKeyhole className="mt-1 size-5 text-primary" /><div><h2 className="font-semibold">Re-authenticate</h2><p className="text-sm text-muted-foreground">Enter your admin password to access security controls.</p></div></div><label htmlFor="admin-reauth" className="mb-1 block text-sm font-medium">Admin password</label><input id="admin-reauth" type="password" required autoComplete="current-password" className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} /><button disabled={busy} className={`${buttonClass} mt-3`}>{busy ? 'Verifying…' : 'Unlock security settings'}</button></form> : <>
        {tab === 'Admins' && <div><div className="mb-4 flex items-center gap-2"><Users className="size-5 text-primary" /><h2 className="text-lg font-semibold">Administrator accounts</h2></div><form className="mb-5 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); void act(async () => { await send('/api/admin/security/admins', 'POST', { email, password: newPassword }); setEmail(''); setNewPassword(''); await refreshAdmins(); setMessage('Administrator created.') }) }}><label className="sr-only" htmlFor="new-admin-email">New admin email</label><input id="new-admin-email" type="email" required placeholder="Admin email" className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} /><label className="sr-only" htmlFor="new-admin-password">New admin password</label><input id="new-admin-password" type="password" required minLength={12} placeholder="Password (12+ characters)" className={inputClass} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><button disabled={busy} className={buttonClass}>Add admin</button></form><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="py-3 pr-3">Email</th><th className="py-3 pr-3">Status</th><th className="py-3 pr-3">2FA</th><th className="py-3 pr-3">Created</th><th className="py-3">Actions</th></tr></thead><tbody>{admins.map((admin) => <tr key={admin.id} className="border-b last:border-0"><td className="py-3 pr-3 font-medium">{admin.email}</td><td className="py-3 pr-3">{admin.is_active ? 'Active' : 'Inactive'}</td><td className="py-3 pr-3">{admin.totp_enabled ? 'Enabled' : 'Off'}</td><td className="py-3 pr-3">{new Date(admin.created_at).toLocaleDateString()}</td><td className="py-3"><div className="flex flex-wrap gap-2"><button className={outlineClass} disabled={busy} onClick={() => { if (!window.confirm(`${admin.is_active ? 'Deactivate' : 'Activate'} ${admin.email}?`)) return; void act(async () => { await send('/api/admin/security/admins', 'PATCH', { id: admin.id, is_active: !admin.is_active }); await refreshAdmins(); setMessage('Administrator updated.') }) }}>{admin.is_active ? 'Deactivate' : 'Activate'}</button><button className={outlineClass} disabled={busy} onClick={() => { if (!window.confirm(`Reset the password for ${admin.email}?`)) return; const next = window.prompt('Enter a new password (minimum 12 characters)'); if (!next) return; if (next.length < 12) { setError('Password must be at least 12 characters.'); return } void act(async () => { await send('/api/admin/security/admins', 'PATCH', { id: admin.id, password: next }); setMessage('Password reset.') }) }}>Reset password</button></div></td></tr>)}</tbody></table>{admins.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No administrator accounts found.</p>}</div><PaginationControls page={adminPage} pageSize={adminPageSize} total={adminTotal} onPageChange={(nextPage) => void act(() => refreshAdmins(nextPage))} onPageSizeChange={(nextPageSize) => { setAdminPageSize(nextPageSize); void act(() => refreshAdmins(1, nextPageSize)) }} /></div>}
        {tab === 'Sessions' && <div><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /><div><h2 className="text-lg font-semibold">Admin sessions</h2><p className="text-sm text-muted-foreground">Sessions expire after two hours of inactivity.</p></div></div><button className={outlineClass} disabled={busy} onClick={() => { if (!window.confirm('Revoke all other admin sessions?')) return; void act(async () => { await send('/api/admin/security/sessions/revoke-others', 'POST', {}); await refreshSessions(1); setMessage('Other sessions revoked.') }) }}><Trash2 className="size-4" />Revoke others</button></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="py-3 pr-3">IP address</th><th className="py-3 pr-3">Device</th><th className="py-3 pr-3">Last active</th><th className="py-3 pr-3">Status</th><th className="py-3">Action</th></tr></thead><tbody>{sessions.map((session) => <tr key={session.id} className="border-b last:border-0"><td className="py-3 pr-3">{session.ip || 'Unknown'}</td><td className="max-w-[220px] truncate py-3 pr-3" title={session.user_agent || ''}>{session.user_agent || 'Unknown device'}</td><td className="py-3 pr-3">{session.last_seen_at ? new Date(session.last_seen_at).toLocaleString() : '—'}</td><td className="py-3 pr-3">{session.current ? 'Current' : session.revoked_at ? 'Revoked' : 'Active'}</td><td className="py-3">{!session.current && !session.revoked_at && <button className={outlineClass} disabled={busy} onClick={() => { if (!window.confirm('Revoke this session?')) return; void act(async () => { await send(`/api/admin/security/sessions/${session.id}/revoke`, 'POST', {}); await refreshSessions(); setMessage('Session revoked.') }) }}>Revoke</button>}</td></tr>)}</tbody></table></div><div className="mt-4 flex items-center justify-between"><span className="text-sm text-muted-foreground">Page {page} of {Math.max(1, Math.ceil(total / 10))}</span><div className="flex gap-2"><button className={outlineClass} disabled={busy || page <= 1} onClick={() => void act(() => refreshSessions(page - 1))}><ChevronLeft className="size-4" />Previous</button><button className={outlineClass} disabled={busy || page * 10 >= total} onClick={() => void act(() => refreshSessions(page + 1))}>Next<ChevronRight className="size-4" /></button></div></div></div>}
        {tab === 'Two-factor' && <div className="max-w-xl"><div className="mb-4 flex items-center gap-2"><KeyRound className="size-5 text-primary" /><h2 className="text-lg font-semibold">Two-factor authentication</h2></div><p className="mb-4 text-sm text-muted-foreground">Use an authenticator app to add a time-based six-digit code to admin sign-in.</p>{qr ? <div className="flex flex-col items-start gap-4"><img src={qr} alt="Authenticator setup QR code" className="size-52 rounded-lg border bg-white p-2" /><form className="flex w-full flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void act(async () => { await send('/api/admin/security/totp/confirm', 'POST', { code: totpCode }); setQr(''); setTotpCode(''); await refreshAdmins(); setMessage('Two-factor authentication enabled.') }) }}><label className="sr-only" htmlFor="totp-confirm-code">Six-digit authenticator code</label><input id="totp-confirm-code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" required className={inputClass} placeholder="6-digit code" value={totpCode} onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /><button disabled={busy} className={buttonClass}><Check className="size-4" />Confirm and enable</button><button type="button" className={outlineClass} onClick={() => setQr('')}><X className="size-4" />Cancel</button></form></div> : <button className={buttonClass} disabled={busy} onClick={() => void act(async () => { const result = await send('/api/admin/security/totp/setup', 'POST', { admin_password: password }); setQr(result.qrCodeDataUrl); setMessage('Scan the QR code and confirm a code to enable two-factor authentication.') })}><RefreshCw className="size-4" />Set up authenticator app</button>}</div>}
      </>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}{message && <p role="status" className="mt-4 rounded-lg bg-muted p-3 text-sm">{message}</p>}
    </div>
  </section>
}
