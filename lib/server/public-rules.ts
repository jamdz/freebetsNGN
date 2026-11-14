import 'server-only'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

type NumericValue = number | null

export type PublicPrizeTier = { rank: number; naira: number }
export type PublicQualificationRules = {
  minActiveDays: NumericValue
  minPredictionsPerActiveDay: NumericValue
  minFixturesForDayToCount: NumericValue
  withdrawalRequiresQualification: boolean | null
}
export type PublicRules = {
  prizeTiers: PublicPrizeTier[]
  points: {
    correctOutcome: NumericValue
    exactScoreBonus: NumericValue
    boosterMultiplier: NumericValue
  }
  minimumPredictions: NumericValue
  streakDays: NumericValue
  qualificationRules: PublicQualificationRules | null
  withdrawalMinimums: { minAirtimeNaira: NumericValue; minCashNaira: NumericValue }
}

const numericValue = (value: unknown): NumericValue => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const emptyRules: PublicRules = {
  prizeTiers: [],
  points: { correctOutcome: null, exactScoreBonus: null, boosterMultiplier: null },
  minimumPredictions: null,
  streakDays: null,
  qualificationRules: null,
  withdrawalMinimums: { minAirtimeNaira: null, minCashNaira: null },
}

const readPublicRules = unstable_cache(async (): Promise<PublicRules> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return emptyRules

  const { data, error } = await createAdminClient()
    .from('app_config')
    .select('prize_tiers,points,minimum_predictions,streak_days,qualification_rules,withdrawal_rules')
    .eq('id', true)
    .maybeSingle()

  if (error) {
    console.error('[public-rules] unable to load app_config', { message: error.message, code: error.code })
    return emptyRules
  }
  if (!data) return emptyRules

  const points = data.points && typeof data.points === 'object' ? data.points as Record<string, unknown> : {}
  const qualification = data.qualification_rules && typeof data.qualification_rules === 'object'
    ? data.qualification_rules as Record<string, unknown>
    : null
  const withdrawal = data.withdrawal_rules && typeof data.withdrawal_rules === 'object'
    ? data.withdrawal_rules as Record<string, unknown>
    : {}
  const prizeTiers = Array.isArray(data.prize_tiers)
    ? data.prize_tiers.flatMap((tier: unknown) => {
        if (!tier || typeof tier !== 'object') return []
        const row = tier as Record<string, unknown>
        const rank = numericValue(row.rank)
        const naira = numericValue(row.naira ?? row.prizeNaira)
        return rank !== null && naira !== null && rank > 0 && naira >= 0 ? [{ rank, naira }] : []
      }).sort((a, b) => a.rank - b.rank)
    : []

  return {
    prizeTiers,
    points: {
      correctOutcome: numericValue(points.correctOutcome),
      exactScoreBonus: numericValue(points.exactScoreBonus),
      boosterMultiplier: numericValue(points.boosterMultiplier),
    },
    minimumPredictions: numericValue(data.minimum_predictions),
    streakDays: numericValue(data.streak_days),
    qualificationRules: qualification ? {
      minActiveDays: numericValue(qualification.minActiveDays),
      minPredictionsPerActiveDay: numericValue(qualification.minPredictionsPerActiveDay),
      minFixturesForDayToCount: numericValue(qualification.minFixturesForDayToCount),
      withdrawalRequiresQualification: typeof qualification.withdrawalRequiresQualification === 'boolean' ? qualification.withdrawalRequiresQualification : null,
    } : null,
    withdrawalMinimums: {
      minAirtimeNaira: numericValue(withdrawal.minAirtimeNaira),
      minCashNaira: numericValue(withdrawal.minCashNaira),
    },
  }
}, ['public-rules'], { revalidate: 300, tags: ['public-rules'] })

export const getPublicRules = readPublicRules
