'use client'

import { Gift, ShieldCheck } from 'lucide-react'
import { OFFER_HOLD_DAYS } from '@/lib/config'

type RewardProvider = { id: string; type: 'offerwall'; isEnabled: () => boolean; getEmbedUrl: (userId: string) => string }

export const MockOfferwallProvider: RewardProvider = {
  id: 'mock-offerwall', type: 'offerwall', isEnabled: () => true,
  getEmbedUrl: (userId) => `https://example.com/offerwall?user=${encodeURIComponent(userId)}`,
}

export function OfferwallFrame({ provider = MockOfferwallProvider, userId }: { provider?: RewardProvider; userId: string }) {
  return <div className="overflow-hidden rounded-2xl border border-border bg-card"><div className="flex items-center justify-between border-b border-border px-4 py-3"><div className="flex items-center gap-2"><Gift className="size-4 text-primary" /><span className="text-sm font-semibold">Available offers</span></div><span className="text-xs text-muted-foreground">Offer availability varies.</span></div>{provider.isEnabled() ? <iframe title="Reward offers" src={provider.getEmbedUrl(userId)} className="h-56 w-full bg-muted" sandbox="allow-scripts allow-forms" /> : <div className="flex h-56 items-center justify-center p-6 text-center text-sm text-muted-foreground">Offers are temporarily unavailable. Check back soon.</div>}<div className="flex items-center gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground"><ShieldCheck className="size-3.5 text-emerald-400" />Rewards are credited after {OFFER_HOLD_DAYS} days when the provider confirms completion.</div></div>
}

export type { RewardProvider }
// TODO: credits are issued ONLY by the provider server-side postback, never by the client.
