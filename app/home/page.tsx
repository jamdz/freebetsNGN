import { HomeDashboard } from '@/components/freebet/prediction-workspace'
import { AdManager } from '@/components/ads/AdSlot'

export default function HomePage() {
  return <><HomeDashboard /><div className="mt-8"><AdManager placement="home-inline" size="728x90" /></div></>
}
