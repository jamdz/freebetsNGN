import { FixturesBrowser } from '@/components/freebet/prediction-workspace'
import { AdManager } from '@/components/ads/AdSlot'

export default function FixturesPage() {
  return <><FixturesBrowser /><div className="mt-8"><AdManager placement="fixtures-inline" size="728x90" /></div></>
}
