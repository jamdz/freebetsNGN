'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { Mail, MessageSquare, RefreshCw, Save, Send, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Audit = (action: string, target: string) => void
type Channel = 'email' | 'sms'
type SettingsResponse = { email: ProviderSettings; sms: ProviderSettings }
type ProviderSettings = { publicConfig: Record<string, unknown>; isActive: boolean; secretHints: Record<string, string> }
type Template = { event_key: string; channel: 'email'; enabled: boolean; subject: string; body: string; updated_at?: string }
type Log = { id: string; channel: Channel; event_key: string | null; recipient_masked: string; status: 'sent' | 'failed'; error: string | null; created_at: string }

const eventOptions = [
  ['withdrawal_airtime_sent', 'Airtime withdrawal sent'], ['withdrawal_airtime_rejected', 'Airtime withdrawal rejected'],
  ['withdrawal_bank_paid', 'Bank withdrawal paid'], ['withdrawal_bank_rejected', 'Bank withdrawal rejected'],
  ['account_suspended', 'Account suspended'], ['account_banned', 'Account banned'], ['account_reactivated', 'Account reactivated'],
  ['spin_win', 'Spin win'], ['prize_won', 'Prize won'], ['referral_credit', 'Referral credit'],
] as const
const fetcher = async (url: string) => { const response = await fetch(url, { cache: 'no-store' }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? 'Request failed'); return body }
const defaults = {
  email: { host: '', port: 587, username: '', fromName: 'FreeBetNGN', fromAddress: '', replyTo: '', dailySendCap: 1000, perMinuteLimit: 30, secure: false },
  sms: { baseUrl: '', senderId: '', channel: 'generic', codeLength: 6, expiryMinutes: 10, resendCooldownSeconds: 30, maxAttempts: 5, maxSendsPerNumberPerDay: 5, lowBalanceThreshold: 0 },
}
function renderPreview(text: string) {
  const sample: Record<string, string> = { nickname: 'Amina', amount: '₦1,000', reference: 'FB-2048', reason: 'Request approved', rank: '2', date: '12 Nov 2026', link: 'https://freebetngn.com' }
  return text.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (match, key: string) => sample[key] ?? match)
}
function Field({ label, value, onChange, type = 'text', placeholder, min, max, disabled = false }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; placeholder?: string; min?: number; max?: number; disabled?: boolean }) {
  return <label className="flex flex-col gap-1.5 text-sm font-medium"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} min={min} max={max} disabled={disabled} className="h-10 rounded-lg border border-border bg-background px-3 disabled:opacity-60" /></label>
}

function ProviderCards({ audit }: { audit: Audit }) {
  const { data, error, mutate } = useSWR<SettingsResponse>('/api/admin/messaging/settings', fetcher)
  const [channel, setChannel] = useState<Channel>('email')
  const [email, setEmail] = useState<Record<string, any>>(defaults.email)
  const [sms, setSms] = useState<Record<string, any>>(defaults.sms)
  const [active, setActive] = useState<Record<Channel, boolean>>({ email: false, sms: false })
  const [password, setPassword] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [testTarget, setTestTarget] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [balance, setBalance] = useState('')

  useEffect(() => {
    if (!data) return
    setEmail({ ...defaults.email, ...data.email.publicConfig })
    setSms({ ...defaults.sms, ...data.sms.publicConfig })
    setActive({ email: data.email.isActive, sms: data.sms.isActive })
  }, [data])

  const save = async () => {
    setBusy(true); setStatus('')
    const body = { channel, publicConfig: channel === 'email' ? email : sms, secrets: channel === 'email' ? { password } : { apiKey }, isActive: active[channel] }
    const response = await fetch('/api/admin/messaging/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const result = await response.json().catch(() => ({})); setBusy(false)
    setStatus(response.ok ? 'Settings saved securely.' : result.error ?? 'Unable to save settings.')
    if (response.ok) { setPassword(''); setApiKey(''); audit('save_messaging_settings', channel); await mutate() }
  }
  const test = async () => {
    setBusy(true); setStatus('')
    const response = await fetch('/api/admin/messaging/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel, target: testTarget || undefined }) })
    const result = await response.json().catch(() => ({})); setBusy(false)
    setStatus(response.ok ? 'Test message sent.' : result.error ?? 'Test failed.')
    audit('send_messaging_test', channel)
  }
  const checkBalance = async () => {
    setBusy(true); setBalance('')
    const response = await fetch('/api/admin/messaging/balance', { cache: 'no-store' }); const result = await response.json().catch(() => ({})); setBusy(false)
    setBalance(response.ok ? `${result.balance ?? 'Unknown'} ${result.currency ?? ''}${result.isLow ? ' · Below threshold' : ''}` : result.error ?? 'Balance check failed')
  }
  const update = (values: Record<string, any>, setter: (value: Record<string, any>) => void, key: string, value: string) => setter({ ...values, [key]: ['port', 'dailySendCap', 'perMinuteLimit', 'expiryMinutes', 'resendCooldownSeconds', 'maxAttempts', 'maxSendsPerNumberPerDay', 'lowBalanceThreshold'].includes(key) ? Number(value) : value })
  const current = channel === 'email' ? email : sms
  const setCurrent = channel === 'email' ? setEmail : setSms
  if (error) return <Card><CardContent className="pt-6 text-sm text-destructive">{error.message}</CardContent></Card>

  return <div className="flex flex-col gap-5">
    <div className="flex gap-2" role="tablist" aria-label="Messaging provider"><Button role="tab" aria-selected={channel === 'email'} variant={channel === 'email' ? 'secondary' : 'ghost'} onClick={() => setChannel('email')}><Mail data-icon="inline-start" />Email</Button><Button role="tab" aria-selected={channel === 'sms'} variant={channel === 'sms' ? 'secondary' : 'ghost'} onClick={() => setChannel('sms')}><MessageSquare data-icon="inline-start" />SMS</Button></div>
    <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{channel === 'email' ? 'SMTP provider' : 'Termii SMS provider'}</CardTitle><CardDescription>{channel === 'email' ? 'Transactional email is sent through your configured SMTP server.' : 'SMS is reserved for phone verification codes.'}</CardDescription></div><Badge variant="outline"><ShieldCheck data-icon="inline-start" />Secrets remain server-side</Badge></div></CardHeader><CardContent className="flex flex-col gap-5">
      <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={active[channel]} onChange={(event) => setActive({ ...active, [channel]: event.target.checked })} />Enable {channel === 'email' ? 'email delivery' : 'phone verification SMS'}</label>
      {channel === 'email' ? <div className="grid gap-4 md:grid-cols-2">
        <Field label="SMTP host" value={email.host} placeholder="smtp.example.com" onChange={(value) => update(email, setEmail, 'host', value)} />
        <Field label="Port" type="number" min={1} max={65535} value={email.port} onChange={(value) => update(email, setEmail, 'port', value)} />
        <Field label="Username" value={email.username} onChange={(value) => update(email, setEmail, 'username', value)} />
        <Field label={`Password ${data?.email.secretHints.password ? `(${data.email.secretHints.password})` : ''}`} type="password" value={password} placeholder="Leave blank to keep existing password" onChange={setPassword} />
        <Field label="From name" value={email.fromName} onChange={(value) => update(email, setEmail, 'fromName', value)} />
        <Field label="From address" type="email" value={email.fromAddress} onChange={(value) => update(email, setEmail, 'fromAddress', value)} />
        <Field label="Reply-to address" type="email" value={email.replyTo} onChange={(value) => update(email, setEmail, 'replyTo', value)} />
        <Field label="Daily send cap" type="number" min={1} value={email.dailySendCap} onChange={(value) => update(email, setEmail, 'dailySendCap', value)} />
        <Field label="Per-minute rate limit" type="number" min={1} value={email.perMinuteLimit} onChange={(value) => update(email, setEmail, 'perMinuteLimit', value)} />
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(email.secure)} onChange={(event) => setEmail({ ...email, secure: event.target.checked })} />Use implicit TLS (port 465)</label>
      </div> : <div className="grid gap-4 md:grid-cols-2">
        <Field label="Termii account base URL" value={sms.baseUrl} placeholder="Use the base URL shown in your Termii account" onChange={(value) => update(sms, setSms, 'baseUrl', value)} />
        <Field label="Sender ID" value={sms.senderId} onChange={(value) => update(sms, setSms, 'senderId', value)} />
        <Field label="API key" type="password" value={apiKey} placeholder={data?.sms.secretHints.apiKey ? `Saved ${data.sms.secretHints.apiKey}` : 'Enter API key'} onChange={setApiKey} />
        <label className="flex flex-col gap-1.5 text-sm font-medium"><span>Channel</span><select value={sms.channel} onChange={(event) => update(sms, setSms, 'channel', event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3"><option value="generic">Generic</option><option value="dnd">DND</option><option value="whatsapp">WhatsApp</option><option value="voice">Voice</option></select></label>
        <Field label="Code length" type="number" value={6} disabled onChange={() => undefined} />
        <Field label="Code expiry (minutes)" type="number" min={1} max={60} value={sms.expiryMinutes} onChange={(value) => update(sms, setSms, 'expiryMinutes', value)} />
        <Field label="Resend cooldown (seconds)" type="number" min={30} value={sms.resendCooldownSeconds} onChange={(value) => update(sms, setSms, 'resendCooldownSeconds', value)} />
        <Field label="Maximum attempts" type="number" min={1} max={10} value={sms.maxAttempts} onChange={(value) => update(sms, setSms, 'maxAttempts', value)} />
        <Field label="Sends per number per day" type="number" min={1} max={10} value={sms.maxSendsPerNumberPerDay} onChange={(value) => update(sms, setSms, 'maxSendsPerNumberPerDay', value)} />
        <Field label="Low-balance threshold" type="number" min={0} value={sms.lowBalanceThreshold} onChange={(value) => update(sms, setSms, 'lowBalanceThreshold', value)} />
        <p className="text-xs text-muted-foreground md:col-span-2">Set the account-specific base URL provided by Termii. API endpoint paths are appended server-side.</p>
      </div>}
      <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4"><div className="min-w-56 flex-1"><Field label={channel === 'email' ? 'Test recipient email' : 'Test recipient phone (+234...)'} value={testTarget} placeholder={channel === 'email' ? 'you@example.com' : '+2348012345678'} onChange={setTestTarget} /></div><Button type="button" variant="outline" disabled={busy} onClick={test}><Send data-icon="inline-start" />Send test</Button><Button type="button" disabled={busy} onClick={save}><Save data-icon="inline-start" />{busy ? 'Saving…' : 'Save settings'}</Button>{channel === 'sms'&&<Button type="button" variant="outline" disabled={busy} onClick={checkBalance}>Check SMS balance</Button>}</div>
      {status&&<p role="status" className="text-sm text-muted-foreground">{status}</p>}{balance&&<p role="status" className="text-sm text-muted-foreground">SMS balance: {balance}</p>}
    </CardContent></Card>
  </div>
}

function TemplateEditor({ audit }: { audit: Audit }) {
  const { data, error, mutate } = useSWR<{ templates: Template[] }>('/api/admin/messaging/templates', fetcher)
  const [eventKey, setEventKey] = useState(eventOptions[0][0] as string)
  const [draft, setDraft] = useState<Template>({ event_key: eventOptions[0][0], channel: 'email', enabled: true, subject: '', body: '' })
  const [target, setTarget] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const templates = data?.templates ?? []
  useEffect(() => {
    const existing = templates.find((template) => template.event_key === eventKey)
    setDraft(existing ? { ...existing } : { event_key: eventKey, channel: 'email', enabled: false, subject: '', body: '' })
  }, [eventKey, data])
  const previewSubject = useMemo(() => renderPreview(draft.subject), [draft.subject])
  const previewBody = useMemo(() => renderPreview(draft.body), [draft.body])
  const save = async () => {
    const next = [...templates.filter((template) => template.event_key !== eventKey), { ...draft, event_key: eventKey, channel: 'email' as const }]
    setBusy(true); setStatus('')
    const response = await fetch('/api/admin/messaging/templates', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ templates: next }) })
    const result = await response.json().catch(() => ({})); setBusy(false); setStatus(response.ok ? 'Template saved.' : result.error ?? 'Unable to save template.')
    if (response.ok) { audit('save_message_templates', eventKey); await mutate() }
  }
  const sendTest = async () => {
    setBusy(true); setStatus('')
    const response = await fetch('/api/admin/messaging/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel: 'email', event_key: eventKey, target }) })
    const result = await response.json().catch(() => ({})); setBusy(false); setStatus(response.ok ? 'Template test sent.' : result.error ?? 'Unable to send test.')
    audit('send_template_test', eventKey)
  }
  if (error) return <Card><CardContent className="pt-6 text-sm text-destructive">{error.message}</CardContent></Card>
  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
    <Card><CardHeader><CardTitle>Email templates</CardTitle><CardDescription>Supported variables: {'{nickname}'}, {'{amount}'}, {'{reference}'}, {'{reason}'}, {'{rank}'}, {'{date}'}, {'{link}'}.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium"><span>Event</span><select value={eventKey} onChange={(event) => setEventKey(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3">{eventOptions.map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>
      <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />Enable template</label>
      <Field label="Subject" value={draft.subject} onChange={(value) => setDraft({ ...draft, subject: value })} />
      <label className="flex flex-col gap-1.5 text-sm font-medium"><span>HTML body</span><textarea rows={9} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} className="rounded-lg border border-border bg-background p-3 font-mono text-sm" /></label>
      <div className="flex flex-wrap items-end gap-3"><div className="min-w-52 flex-1"><Field label="Test recipient email" type="email" value={target} onChange={setTarget} /></div><Button type="button" variant="outline" disabled={busy||!target} onClick={sendTest}><Send data-icon="inline-start" />Send test</Button><Button type="button" disabled={busy} onClick={save}><Save data-icon="inline-start" />Save template</Button></div>
      {status&&<p role="status" className="text-sm text-muted-foreground">{status}</p>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Live preview</CardTitle><CardDescription>Sample values are substituted and HTML is isolated in a sandbox.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3"><p className="rounded-lg border border-border bg-muted/40 p-3 text-sm font-semibold">{previewSubject||'Subject preview'}</p><iframe title="Email template preview" sandbox="" referrerPolicy="no-referrer" srcDoc={`<!doctype html><html><body style="font-family:Arial,sans-serif;padding:20px;color:#222">${previewBody}</body></html>`} className="min-h-64 w-full rounded-lg border border-border bg-white" /></CardContent></Card>
  </div>
}

function DeliveryLogs({ audit }: { audit: Audit }) {
  const [page, setPage] = useState(1)
  const [channel, setChannel] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const query = new URLSearchParams({ page: String(page), page_size: '10', ...(channel ? { channel } : {}), ...(statusFilter ? { status: statusFilter } : {}) })
  const { data, error, mutate, isLoading } = useSWR<{ logs: Log[]; pagination: { page: number; total_pages: number; total: number } }>(`/api/admin/messaging/logs?${query}`, fetcher)
  const [busyId, setBusyId] = useState('')
  const retry = async (id: string) => {
    setBusyId(id)
    const response = await fetch(`/api/admin/messaging/retry/${id}`, { method: 'POST' })
    const result = await response.json().catch(() => ({})); setBusyId('')
    if (!response.ok) window.alert(result.error ?? 'Unable to retry delivery')
    else audit('retry_notification', id)
    await mutate()
  }
  return <Card><CardHeader><CardTitle>Delivery log</CardTitle><CardDescription>Recipients are masked. Email outbox failures can be retried from here.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">
    <div className="flex flex-wrap gap-3"><label className="flex flex-col gap-1 text-sm"><span>Channel</span><select value={channel} onChange={(event) => { setPage(1); setChannel(event.target.value) }} className="h-9 rounded-lg border border-border bg-background px-3"><option value="">All channels</option><option value="email">Email</option><option value="sms">SMS</option></select></label><label className="flex flex-col gap-1 text-sm"><span>Status</span><select value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value) }} className="h-9 rounded-lg border border-border bg-background px-3"><option value="">All statuses</option><option value="sent">Sent</option><option value="failed">Failed</option></select></label><div className="ml-auto self-end text-sm text-muted-foreground">{data?.pagination.total ?? 0} records</div></div>
    {error&&<p role="alert" className="text-sm text-destructive">{error.message}</p>}{isLoading?<p className="text-sm text-muted-foreground">Loading delivery history…</p>:<div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-border text-muted-foreground"><th className="py-2 pr-3 font-medium">Time</th><th className="py-2 pr-3 font-medium">Recipient</th><th className="py-2 pr-3 font-medium">Event</th><th className="py-2 pr-3 font-medium">Status</th><th className="py-2 pr-3 font-medium">Details</th><th className="py-2 font-medium">Action</th></tr></thead><tbody>{(data?.logs??[]).map((log)=><tr key={log.id} className="border-b border-border/60"><td className="py-3 pr-3 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td><td className="py-3 pr-3">{log.recipient_masked}</td><td className="py-3 pr-3">{log.event_key??'—'}</td><td className="py-3 pr-3"><Badge variant={log.status==='sent'?'secondary':'destructive'}>{log.status}</Badge></td><td className="max-w-56 py-3 pr-3 text-muted-foreground">{log.error??'—'}</td><td className="py-3">{log.status==='failed'&&log.channel==='email'?<Button size="sm" variant="outline" disabled={busyId===log.id} onClick={()=>void retry(log.id)}><RefreshCw data-icon="inline-start" />Retry</Button>:null}</td></tr>)}</tbody></table>{!data?.logs.length&&<p className="py-8 text-center text-sm text-muted-foreground">No delivery records match these filters.</p>}</div>}
    <div className="flex items-center justify-between"><Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(value=>value-1)}>Previous</Button><span className="text-sm text-muted-foreground">Page {data?.pagination.page??page} of {data?.pagination.total_pages??1}</span><Button variant="outline" size="sm" disabled={page>=(data?.pagination.total_pages??1)} onClick={()=>setPage(value=>value+1)}>Next</Button></div>
  </CardContent></Card>
}

export function CommunicationsPanel({ audit }: { audit: Audit }) {
  const [tab, setTab] = useState<'providers'|'templates'|'logs'>('providers')
  return <div className="flex flex-col gap-5"><header><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Admin console</p><h1 className="mt-1 font-display text-2xl font-bold">Email and SMS</h1><p className="mt-1 text-sm text-muted-foreground">Manage SMTP delivery, phone-verification SMS, templates, and delivery history.</p></header><nav className="flex flex-wrap gap-2" aria-label="Messaging sections"><Button variant={tab==='providers'?'secondary':'ghost'} onClick={()=>setTab('providers')}>Providers</Button><Button variant={tab==='templates'?'secondary':'ghost'} onClick={()=>setTab('templates')}>Templates</Button><Button variant={tab==='logs'?'secondary':'ghost'} onClick={()=>setTab('logs')}>Delivery logs</Button></nav>{tab==='providers'?<ProviderCards audit={audit}/>:tab==='templates'?<TemplateEditor audit={audit}/>:<DeliveryLogs audit={audit}/>}</div>
}
