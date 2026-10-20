import { LeaderboardPage } from '@/components/freebet/social-pages'
import { AdManager } from '@/components/ads/AdSlot'

export default function Page() {
  return <><LeaderboardPage /><div className="mt-8"><AdManager placement="leaderboard-inline" size="728x90" /></div></>
}
