'use client'

import { useEffect } from 'react'
import useSWR from 'swr'
import { useAdConsent } from '@/components/ads/AdSlot'
import type { AdPage, AdPosition, AdSize } from '@/lib/ad-settings'

type PublicSlot = { position: AdPosition; network: 'A-ADS' | 'Adsterra'; size: AdSize; index: number }
type AdConfig = { consent: boolean; enabled: boolean; previewMode: boolean; slots: PublicSlot[] }
const dimensions: Record<AdSize, { width: number; height: number }> = { '320x100': { width: 320, height: 100 }, '300x250': { width: 300, height: 250 }, '728x90': { width: 728, height: 90 }, native: { width: 0, height: 0 } }
const fetcher = async (url: string): Promise<AdConfig> => {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Unable to load ads')
  return response.json()
}

export function PageAdSlots({ page, position }: { page: AdPage; position: 'top' | 'inline' | 'bottom' }) {
  const { consent } = useAdConsent()
  const { data } = useSWR<AdConfig>(consent === true ? `/api/ads/config?page=${encodeURIComponent(page)}` : null, fetcher, { revalidateOnFocus: false })
  useEffect(() => {
    const resizeNativeAd = (event: MessageEvent) => {
      const message = event.data
      if (!message || message.type !== 'freebet-ad-height' || message.page !== page || typeof message.slot !== 'string' || typeof message.height !== 'number') return
      const frame = Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe[data-page][data-slot]')).find((item) => item.contentWindow === event.source && item.dataset.page === page && item.dataset.slot === message.slot)
      if (frame) frame.style.height = `${Math.max(60, Math.min(600, message.height))}px`
    }
    window.addEventListener('message', resizeNativeAd)
    return () => window.removeEventListener('message', resizeNativeAd)
  }, [page])
  if (consent !== true || !data?.consent || !data.enabled) return null
  const slots = data.slots.filter((slot) => slot.position === position)
  return <div className="flex w-full flex-col gap-3" aria-label="Sponsored content">
    {slots.map((slot) => {
      const size = dimensions[slot.size]
      return <div key={`${page}-${position}-${slot.index}`} className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-border/60 bg-background px-3 py-3" style={{ minHeight: slot.size === 'native' ? 102 : size.height + 42 }} aria-label="Advertisement placement">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white">Advertisement</span>
        {data.previewMode
          ? <div aria-hidden="true" className="flex w-full max-w-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/60 px-4 text-center text-xs text-muted-foreground" style={{ height: size.height }}>{`Preview mode · ${slot.network} · ${slot.size}`}</div>
          : <iframe data-page={page} data-slot={slot.index} title="Advertisement" src={`/ad-frame?page=${encodeURIComponent(page)}&slot=${slot.index}`} width={slot.size === 'native' ? undefined : size.width} height={slot.size === 'native' ? 60 : size.height} style={slot.size === 'native' ? { width: '100%', height: 60 } : undefined} loading="lazy" className="max-w-full rounded-xl border-0 bg-background" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" />}
      </div>
    })}
  </div>
}
