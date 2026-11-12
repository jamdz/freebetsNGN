'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { AdPage, AdSettings, AdSize, AdPlacementSlot } from '@/lib/ad-settings'

type NetworkResponse = AdSettings & { postbackSecretConfigured: boolean }
const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Unable to load ad settings')
  return result
}
const sizes: AdSize[] = ['320x100', '300x250', '728x90']
const positions: AdPlacementSlot['position'][] = ['top', 'inline', 'bottom', 'sidebar']

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
  const copyPostback = async () => {
    try { await navigator.clipboard.writeText('/api/postbacks/adgem'); setMessage('Postback URL copied.') } catch { setMessage('Copy is unavailable in this browser.') }
  }

  if (networkError || placementError) return <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">Unable to load ad settings. Refresh and try again.</div>
  if (!settings) return <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground" aria-busy="true">Loading ad settings…</div>

  const setSlotCount = (page: AdPage, count: number) => update((draft) => {
    const slots = draft.placements[page].slots.slice(0, count)
    while (slots.length < count) slots.push({ position: 'inline', network: 'A-ADS', size: '728x90' })
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
        {sizes.map((size) => <div key={size} className="flex flex-col gap-2 rounded-lg border border-border/70 p-3">{toggle(`${size} placement active`, settings.networks.aads.unitActive[size], (active) => update((draft) => { draft.networks.aads.unitActive[size] = active }))}{unitInput(`${size} unit ID`, settings.networks.aads.units[size], (value) => update((draft) => { draft.networks.aads.units[size] = value }))}</div>)}
      </NetworkCard>
      <NetworkCard title="Adsterra" active={settings.networks.adsterra.active} onToggle={(active) => update((draft) => { draft.networks.adsterra.active = active })}>
        {sizes.map((size) => <div key={size} className="flex flex-col gap-2 rounded-lg border border-border/70 p-3">{toggle(`${size} banner active`, settings.networks.adsterra.bannerActive[size], (active) => update((draft) => { draft.networks.adsterra.bannerActive[size] = active }))}<label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">{size} banner snippet or HTTPS URL<textarea value={settings.networks.adsterra.banner[size]} onChange={(event) => update((draft) => { draft.networks.adsterra.banner[size] = event.target.value })} rows={2} className="rounded-lg border border-border bg-background p-3 text-sm text-foreground" /></label></div>)}
        <CreativeField label="Native snippet or HTTPS URL" value={settings.networks.adsterra.native} active={settings.networks.adsterra.nativeActive} onValue={(value) => update((draft) => { draft.networks.adsterra.native = value })} onActive={(active) => update((draft) => { draft.networks.adsterra.nativeActive = active })} />
        <UrlField label="Social bar script URL" value={settings.networks.adsterra.socialBar} active={settings.networks.adsterra.socialBarActive} onValue={(value) => update((draft) => { draft.networks.adsterra.socialBar = value })} onActive={(active) => update((draft) => { draft.networks.adsterra.socialBarActive = active })} />
        <UrlField label="Popunder script URL" value={settings.networks.adsterra.popunder} active={settings.networks.adsterra.popunderActive} onValue={(value) => update((draft) => { draft.networks.adsterra.popunder = value })} onActive={(active) => update((draft) => { draft.networks.adsterra.popunderActive = active })} />
        <CreativeField label="Smartlink URL" value={settings.networks.adsterra.smartlink} active={settings.networks.adsterra.smartlinkActive} onValue={(value) => update((draft) => { draft.networks.adsterra.smartlink = value })} onActive={(active) => update((draft) => { draft.networks.adsterra.smartlinkActive = active })} />
      </NetworkCard>
    </div>}

    {tab === 'placements' && <div className="flex flex-col gap-3">{(Object.entries(settings.placements) as [AdPage, AdSettings['placements'][AdPage]][]).map(([page, value]) => <section key={page} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg font-bold">{page}</h2><div className="flex items-center gap-4">{toggle('Enabled', value.enabled, (enabled) => update((draft) => { draft.placements[page].enabled = enabled }))}<label className="flex items-center gap-2 text-sm">Slots <input type="number" min={0} max={5} value={value.slots.length} onChange={(event) => setSlotCount(page, Math.min(5, Math.max(0, Number(event.target.value) || 0)))} className="h-9 w-16 rounded-lg border border-border bg-background px-2" /></label></div></div>{value.slots.map((slot, index) => <div key={`${page}-${index}`} className="grid gap-2 sm:grid-cols-3"><label className="flex flex-col gap-1 text-xs text-muted-foreground">Position<select value={slot.position} onChange={(event) => update((draft) => { draft.placements[page].slots[index].position = event.target.value as AdPlacementSlot['position'] })} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground">{positions.map((position) => <option key={position} value={position}>{position}</option>)}</select></label><label className="flex flex-col gap-1 text-xs text-muted-foreground">Network<select value={slot.network} onChange={(event) => update((draft) => { draft.placements[page].slots[index].network = event.target.value as AdPlacementSlot['network'] })} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option>A-ADS</option><option>Adsterra</option></select></label><label className="flex flex-col gap-1 text-xs text-muted-foreground">Size<select value={slot.size} onChange={(event) => update((draft) => { draft.placements[page].slots[index].size = event.target.value as AdSize })} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground">{sizes.map((size) => <option key={size}>{size}</option>)}</select></label></div>)}</section>)}</div>}

    {tab === 'offerwall' && <section className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-5"><div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-bold">Offerwall</h2><p className="text-sm text-muted-foreground">Provider settings and encrypted postback credential.</p></div><Badge variant={settings.offerwall.active ? 'secondary' : 'outline'}>{settings.offerwall.active ? 'Active' : 'Disabled'}</Badge></div>{toggle('Offerwall active', settings.offerwall.active, (active) => update((draft) => { draft.offerwall.active = active }))}<div className="grid gap-3 sm:grid-cols-2">{unitInput('Provider name', settings.offerwall.provider, (value) => update((draft) => { draft.offerwall.provider = value }))}{unitInput('Application ID', settings.offerwall.appId, (value) => update((draft) => { draft.offerwall.appId = value }))}{unitInput('Embed URL template (must include {userId})', settings.offerwall.embedUrl, (value) => update((draft) => { draft.offerwall.embedUrl = value }))}{unitInput('Postback secret (leave blank to keep current)', postbackSecret, setPostbackSecret)}{unitInput('Reward share percent', String(settings.offerwall.rewardShare), (value) => update((draft) => { draft.offerwall.rewardShare = Number(value) }))}{unitInput('Hold days', String(settings.offerwall.holdDays), (value) => update((draft) => { draft.offerwall.holdDays = Number(value) }))}{unitInput('FX rate', String(settings.offerwall.fxRate), (value) => update((draft) => { draft.offerwall.fxRate = Number(value) }))}</div><div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" onClick={copyPostback}>Copy /api/postbacks/adgem</Button><Button type="button" variant="outline" onClick={testPostback} disabled={testing}>{testing ? 'Sending…' : 'Test postback'}</Button><span className="text-xs text-muted-foreground">{networks?.postbackSecretConfigured ? 'A postback secret is configured.' : 'No postback secret is configured.'}</span></div>{postbackResult && <p role="status" className="text-sm text-muted-foreground">{postbackResult}</p>}</section>}

    {tab === 'reporting' && <section className="rounded-xl border border-border/70 bg-card p-5"><h2 className="font-display text-lg font-bold">Ad revenue entries</h2><p className="mt-2 text-sm text-muted-foreground">Revenue tracking arrives with the treasury update.</p></section>}
  </div>
}

function NetworkCard({ title, active, onToggle, children }: { title: string; active: boolean; onToggle: (active: boolean) => void; children: React.ReactNode }) {
  return <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5"><div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">{title}</h2><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => onToggle(event.target.checked)} /> Active</label></div><Badge variant={active ? 'secondary' : 'outline'}>{active ? 'Configured' : 'Disabled'}</Badge>{children}</section>
}
function CreativeField({ label, value, active, onValue, onActive }: { label: string; value: string; active: boolean; onValue: (value: string) => void; onActive: (active: boolean) => void }) {
  return <div className="flex flex-col gap-2 rounded-lg border border-border/70 p-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => onActive(event.target.checked)} />Active</label><label className="flex flex-col gap-1 text-xs text-muted-foreground">{label}<textarea value={value} onChange={(event) => onValue(event.target.value)} rows={2} className="rounded-lg border border-border bg-background p-3 text-sm text-foreground" /></label></div>
}
function UrlField({ label, value, active, onValue, onActive }: { label: string; value: string; active: boolean; onValue: (value: string) => void; onActive: (active: boolean) => void }) {
  return <div className="flex flex-col gap-2 rounded-lg border border-border/70 p-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => onActive(event.target.checked)} />Active</label><label className="flex flex-col gap-1 text-xs text-muted-foreground">{label}<input value={value} onChange={(event) => onValue(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label></div>
}
