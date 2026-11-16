'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AdgemPostbackUrl } from '@/components/admin/adgem-postback-url'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { PUBLIC_FORM_AD_LIMITS, type AdPage, type AdSettings, type AdSize, type AdPlacementSlot, type AdNetwork } from '@/lib/ad-settings'
import { useAdConsent } from '@/components/ads/AdSlot'
import { isExpectedDiagnosticMessage } from '@/lib/ad-diagnostics'

type NetworkResponse = AdSettings & { postbackSecretConfigured: boolean }
const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Unable to load ad settings')
  return result
}
const sizes: AdSize[] = ['320x100', '300x250', '728x90']
const positions: AdPlacementSlot['position'][] = ['top', 'inline', 'bottom', 'sidebar']
const publicPlacementPages: AdPage[] = ['Landing', 'Terms', 'Privacy', 'PrizeRules', 'ResponsiblePlay']
const formPlacementPages: AdPage[] = [...PUBLIC_FORM_AD_LIMITS.pages]
const globalScriptPages: AdPage[] = ['Home', 'Fixtures', 'Predictions', 'Leaderboard', 'Rewards', 'Earn', 'Referrals', 'Profile', 'Spin', 'Landing', 'Terms', 'Privacy', 'PrizeRules', 'ResponsiblePlay']
const positionsForPage = (page: AdPage): AdPlacementSlot['position'][] => formPlacementPages.includes(page) ? [PUBLIC_FORM_AD_LIMITS.position] : publicPlacementPages.includes(page) ? ['top', 'bottom'] : positions
const slotLimitForPage = (page: AdPage) => formPlacementPages.includes(page) ? PUBLIC_FORM_AD_LIMITS.maxSlots : 5

export function AdsOffersPanel({ audit = () => undefined }: { audit?: (action: string, target: string) => void }) {
  const [tab, setTab] = useState<'networks' | 'placements' | 'offerwall' | 'reporting'>('networks')
  const [settings, setSettings] = useState<AdSettings | null>(null)
  const [postbackSecret, setPostbackSecret] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [postbackResult, setPostbackResult] = useState('')
  const { data: networks, error: networkError, mutate: mutateNetworks } = useSWR<NetworkResponse>('/api/admin/ads/networks', fetcher)
  const { data: placements, error: placementError, mutate: mutatePlacements } = useSWR<{ placements: AdSettings['placements'] }>('/api/admin/ads/placements', fetcher)
  const { data: smartlinkDiagnostics } = useSWR<{ checks: Array<{ key: string; ok: boolean; message: string }>; adcashChecks: Array<{ key: string; ok: boolean; message: string }>; slots: Array<{ page: AdPage; index: number; position: AdPlacementSlot['position']; network: AdNetwork; size: AdSize; ready: boolean; reason: string; previewMode: boolean }>; visitorsMustAcceptCookieBanner: boolean }>('/api/admin/ads/diagnostics?page=Earn', fetcher)
  const { data: blockedHosts, mutate: mutateBlockedHosts } = useSWR<{ groups: Array<{ blockedHost: string; directive: string; count: number }>; hosts: string[] }>('/api/admin/ads/blocked-hosts', fetcher)

  useEffect(() => {
    if (!settings && networks && placements) setSettings({ ...networks, placements: placements.placements })
  }, [networks, placements, settings])

  const update = (change: (draft: AdSettings) => void) => setSettings((current) => {
    if (!current) return current
    const draft = structuredClone(current)
    change(draft)
    return draft
  })
  const save = async () => {
    if (!settings) return
    setSaving(true)
    setMessage('')
    try {
      const networkResponse = await fetch('/api/admin/ads/networks', {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...settings, postbackSecret }),
      })
      const networkResult = await networkResponse.json()
      if (!networkResponse.ok) throw new Error(networkResult.error ?? 'Unable to save network settings')
      const placementResponse = await fetch('/api/admin/ads/placements', {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ placements: Object.entries(settings.placements).map(([page, value]) => ({ page, ...value })) }),
      })
      const placementResult = await placementResponse.json()
      if (!placementResponse.ok) throw new Error(placementResult.error ?? 'Unable to save placements')
      audit('save_ads_settings', tab)
      setPostbackSecret('')
      setMessage('Changes saved.')
      await Promise.all([mutatePlacements(), mutateNetworks()])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save ad settings')
    } finally { setSaving(false) }
  }
  const testPostback = async () => {
    setTesting(true)
    setPostbackResult('')
    try {
      const response = await fetch('/api/admin/ads/offerwall/test-postback', { method: 'POST' })
      const result = await response.json()
      setPostbackResult(response.ok ? 'Signed test received. No credits were issued.' : result.error ?? 'Test failed.')
    } catch { setPostbackResult('Unable to send the test postback.') } finally { setTesting(false) }
  }
  if (networkError || placementError) return <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">Unable to load ad settings. Refresh and try again.</div>
  if (!settings) return <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground" aria-busy="true">Loading ad settings…</div>

  const setSlotCount = (page: AdPage, count: number) => update((draft) => {
    const limitedCount = Math.min(slotLimitForPage(page), count)
    const slots = draft.placements[page].slots.slice(0, limitedCount)
    while (slots.length < limitedCount) slots.push({ position: positionsForPage(page)[0], network: 'A-ADS', size: '728x90' })
    draft.placements[page].slots = slots
  })
  const tabs = ['networks', 'placements', 'offerwall', 'reporting'] as const
  const unitInput = (label: string, value: string, onChange: (value: string) => void) => <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label>
  const toggle = (label: string, checked: boolean, onChange: (checked: boolean) => void) => <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>

  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Admin console</p><h1 className="mt-1 font-display text-2xl font-bold">Ads and Offers</h1><p className="mt-1 text-sm text-muted-foreground">Consent-gated placements, saved to the database. Ads never affect points or prizes.</p></div><div className="flex items-center gap-3">{toggle('Preview mode', settings.previewMode, (checked) => update((draft) => { draft.previewMode = checked }))}{tab !== 'reporting' && <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>}</div></div>
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Ads settings">{tabs.map((item) => <Button key={item} role="tab" aria-selected={tab === item} variant={tab === item ? 'default' : 'outline'} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</Button>)}</div>

    {tab === 'networks' && <div className="grid gap-4 lg:grid-cols-2">
      <NetworkCard title="A-ADS" active={settings.networks.aads.active} onToggle={(active) => update((draft) => { draft.networks.aads.active = active })}>
        {sizes.map((size) => <div key={size} className="flex flex-col gap-2 rounded-lg border border-border/70 p-3">{toggle(`${size} placement active`, settings.networks.aads.unitActive[size], (active) => update((draft) => { draft.networks.aads.unitActive[size] = active }))}<SnippetField network="A-ADS" size={size} value={settings.networks.aads.units[size]} onChange={(value) => update((draft) => { draft.networks.aads.units[size] = value })} /></div>)}
      </NetworkCard>
      <NetworkCard title="Adcash" active={settings.networks.adcash.enabled} onToggle={(enabled) => update((draft) => { draft.networks.adcash.enabled = enabled })}>
        <AdcashField value={settings.networks.adcash.input} onChange={(value) => update((draft) => { draft.networks.adcash.input = value })} />
        <div className="flex flex-col gap-2 rounded-lg border border-border/70 p-3">
          <p className="text-xs font-semibold text-muted-foreground">Allowed pages for global scripts</p>
          <div className="grid gap-2 sm:grid-cols-2">{globalScriptPages.map((page) => <div key={page}>{toggle(page, settings.networks.adcash.allowedPages.includes(page), (allowed) => update((draft) => {
            const allowedPages = draft.networks.adcash.allowedPages
            draft.networks.adcash.allowedPages = allowed ? [...new Set([...allowedPages, page])] : allowedPages.filter((item) => item !== page)
          }))}</div>)}</div>
        </div>
        <p className="text-xs text-muted-foreground">Your website must be verified in the Adcash publisher panel.</p>
        <p className="text-xs text-muted-foreground">Autotag chooses its own formats (including pop-unders), so enable it only on pages where you want that.</p>
        <p className="text-xs text-muted-foreground">Add acscdn.com to AD_SCRIPT_HOSTS and redeploy. CSP-blocked hosts appear below grouped by host, directive, and count; check rows whose directive starts with script-src.</p>
        <section className="flex flex-col gap-2 rounded-lg border border-border/70 p-3"><h3 className="text-sm font-semibold">Adcash diagnostics</h3>{smartlinkDiagnostics?.adcashChecks.map((check) => <p key={check.key} className="text-xs text-muted-foreground">{check.ok ? 'OK' : 'Needs attention'}: {check.message}</p>)}</section>
      </NetworkCard>
      <NetworkCard title="Adsterra" active={settings.networks.adsterra.active} onToggle={(active) => update((draft) => { draft.networks.adsterra.active = active })}>
        {sizes.map((size) => <div key={size} className="flex flex-col gap-2 rounded-lg border border-border/70 p-3">{toggle(`${size} banner active`, settings.networks.adsterra.bannerActive[size], (active) => update((draft) => { draft.networks.adsterra.bannerActive[size] = active }))}<SnippetField network="Adsterra" size={size} value={settings.networks.adsterra.banner[size]} onChange={(value) => update((draft) => { draft.networks.adsterra.banner[size] = value })} /></div>)}
        <div className="flex flex-col gap-2 rounded-lg border border-border/70 p-3">{toggle('Native placement active', settings.networks.adsterra.nativeActive, (active) => update((draft) => { draft.networks.adsterra.nativeActive = active }))}<SnippetField network="Adsterra" size="native" value={settings.networks.adsterra.native} onChange={(value) => update((draft) => { draft.networks.adsterra.native = value })} /></div>
        <AdsterraDiagnostic />
        <UrlField label="Social bar script URL or full script tag" value={settings.networks.adsterra.socialBar} active={settings.networks.adsterra.socialBarActive} onValue={(value) => update((draft) => { draft.networks.adsterra.socialBar = value })} onActive={(active) => update((draft) => { draft.networks.adsterra.socialBarActive = active })} />
        <UrlField label="Popunder script URL or full script tag" value={settings.networks.adsterra.popunder} active={settings.networks.adsterra.popunderActive} onValue={(value) => update((draft) => { draft.networks.adsterra.popunder = value })} onActive={(active) => update((draft) => { draft.networks.adsterra.popunderActive = active })} />
        <CreativeField label="Smartlink URL" value={settings.networks.adsterra.smartlink} active={settings.networks.adsterra.smartlinkActive} onValue={(value) => update((draft) => { draft.networks.adsterra.smartlink = value })} onActive={(active) => update((draft) => { draft.networks.adsterra.smartlinkActive = active })} />
        <section className="flex flex-col gap-2 rounded-lg border border-border/70 p-3"><h3 className="text-sm font-semibold">Why isn&apos;t it showing?</h3>{smartlinkDiagnostics?.checks.map((check) => <p key={check.key} className="text-xs text-muted-foreground">{check.ok ? 'OK' : 'Needs attention'}: {check.message}</p>)}<p className="text-xs text-muted-foreground">Visitors must also have accepted the cookie banner.</p></section>
        <section className="flex flex-col gap-2 rounded-lg border border-border/70 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Blocked by security policy</h3><p className="text-xs text-muted-foreground">Last 7 days; grouped by blocked host and directive.</p></div><Button type="button" size="sm" variant="outline" disabled={!blockedHosts?.hosts.length} onClick={async () => { await navigator.clipboard.writeText(blockedHosts?.hosts.join(', ') ?? ''); await mutateBlockedHosts() }}>Copy AD_SCRIPT_HOSTS value</Button></div>{blockedHosts?.groups.length ? blockedHosts.groups.map((item) => <p key={`${item.blockedHost}-${item.directive}`} className="text-xs text-muted-foreground">{item.blockedHost} · {item.directive} · {item.count}</p>) : <p className="text-xs text-muted-foreground">No blocked external hosts reported in the last 7 days.</p>}<p className="text-xs text-muted-foreground">Add the host to the AD_SCRIPT_HOSTS project variable and redeploy.</p></section>
      </NetworkCard>
    </div>}

    {tab === 'placements' && <div className="flex flex-col gap-3">{(Object.entries(settings.placements) as [AdPage, AdSettings['placements'][AdPage]][]).map(([page, value]) => <section key={page} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg font-bold">{page}</h2><div className="flex items-center gap-4">{toggle('Enabled', value.enabled, (enabled) => update((draft) => { draft.placements[page].enabled = enabled }))}<label className="flex items-center gap-2 text-sm">Slots <input type="number" min={0} max={slotLimitForPage(page)} value={value.slots.length} onChange={(event) => setSlotCount(page, Math.min(slotLimitForPage(page), Math.max(0, Number(event.target.value) || 0)))} className="h-9 w-16 rounded-lg border border-border bg-background px-2" /></label></div></div>{formPlacementPages.includes(page) && <p className="text-xs text-muted-foreground">{PUBLIC_FORM_AD_LIMITS.reason}</p>}{smartlinkDiagnostics?.slots.filter((item) => item.page === page).map((item) => <p key={`diagnostic-${page}-${item.index}`} className="text-xs text-muted-foreground">Slot {item.index + 1} · {item.network} · {item.size} · {item.position}: {item.reason} <SlotDiagnostic page={page} slot={item.index} size={item.size} /></p>)}{value.slots.map((slot, index) => <div key={`${page}-${index}`} className="grid gap-2 sm:grid-cols-3"><label className="flex flex-col gap-1 text-xs text-muted-foreground">Position<select value={slot.position} onChange={(event) => update((draft) => { draft.placements[page].slots[index].position = event.target.value as AdPlacementSlot['position'] })} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground">{positionsForPage(page).map((position) => <option key={position} value={position}>{position}</option>)}</select></label><label className="flex flex-col gap-1 text-xs text-muted-foreground">Network<select value={slot.network} onChange={(event) => update((draft) => { draft.placements[page].slots[index].network = event.target.value as AdPlacementSlot['network'] })} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="A-ADS" disabled={slot.size === 'native'}>A-ADS</option><option value="Adsterra">Adsterra</option></select></label><label className="flex flex-col gap-1 text-xs text-muted-foreground">Size<select value={slot.size} onChange={(event) => update((draft) => { draft.placements[page].slots[index].size = event.target.value as AdSize; if (event.target.value === 'native') draft.placements[page].slots[index].network = 'Adsterra' })} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground">{sizes.map((size) => <option key={size}>{size}</option>)}<option value="native">native</option></select></label><Button type="button" size="sm" variant="outline" onClick={() => window.open(`/ad-frame?page=${encodeURIComponent(page)}&slot=${index}&debug=1`, '_blank', 'noopener,noreferrer')}>Debug a slot</Button></div>)}</section>)}</div>}

    {tab === 'offerwall' && <section className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-5"><div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-bold">Offerwall</h2><p className="text-sm text-muted-foreground">Provider settings and encrypted postback credential.</p></div><Badge variant={settings.offerwall.active ? 'secondary' : 'outline'}>{settings.offerwall.active ? 'Active' : 'Disabled'}</Badge></div>{toggle('Offerwall active', settings.offerwall.active, (active) => update((draft) => { draft.offerwall.active = active }))}<div className="grid gap-3 sm:grid-cols-2">{unitInput('Provider name', settings.offerwall.provider, (value) => update((draft) => { draft.offerwall.provider = value }))}{unitInput('Application ID', settings.offerwall.appId, (value) => update((draft) => { draft.offerwall.appId = value }))}{unitInput('Embed URL template (must include {userId})', settings.offerwall.embedUrl, (value) => update((draft) => { draft.offerwall.embedUrl = value }))}{unitInput('Postback secret (leave blank to keep current)', postbackSecret, setPostbackSecret)}{unitInput('Reward share percent', String(settings.offerwall.rewardShare), (value) => update((draft) => { draft.offerwall.rewardShare = Number(value) }))}{unitInput('Hold days', String(settings.offerwall.holdDays), (value) => update((draft) => { draft.offerwall.holdDays = Number(value) }))}{unitInput('FX rate', String(settings.offerwall.fxRate), (value) => update((draft) => { draft.offerwall.fxRate = Number(value) }))}</div><AdgemPostbackUrl /><div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" onClick={testPostback} disabled={testing}>{testing ? 'Sending…' : 'Test postback'}</Button><span className="text-xs text-muted-foreground">{networks?.postbackSecretConfigured ? 'A postback secret is configured.' : 'No postback secret is configured.'}</span></div>{postbackResult && <p role="status" className="text-sm text-muted-foreground">{postbackResult}</p>}</section>}

    {tab === 'reporting' && <section className="rounded-xl border border-border/70 bg-card p-5"><h2 className="font-display text-lg font-bold">Ad revenue entries</h2><p className="mt-2 text-sm text-muted-foreground">Revenue tracking arrives with the treasury update.</p></section>}
  </div>
}

type SnippetValidation = { ok: boolean; issues: string[]; html: string; width?: number; height?: number; unitId?: string }
type AdcashValidation = { ok: boolean; issues: string[]; format?: 'autotag' | 'pop'; zoneId?: string }
const slotDimensions: Record<AdSize, { width: number; height: number }> = { '320x100': { width: 320, height: 100 }, '300x250': { width: 300, height: 250 }, '728x90': { width: 728, height: 90 }, native: { width: 0, height: 0 } }

function SlotDiagnostic({ page, slot, size }: { page: AdPage; slot: number; size: AdSize }) {
  const { consent } = useAdConsent()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [events, setEvents] = useState<string[]>([])
  const dimensions = slotDimensions[size]
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (!isExpectedDiagnosticMessage(event.source, frameRef.current?.contentWindow ?? null, event.data)) return
      const detail = event.data.detail && typeof event.data.detail === 'object' ? event.data.detail : {}
      const description = event.data.stage === 'script-requested' || event.data.stage === 'script-loaded' || event.data.stage === 'script-load-error' || event.data.stage === 'nested-frame-created' || event.data.stage === 'nested-frame-loaded' || event.data.stage === 'nested-frame-error'
        ? `${event.data.stage}${detail.host ? `: ${detail.host}` : ''}`
        : event.data.stage === 'csp-violation' ? `CSP blocked ${detail.blockedURI} (${detail.directive})`
          : event.data.stage === 'visibility-check' ? `Visible ad element detected: ${detail.visible ? 'yes' : 'no'} (${detail.elementCount} elements)`
            : event.data.stage === 'script-error' || event.data.stage === 'resource-error' ? `${event.data.stage}${detail.message ? `: ${detail.message}` : detail.host ? `: ${detail.host}` : ''}`
              : event.data.stage === 'document-start' ? `Diagnostic code executing; opaque origin: ${detail.opaqueOrigin ? 'yes' : 'no'}`
                : event.data.stage === 'creative-markup-ready' ? `Server creative HTML received and inspected (${detail.scripts} external scripts, ${detail.iframes} initial iframes)`
                  : event.data.stage === 'document-loaded' ? 'Iframe document load event fired' : event.data.stage
      setEvents((current) => [...current.slice(-39), description])
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [])
  const src = `/ad-frame?page=${encodeURIComponent(page)}&slot=${slot}&debug=1`
  return <Dialog>
    <DialogTrigger render={<Button type="button" variant="link" size="sm" className="h-auto p-0" disabled={consent !== true}>Debug in visitor iframe</Button>} />
    <DialogContent className="max-w-3xl">
      <DialogHeader><DialogTitle>{page} · slot {slot + 1} sandbox diagnostic</DialogTitle><DialogDescription>Same ad-frame URL, visitor sandbox, dimensions, and CSP. This admin-only view does not bypass visitor consent or change the creative. A script load or visible element is not evidence of a paid impression.</DialogDescription></DialogHeader>
      <div className="overflow-auto rounded-lg border border-border bg-background" style={{ height: size === 'native' ? 220 : Math.min(dimensions.height + 40, 340) }}>
        <iframe ref={frameRef} title={`${page} slot ${slot + 1} visitor sandbox diagnostic`} src={src} width={size === 'native' ? undefined : dimensions.width} height={size === 'native' ? 60 : dimensions.height} style={size === 'native' ? { width: '100%', height: 60 } : undefined} loading="lazy" className="max-w-full rounded-xl border-0 bg-background" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" />
      </div>
      <section aria-live="polite" className="max-h-40 overflow-auto rounded-lg border border-border/70 p-3 text-xs">
        <h3 className="mb-2 font-semibold">Browser observations</h3>
        <p>Network HTTP status and redirects are not exposed to the parent page by browser security. Script load events show successful resource loading, not successful ad delivery.</p>
        {events.length ? <ol className="mt-2 list-inside list-decimal space-y-1">{events.map((event, index) => <li key={`${index}-${event}`}>{event}</li>)}</ol> : <p className="mt-2">Waiting for the iframe diagnostic…</p>}
      </section>
    </DialogContent>
  </Dialog>
}

type AdsterraDiagnosticFormat = { size: AdSize; ready: boolean; reason: string; sourceHost: string | null }
type AdsterraDiagnosticEvent = { stage: string; message: string }

function AdsterraDiagnostic() {
  const { consent } = useAdConsent()
  const [format, setFormat] = useState<AdSize>('300x250')
  const [running, setRunning] = useState(false)
  const [events, setEvents] = useState<AdsterraDiagnosticEvent[]>([])
  const frameRef = useRef<HTMLIFrameElement>(null)
  const { data, error } = useSWR<{ network: 'Adsterra'; formats: AdsterraDiagnosticFormat[] }>('/api/admin/ads/diagnostics/adsterra', fetcher, { revalidateOnFocus: false })
  const selected = data?.formats.find((item) => item.size === format)
  const dimensions = slotDimensions[format]

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (!isExpectedDiagnosticMessage(event.source, frameRef.current?.contentWindow ?? null, event.data)) return
      const stage = event.data.stage
      const detail = event.data.detail && typeof event.data.detail === 'object' ? event.data.detail : {}
      let message: string
      if (stage === 'server-creative-returned') message = `Saved creative returned; server frame response ${detail.httpStatus ?? 'unavailable'}; source host ${detail.sourceHost ?? 'not detected'}.`
      else if (stage === 'server-creative-unavailable') message = `Creative not returned: ${detail.reason ?? 'reason unavailable'}`
      else if (stage === 'script-requested') message = `External script request initiated in ${detail.documentCategory ?? 'unknown document'}: ${detail.host ?? 'host unavailable'} (script).`
      else if (stage === 'script-loaded') message = `External script loaded in ${detail.documentCategory ?? 'unknown document'}: ${detail.host ?? 'host unavailable'}. This does not confirm execution or ad rendering.`
      else if (stage === 'script-load-error') message = `External script load failed in ${detail.documentCategory ?? 'unknown document'}: ${detail.host ?? 'host unavailable'}.`
      else if (stage === 'image-requested' || stage === 'image-loaded' || stage === 'image-load-error') message = `${stage} in ${detail.documentCategory ?? 'unknown document'}: ${detail.host ?? 'host unavailable'} (image resource).`
      else if (stage === 'nested-frame-created' || stage === 'nested-frame-loaded' || stage === 'nested-frame-error') message = `${stage}: ${detail.documentCategory ?? 'unknown frame'}${detail.host && detail.host !== 'about:blank' ? ` (${detail.host})` : ''}.`
      else if (stage === 'resource-error') message = `External ${detail.resourceType ?? 'resource'} error in ${detail.documentCategory ?? 'unknown document'}: ${detail.host ?? 'host unavailable'}.`
      else if (stage === 'csp-violation') message = `CSP violation in ${detail.documentCategory ?? 'unknown document'}: ${detail.resourceType ?? 'unknown resource'} from ${detail.host || 'inline/unknown source'}; ${detail.directive ?? 'directive unavailable'} (source file ${detail.sourceFileHost || 'not reported'}). Diagnostic was reported by the expected ad-frame only; nested-document violations may not be observable here.`
      else if (stage === 'visibility-check') message = `Visibility observation: ${detail.visible ? 'an ad-like element is visible' : 'no ad-like element is visible'} (${detail.elementCount ?? 0} observed). This is not proof of a paid impression.`
      else if (stage === 'document-start') message = `Diagnostic code started in an opaque-origin sandbox: ${detail.opaqueOrigin ? 'yes' : 'no'}.`
      else if (stage === 'creative-markup-ready') message = `Creative markup inspected (${detail.scripts ?? 0} external scripts, ${detail.iframes ?? 0} initial nested frames).`
      else if (stage === 'document-loaded') message = 'Ad-frame document load event fired; external resource HTTP status is unavailable.'
      else return
      setEvents((current) => [...current.slice(-39), { stage, message }])
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [])

  const runDiagnostic = () => {
    if (consent !== true || !selected?.ready) return
    setEvents([])
    setRunning(true)
  }
  const src = `/ad-frame?page=Landing&slot=0&debug=1&debugNetwork=Adsterra&format=${encodeURIComponent(format)}`

  return <section className="flex flex-col gap-3 rounded-lg border border-border/70 p-3">
    <div><h3 className="text-sm font-semibold">Adsterra visitor-sandbox diagnostic</h3><p className="text-xs text-muted-foreground">Tests the saved Adsterra creative independently of public placements. It does not change network or placement settings.</p></div>
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground" htmlFor="adsterra-diagnostic-format">Adsterra format
      <select id="adsterra-diagnostic-format" value={format} onChange={(event) => { setFormat(event.target.value as AdSize); setRunning(false); setEvents([]) }} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground">
        {(['320x100', '300x250', '728x90', 'native'] as AdSize[]).map((size) => <option key={size} value={size}>{size}</option>)}
      </select>
    </label>
    {error && <p role="alert" className="text-xs text-destructive">Unable to inspect configured Adsterra formats.</p>}
    {selected && <div className="flex flex-col gap-1 text-xs" aria-live="polite"><p>{selected.ready ? 'Ready to test' : 'Unavailable'}: {selected.reason}</p><p className="text-muted-foreground">Creative source hostname: {selected.sourceHost ?? 'not detected'}</p><p className="text-muted-foreground">Script execution: unverified unless independently established. Provider inventory is not exposed by these browser events; the absence of a visible element cannot distinguish no inventory from a rendering issue.</p><p className="text-muted-foreground">A visible element is not proof of a paid impression.</p></div>}
    <Button type="button" variant="outline" size="sm" disabled={consent !== true || !selected?.ready} onClick={runDiagnostic}>{running ? 'Restart diagnostic' : 'Test saved Adsterra creative'}</Button>
    {consent !== true && <p className="text-xs text-muted-foreground">Accept advertising consent in this browser to run the visitor-style frame.</p>}
    {running && selected?.ready && <>
      <p className="text-xs text-muted-foreground">Selected network: Adsterra · Format: {format} · Source: {selected.sourceHost ?? 'not detected'} · The frame response is HTTP 200 when its diagnostic document loads; provider HTTP status is not exposed here.</p>
      <div className="flex items-center justify-center overflow-hidden rounded-lg border border-border bg-background" style={{ height: format === 'native' ? 60 : dimensions.height }}>
        <iframe key={format} ref={frameRef} title={`Adsterra ${format} visitor-sandbox diagnostic`} src={src} width={format === 'native' ? undefined : dimensions.width} height={format === 'native' ? 60 : dimensions.height} style={format === 'native' ? { width: '100%', height: 60 } : undefined} loading="lazy" className="max-w-full rounded-xl border-0 bg-background" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" />
      </div>
      <section aria-live="polite" className="max-h-48 overflow-auto rounded-lg border border-border/70 p-3 text-xs"><h4 className="font-semibold">Browser observations</h4><ol className="mt-2 flex list-inside list-decimal flex-col gap-1">{events.map((item, index) => <li key={`${index}-${item.stage}`}>{item.message}</li>)}</ol>{events.length === 0 && <p className="mt-2 text-muted-foreground">Waiting for events from this diagnostic iframe only.</p>}</section>
    </>}
  </section>
}

function SnippetField({ network, size, value, onChange }: { network: Extract<AdNetwork, 'A-ADS' | 'Adsterra'>; size: AdSize; value: string; onChange: (value: string) => void }) {
  const [candidate, setCandidate] = useState('')
  useEffect(() => {
    const timeout = window.setTimeout(() => setCandidate(value), 300)
    return () => window.clearTimeout(timeout)
  }, [value])
  const { data, error, isLoading } = useSWR<SnippetValidation>(candidate.trim() ? ['/api/admin/ads/snippets/validate', network, size, candidate] as const : null, async ([url, selectedNetwork, selectedSize, snippet]) => {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ network: selectedNetwork, size: selectedSize, snippet }) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error ?? 'Unable to validate snippet')
    return result as SnippetValidation
  }, { revalidateOnFocus: false })
  const current = candidate === value ? data : undefined
  const currentError = candidate === value ? error : undefined
  const pending = Boolean(value.trim()) && (candidate !== value || isLoading)
  const dimensions = slotDimensions[size]
  const mismatch = current?.width !== undefined && current.height !== undefined && (current.width !== dimensions.width || current.height !== dimensions.height)
  const previewDocument = current?.ok ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="background:transparent;margin:0;display:flex;align-items:center;justify-content:center;overflow:hidden">${current.html}</body></html>` : ''

  return <div className="flex flex-col gap-2">
    <label htmlFor={`snippet-${network.toLowerCase()}-${size}`} className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">{size} {network} banner snippet
      <textarea id={`snippet-${network.toLowerCase()}-${size}`} value={value} onChange={(event) => onChange(event.target.value)} rows={6} maxLength={8192} spellCheck={false} className="rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground" />
    </label>
    <p className="text-xs text-muted-foreground">Paste the code exactly as the network gives it</p>
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      {pending && <Badge variant="outline">Checking…</Badge>}
      {current && <Badge variant={current.ok ? 'secondary' : 'destructive'}>{current.ok ? 'Valid' : 'Invalid'}</Badge>}
      {current?.ok && <span className="text-xs text-muted-foreground">{current.unitId ? `Unit ID ${current.unitId}` : current.width && current.height ? `Detected ${current.width}×${current.height}` : 'Dimensions not detected'}</span>}
      {current && !current.ok && current.issues[0] && <span className="text-xs text-destructive">{current.issues[0]}</span>}
      {currentError && <span role="alert" className="text-xs text-destructive">{currentError.message}</span>}
      {mismatch && <span className="text-xs text-amber-600">Warning: detected {current?.width}×{current?.height}, selected slot is {dimensions.width}×{dimensions.height}.</span>}
      {!value.trim() && <span className="text-xs text-muted-foreground">Paste a snippet to validate it.</span>}
    </div>
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" disabled={!current?.ok} />}>Preview</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{network} {size} preview</DialogTitle>
          <DialogDescription>This preview uses the sanitized snippet in a sandboxed frame.</DialogDescription>
        </DialogHeader>
        <iframe title={`${network} ${size} ad preview`} srcDoc={previewDocument} sandbox="allow-scripts allow-popups" className="h-[360px] w-full rounded-lg border border-border bg-background" />
      </DialogContent>
    </Dialog>
  </div>
}

function AdcashField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [candidate, setCandidate] = useState('')
  useEffect(() => {
    const timeout = window.setTimeout(() => setCandidate(value), 300)
    return () => window.clearTimeout(timeout)
  }, [value])
  const { data, error, isLoading } = useSWR<AdcashValidation>(candidate.trim() ? ['/api/admin/ads/snippets/validate', candidate] as const : null, async ([url, snippet]) => {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ network: 'Adcash', size: 'native', snippet }) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error ?? 'Unable to validate Adcash code')
    return result as AdcashValidation
  }, { revalidateOnFocus: false })
  const current = candidate === value ? data : undefined
  const currentError = candidate === value ? error : undefined
  const pending = Boolean(value.trim()) && (candidate !== value || isLoading)

  return <div className="flex flex-col gap-2 rounded-lg border border-border/70 p-3">
    <label htmlFor="adcash-code" className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Paste the Adcash code (both script blocks) or just the zone id
      <textarea id="adcash-code" value={value} onChange={(event) => onChange(event.target.value)} rows={6} maxLength={8192} spellCheck={false} className="rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground" />
    </label>
    <p className="text-xs text-muted-foreground">A zone ID by itself defaults to Autotag. Paste both official script blocks to select Pop format.</p>
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      {pending && <Badge variant="outline">Checking…</Badge>}
      {current && <Badge variant={current.ok ? 'secondary' : 'destructive'}>{current.ok ? 'Valid' : 'Invalid'}</Badge>}
      {current?.ok && <span className="text-xs text-muted-foreground">Detected format: {current.format}; zone ID: {current.zoneId}</span>}
      {current && !current.ok && current.issues[0] && <span className="text-xs text-destructive">{current.issues[0]}</span>}
      {currentError && <span role="alert" className="text-xs text-destructive">{currentError.message}</span>}
      {!value.trim() && <span className="text-xs text-muted-foreground">Paste a zone ID or the official Adcash code to validate it.</span>}
    </div>
  </div>
}

function detectScriptHost(value: string) {
  const wrapped = value.trim().match(/(?:^|\s)src\s*=\s*(["'])(.*?)\1/i)?.[2]
  const candidate = wrapped ?? value.trim().replace(/\\\s*$/, '')
  try {
    const url = new URL(candidate.startsWith('//') ? `https:${candidate}` : candidate)
    return url.protocol === 'https:' && !url.username && !url.password ? url.host : ''
  } catch { return '' }
}

function NetworkCard({ title, active, onToggle, children }: { title: string; active: boolean; onToggle: (active: boolean) => void; children: React.ReactNode }) {
  return <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5"><div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">{title}</h2><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => onToggle(event.target.checked)} /> Active</label></div><Badge variant={active ? 'secondary' : 'outline'}>{active ? 'Configured' : 'Disabled'}</Badge>{children}</section>
}
function CreativeField({ label, value, active, onValue, onActive }: { label: string; value: string; active: boolean; onValue: (value: string) => void; onActive: (active: boolean) => void }) {
  return <div className="flex flex-col gap-2 rounded-lg border border-border/70 p-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => onActive(event.target.checked)} />Active</label><label className="flex flex-col gap-1 text-xs text-muted-foreground">{label}<textarea value={value} onChange={(event) => onValue(event.target.value)} rows={2} className="rounded-lg border border-border bg-background p-3 text-sm text-foreground" /></label></div>
}
function UrlField({ label, value, active, onValue, onActive }: { label: string; value: string; active: boolean; onValue: (value: string) => void; onActive: (active: boolean) => void }) {
  const host = detectScriptHost(value)
  return <div className="flex flex-col gap-2 rounded-lg border border-border/70 p-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => onActive(event.target.checked)} />Active</label><label className="flex flex-col gap-1 text-xs text-muted-foreground">{label}<input value={value} onChange={(event) => onValue(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label>{host && <p className="text-xs text-muted-foreground">Host: {host}. Add this host to the AD_SCRIPT_HOSTS project variable and redeploy, otherwise the browser will block it</p>}</div>
}
