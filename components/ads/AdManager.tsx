'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { adPageFromPath, type AdNetwork, type AdPage, type AdPosition, type AdSize } from '@/lib/ad-settings'
import { useAdConsent } from '@/components/ads/AdSlot'

type SlotConfig = { position: AdPosition; network: AdNetwork; size: AdSize; index: number }
type AdConfig = { page: AdPage | null; consent: boolean; enabled: boolean; previewMode: boolean; slots: SlotConfig[]; globalScripts?: { socialBar: string; popunder: string; popunderFrequencyMinutes: number; popunderPages: AdPage[] } }
const fetcher = async (url: string): Promise<AdConfig> => {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Unable to load ads')
  return response.json()
}
const sizes: Record<AdSize, { width: number; height: number }> = { '320x100': { width: 320, height: 100 }, '300x250': { width: 300, height: 250 }, '728x90': { width: 728, height: 90 }, native: { width: 0, height: 0 } }

function AdFrame({ slot, pathname, page, previewMode }: { slot: SlotConfig; pathname: string; page: AdPage; previewMode: boolean }) {
  const dimensions = sizes[slot.size]
  return <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-border/60 bg-card/40 px-3 py-3" style={{ minHeight: slot.size === 'native' ? 102 : dimensions.height + 42 }} aria-label="Advertisement placement">
    <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Advertisement</span>
    {previewMode
      ? <div aria-hidden="true" className="flex w-full max-w-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/60 px-4 text-center text-xs text-muted-foreground" style={{ height: dimensions.height }}>{`Preview mode · ${slot.network} · ${slot.size}`}</div>
      : <iframe key={pathname} data-page={page} data-slot={slot.index} title="Advertisement" src={`/ad-frame?page=${encodeURIComponent(page)}&slot=${slot.index}`} width={slot.size === 'native' ? undefined : dimensions.width} height={slot.size === 'native' ? 60 : dimensions.height} style={slot.size === 'native' ? { width: '100%', height: 60 } : undefined} loading="lazy" className="max-w-full rounded-xl border-0" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" />}
  </div>
}

function EmptyAdPlacement() {
  return <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-border/60 bg-card/40 px-3 py-3" style={{ minHeight: 132 }} aria-label="Advertisement placement"><span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Advertisement</span><div aria-hidden="true" className="flex w-full max-w-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/60 px-4 text-center text-xs text-muted-foreground" style={{ height: 90 }}>Ad space unavailable</div></div>
}

export function AdManager({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const page = useMemo(() => adPageFromPath(pathname), [pathname])
  const { consent } = useAdConsent()
  const [modalOpen, setModalOpen] = useState(false)
  useEffect(() => {
    const resizeNativeAd = (event: MessageEvent) => {
      const message = event.data
      if (!message || message.type !== 'freebet-ad-height' || typeof message.page !== 'string' || typeof message.slot !== 'string' || typeof message.height !== 'number') return
      const frame = Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe[data-page][data-slot]')).find((item) => item.contentWindow === event.source && item.dataset.page === message.page && item.dataset.slot === message.slot)
      if (frame) frame.style.height = `${Math.max(60, Math.min(600, message.height))}px`
    }
    window.addEventListener('message', resizeNativeAd)
    return () => window.removeEventListener('message', resizeNativeAd)
  }, [])
  useEffect(() => {
    const update = () => setModalOpen(Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')))
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-modal', 'role'] })
    return () => observer.disconnect()
  }, [pathname])
  const surface = modalOpen ? 'prediction-dialog' : undefined
  const key = consent === true && page ? `/api/ads/config?page=${page}${surface ? `&surface=${surface}` : ''}` : null
  const { data } = useSWR<AdConfig>(key, fetcher, { revalidateOnFocus: false })
  const slots = data?.slots ?? []
  const grouped = (position: AdPosition) => slots.filter((slot) => slot.position === position)
  const socialBar = data?.globalScripts?.socialBar
  const popunderUrl = data?.globalScripts?.popunder
  const [popunderAllowed, setPopunderAllowed] = useState(false)

  useEffect(() => {
    setPopunderAllowed(false)
    if (!consent || modalOpen || !page || !popunderUrl || !data?.globalScripts) return
    try {
      const key = 'freebet_popunder_last_shown'
      const lastShown = Number(window.sessionStorage.getItem(key) ?? 0)
      const capMs = data.globalScripts.popunderFrequencyMinutes * 60_000
      if (!lastShown || Date.now() - lastShown >= capMs) {
        window.sessionStorage.setItem(key, String(Date.now()))
        setPopunderAllowed(true)
      }
    } catch { setPopunderAllowed(false) }
  }, [consent, data, modalOpen, page, popunderUrl])

  useEffect(() => {
    if (!page || consent !== true || modalOpen || data?.previewMode) return
    const loadOnce = (src: string | undefined, name: string, allowed: boolean) => {
      if (!src || !allowed) return
      const key = `freebet_ad_script_${name}`
      if (window.sessionStorage.getItem(key)) return
      window.sessionStorage.setItem(key, '1')
      const script = document.createElement('script')
      script.src = src
      script.async = true
      document.body.append(script)
    }
    loadOnce(socialBar, 'social_bar', Boolean(data?.enabled))
    loadOnce(popunderUrl, 'popunder', popunderAllowed)
  }, [consent, data?.enabled, data?.previewMode, modalOpen, page, popunderAllowed, popunderUrl, socialBar])

  if (!page || consent !== true) return <>{children}</>
  return <section className="w-full">
    {data?.consent && data.enabled && grouped('top').map((slot, index) => <AdFrame key={`${pathname}-top-${index}`} slot={slot} pathname={pathname} page={page} previewMode={Boolean(data.previewMode)} />)}
    <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <main className="min-h-[calc(100vh-4rem)] min-w-0 px-4 pb-24 pt-5 md:pb-8">{children}</main>
      {data?.consent && data.enabled && grouped('sidebar').length > 0 && <aside className="hidden flex-col gap-4 pt-5 lg:flex" aria-label="Sponsored content">{grouped('sidebar').map((slot, index) => <AdFrame key={`${pathname}-sidebar-${index}`} slot={slot} pathname={pathname} page={page} previewMode={Boolean(data.previewMode)} />)}</aside>}
    </div>
    {data?.consent && data.enabled && grouped('inline').map((slot, index) => <AdFrame key={`${pathname}-inline-${index}`} slot={slot} pathname={pathname} page={page} previewMode={Boolean(data.previewMode)} />)}
    {data?.consent && data.enabled && grouped('bottom').map((slot, index) => <AdFrame key={`${pathname}-bottom-${index}`} slot={slot} pathname={pathname} page={page} previewMode={Boolean(data.previewMode)} />)}
    {data?.consent && !modalOpen && slots.length === 0 && <EmptyAdPlacement />}
  </section>
}
