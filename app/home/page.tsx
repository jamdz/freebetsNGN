import { HomeDashboard } from '@/components/freebet/prediction-workspace'
import { AdSlot } from '@/components/ads/AdSlot'

export default function HomePage() {
  return <><HomeDashboard /><div className="mt-8"><AdSlot placement="home-inline" size="728x90" /></div></>
}
