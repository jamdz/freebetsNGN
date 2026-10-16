'use client'

import { Bell, Gift, Home, ListChecks, Medal, UserRound, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatNaira } from '@/lib/format'
import { APP_NAME, NAV_ITEMS } from '@/lib/config'
import { sampleUser } from '@/lib/mock-data'

const navIcons = { Home, Fixtures: ListChecks, Leaderboard: Medal, Rewards: Gift, Profile: UserRound }

export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background text-foreground"><header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4"><a href="#" className="flex items-center gap-2" aria-label={APP_NAME}><span className="flex size-9 items-center justify-center rounded-xl bg-primary font-display text-lg font-black text-primary-foreground">F</span><span className="font-display text-xl font-bold tracking-tight">FreeBet<span className="text-primary">NGN</span></span></a><div className="flex items-center gap-2"><div className="hidden items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/8 px-3 py-1.5 sm:flex"><WalletCards className="size-4 text-amber-300" /><span className="text-sm font-semibold text-amber-200">{formatNaira(sampleUser.rewardBalanceNaira)}</span></div><Button aria-label="Notifications" variant="ghost" size="icon"><Bell /></Button><button aria-label="Open profile" className="flex size-9 items-center justify-center rounded-full border border-primary/40 bg-primary/15 font-display text-xs font-bold text-primary">{sampleUser.initials}</button></div></div></header><main className="mx-auto min-h-[calc(100vh-4rem)] min-w-0 max-w-6xl px-4 pb-24 pt-5">{children}</main><nav aria-label="Primary navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"><div className="mx-auto flex max-w-md items-center justify-around py-2">{NAV_ITEMS.map((item) => { const Icon = navIcons[item]; return <a key={item} href={`#${item.toLowerCase()}`} className="flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-primary"><Icon className="size-5" /><span>{item}</span></a> })}</div></nav></div>
}
