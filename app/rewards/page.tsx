import { RewardsWorkspace } from '@/components/freebet/rewards-workspace'
import { getPublicRules } from '@/lib/server/public-rules'
export default async function RewardsPage() { const rules = await getPublicRules(); return <RewardsWorkspace qualificationRules={rules.qualificationRules} /> }
