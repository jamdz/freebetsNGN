import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
import { getPublicRules } from '@/lib/server/public-rules'
import { getSeoPage } from '@/lib/server/site-content'

const money = (amount: number) => `₦${new Intl.NumberFormat('en-NG').format(amount)}`

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoPage('prize-rules')
  return { title: seo?.title ?? 'Prize Rules', description: seo?.description, robots: seo?.noindex ? { index: false, follow: false } : { index: true, follow: true } }
}

export default async function PrizeRulesPage() {
  const rules = await getPublicRules()
  const qualification = rules.qualificationRules
  const hasScoring = rules.points.correctOutcome !== null || rules.points.exactScoreBonus !== null
  const hasQualification = Boolean(qualification && (qualification.minActiveDays !== null || qualification.minPredictionsPerActiveDay !== null || qualification.minFixturesForDayToCount !== null))

  return <LegalPage slug="prize-rules" title="Prize Rules" supplementalContent={<>
    {(rules.minimumPredictions !== null || rules.streakDays !== null || hasScoring || hasQualification) && <section className="flex flex-col gap-3 border-t pt-5">
      <h2 className="font-display text-xl font-bold text-foreground">Current game rules</h2>
      {rules.minimumPredictions !== null && <p>Players need at least {rules.minimumPredictions} predictions to qualify for prizes.</p>}
      {rules.streakDays !== null && <p>A scoring streak is counted over {rules.streakDays} days.</p>}
      {hasScoring && <p>Scoring: {rules.points.correctOutcome !== null ? `${rules.points.correctOutcome} points for a correct result` : ''}{rules.points.correctOutcome !== null && rules.points.exactScoreBonus !== null ? '; ' : ''}{rules.points.exactScoreBonus !== null ? `${rules.points.exactScoreBonus} bonus points for an exact score` : ''}{rules.points.boosterMultiplier !== null ? `; booster multiplier ${rules.points.boosterMultiplier}×` : ''}.</p>}
      {hasQualification && <div><h3 className="font-semibold text-foreground">Weekly qualification</h3><ul className="list-disc pl-5">{qualification?.minActiveDays !== null && qualification?.minActiveDays !== undefined && <li>{qualification.minActiveDays} active days required.</li>}{qualification?.minPredictionsPerActiveDay !== null && qualification?.minPredictionsPerActiveDay !== undefined && <li>{qualification.minPredictionsPerActiveDay} predictions per active day.</li>}{qualification?.minFixturesForDayToCount !== null && qualification?.minFixturesForDayToCount !== undefined && <li>At least {qualification.minFixturesForDayToCount} fixtures must be available for a day to count.</li>}{qualification?.withdrawalRequiresQualification !== null && qualification?.withdrawalRequiresQualification !== undefined && <li>Withdrawal qualification is {qualification.withdrawalRequiresQualification ? 'required' : 'not required'}.</li>}</ul></div>}
    </section>}
    {rules.prizeTiers.length > 0 && <section className="flex flex-col gap-3 border-t pt-5"><h2 className="font-display text-xl font-bold text-foreground">Published prize tiers</h2><ul className="list-disc pl-5">{rules.prizeTiers.map((tier) => <li key={tier.rank}>Rank {tier.rank}: {money(tier.naira)}</li>)}</ul></section>}
  </>}><p>FreeBetNGN prizes are free promotional rewards. No purchase, deposit, or stake is required.</p><h2>Qualification</h2><p>Players must meet the published prediction and account requirements for the relevant gameweek.</p><h2>Responsible promotion</h2><p>Prizes are subject to verification, eligibility, and the published terms.</p></LegalPage>
}
