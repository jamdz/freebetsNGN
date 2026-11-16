'use client'

import useSWR from 'swr'
import { useSiteBrand } from '@/components/site-brand'
import { useEffect, useState } from 'react'

const consentEvent = 'freebet:ads-consent'

export function useAdConsent() {
  const [consent, setConsent] = useState<boolean | null | undefined>(undefined)
  useEffect(() => {
    const read = () => setConsent(document.cookie.includes('freebet_ads_consent=accepted') ? true : document.cookie.includes('freebet_ads_consent=declined') ? false : null)
    read()
    window.addEventListener(consentEvent, read)
    return () => window.removeEventListener(consentEvent, read)
  }, [])
  const set = (value: boolean) => {
    const hostname = window.location.hostname.toLowerCase()
    let configuredProductionHost = ''
    try {
      if (process.env.NEXT_PUBLIC_SITE_URL) {
        configuredProductionHost = new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname.toLowerCase()
      }
    } catch {}
    const previewHost = hostname !== configuredProductionHost && (
      hostname.endsWith('.vercel.app') || hostname.endsWith('.v0.dev') ||
      hostname.endsWith('.v0.app') || hostname.endsWith('.vusercontent.net')
    )
    const previewCookieAttributes = previewHost ? '; SameSite=None; Secure; Partitioned' : '; SameSite=Lax'
    document.cookie = `freebet_ads_consent=${value ? 'accepted' : 'declined'}; Max-Age=31536000; Path=/${previewCookieAttributes}`
    setConsent(value)
    window.dispatchEvent(new Event(consentEvent))
  }
  return { consent, accept: () => set(true), decline: () => set(false) }
}

export function AdConsentBanner() {
  const { consent, accept, decline } = useAdConsent()
  const { siteName } = useSiteBrand()
  if (consent !== null) return null
  return <aside className="pointer-events-auto fixed inset-x-4 bottom-20 z-[60] mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-2xl md:bottom-4 md:flex-row md:items-center md:justify-between" role="dialog" aria-label="Advertising consent"><p className="text-sm text-muted-foreground">We use optional advertising cookies to support {siteName}. Ads are never connected to points or credits.</p><div className="flex shrink-0 gap-2"><button type="button" className="rounded-lg px-3 py-2 text-sm text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={decline}>Decline</button><button type="button" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={accept}>Accept</button></div></aside>
}

type SmartlinkResponse = { smartlink?: { href: string } | null }
const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Unable to load sponsored link')
  return response.json() as Promise<SmartlinkResponse>
}

export function SmartlinkCard({ placement }: { placement: 'prediction' | 'earn' }) {
  const { consent } = useAdConsent()
  const { data } = useSWR<SmartlinkResponse>(consent === true ? '/api/ads/config?page=Earn&surface=smartlink' : null, fetcher)
  const href = data?.smartlink?.href
  if (!consent || !href) return null
  return <a href={href} target="_blank" rel="noreferrer sponsored" className="block rounded-xl border border-border bg-card p-4 text-sm"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sponsored</span><span className="mt-1 block font-semibold">{placement === 'prediction' ? 'Explore this optional offer' : 'View this optional offer'}</span></a>
}
