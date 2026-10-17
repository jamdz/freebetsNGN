import { FixturesBrowser } from '@/components/freebet/prediction-workspace'
import { AdSlot } from '@/components/ads/AdSlot'

export default function FixturesPage() {
  return <><FixturesBrowser /><div className="mt-8"><AdSlot placement="fixtures-inline" size="728x90" /></div></>
}
