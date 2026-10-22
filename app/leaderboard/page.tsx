import { RealLeaderboardPage } from '@/components/freebet/real-leaderboard-page'
import { AdManager } from '@/components/ads/AdSlot'

export default function Page() {
  return <><RealLeaderboardPage /><div className="mt-8"><AdManager placement="leaderboard-inline" size="728x90" /></div></>
}
