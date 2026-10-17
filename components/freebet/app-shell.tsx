'use client'

import { Bell, Gift, Home, ListChecks, Medal, UserRound, WalletCards } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatNaira } from '@/lib/format'
import { APP_NAME, NAV_ITEMS } from '@/lib/config'
import { sampleUser } from '@/lib/mock-data'
import { AdConsentBanner } from '@/components/ads/AdSlot'

const navIcons = { Home, Fixtures: ListChecks, Leaderboard: Medal, Rewards: Gift, Profile: UserRound }
const navRoutes = { Home: '/home', Fixtures: '/fixtures', Leaderboard: '/leaderboard', Rewards: '/rewards', Profile: '/dashboard' }

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4">
          <Link href="/home" className="flex shrink-0 items-center gap-2" aria-label={APP_NAME}>
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary font-display text-lg font-black text-primary-foreground">F</span>
            <span className="font-display text-xl font-bold tracking-tight">FreeBet<span className="text-primary">NGN</span></span>
          </Link>

          <nav aria-label="Primary navigation" className="hidden min-w-0 flex-1 items-center gap-0 md:flex">
            {NAV_ITEMS.map((item) => {
              const Icon = navIcons[item]
              const href = navRoutes[item]
              const isActive = item === 'Profile' ? pathname === '/dashboard' : pathname === href || (item === 'Home' && pathname === '/')
              return (
                <Link key={item} href={href} aria-current={isActive ? 'page' : undefined} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold transition-colors ${isActive ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                  <Icon className="size-4" />
                  <span className="hidden xl:inline">{item}</span>
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/8 px-3 py-1.5 xl:flex">
              <WalletCards className="size-4 text-amber-300" />
              <span className="text-sm font-semibold text-amber-200">{formatNaira(sampleUser.rewardBalanceNaira)}</span>
            </div>
            <Button aria-label="Notifications" variant="ghost" size="icon"><Bell /></Button>
            <Link href="/dashboard" aria-label="Open profile" className="flex size-9 items-center justify-center rounded-full border border-primary/40 bg-primary/15 font-display text-xs font-bold text-primary">{sampleUser.initials}</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto min-h-[calc(100vh-4rem)] min-w-0 max-w-6xl px-4 pb-24 pt-5 md:pb-8">{children}</main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-border/60 px-4 py-6 pb-24 text-xs text-muted-foreground md:pb-6"><div className="flex flex-wrap gap-x-4 gap-y-2"><Link href="/terms" className="hover:text-foreground">Terms</Link><Link href="/privacy" className="hover:text-foreground">Privacy</Link><Link href="/prize-rules" className="hover:text-foreground">Prize rules</Link><Link href="/responsible-play" className="hover:text-foreground">Responsible play</Link></div><p>18+ only. No stakes involved. Not affiliated with any league, club or broadcaster.</p></footer>\n\n      <nav aria-label="Mobile primary navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = navIcons[item]
            const href = navRoutes[item]
            const isActive = item === 'Profile' ? pathname === '/dashboard' : pathname === href || (item === 'Home' && pathname === '/')
            return <Link key={item} href={href} aria-current={isActive ? 'page' : undefined} className={`flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] transition-colors ${isActive ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-primary'}`}><Icon className="size-5" /><span>{item}</span></Link>
          })}
        </div>
      </nav>
    </div>
  )
}
