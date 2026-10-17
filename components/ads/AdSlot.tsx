'use client'

import { useEffect, useRef, useState } from 'react'

export type AdPlacement = 'home-inline' | 'fixtures-inline' | 'leaderboard-inline' | 'sidebar'
export type AdSize = '320x100' | '300x250' | '728x90'

export function useAdConsent() {
  const [consent, setConsent] = useState<boolean | null>(null)
  useEffect(() => setConsent(document.cookie.includes('freebet_ads_consent=accepted')), [])
  const accept = () => { document.cookie = 'freebet_ads_consent=accepted; Max-Age=31536000; Path=/; SameSite=Lax'; setConsent(true) }
  const decline = () => { document.cookie = 'freebet_ads_consent=declined; Max-Age=31536000; Path=/; SameSite=Lax'; setConsent(false) }
  return { consent, accept, decline }
}

export function AdConsentBanner() {
  const { consent, accept, decline } = useAdConsent()
  if (consent !== null) return null
  return <aside className="fixed inset-x-4 bottom-20 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-2xl md:bottom-4 md:flex-row md:items-center md:justify-between" role="dialog" aria-label="Advertising consent"><p className="text-sm text-muted-foreground">We use optional advertising cookies to support FreeBetNGN. Ads are never connected to your points or credits.</p><div className="flex shrink-0 gap-2"><button className="rounded-lg px-3 py-2 text-sm text-muted-foreground" onClick={decline}>Decline</button><button className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" onClick={accept}>Accept</button></div></aside>
}

export function AdSlot({ placement, size }: { placement: AdPlacement; size: AdSize }) {
  const { consent } = useAdConsent()
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const unit = process.env.NEXT_PUBLIC_AADS_UNIT_ID
  useEffect(() => { const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setNear(true); observer.disconnect() } }, { rootMargin: '200px' }); if (ref.current) observer.observe(ref.current); return () => observer.disconnect() }, [])
  const [width, height] = size.split('x').map(Number)
  return <div ref={ref} data-placement={placement} className="mx-auto flex w-full max-w-3xl flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card/40 px-3 py-3" style={{ minHeight: height + 42 }}><div className="flex w-full items-center gap-3"><span className="h-px flex-1 bg-border/70" /><span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Advertisement</span><span className="h-px flex-1 bg-border/70" /></div>{consent && near && unit ? <iframe title="Advertisement" src={`https://a-ads.com/${unit}`} width={width} height={height} loading="lazy" className="max-w-full rounded-xl border-0" sandbox="allow-scripts allow-same-origin" /> : <div aria-hidden="true" className="flex w-full max-w-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/60 px-4 text-center text-xs text-muted-foreground" style={{ width: `min(${width}px, 100%)`, height }}>{consent === false ? 'Advertising is disabled' : 'Ad space reserved'}</div>}</div>
}
