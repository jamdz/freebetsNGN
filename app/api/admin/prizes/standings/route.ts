import { requireAdminApi, serverError } from '@/lib/admin-api'

export async function GET(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const gameweekId = new URL(request.url).searchParams.get('gameweek_id')
  if (!gameweekId) return Response.json({ error: 'gameweek_id is required' }, { status: 400 })

  const [gameweekResult, configResult, eligibleResult, leaderboardResult, fixturesResult, qualificationResult] = await Promise.all([
    auth.supabase.from('gameweeks').select('id,starts_at,ends_at,prize_status,qualification_waived').eq('id', gameweekId).maybeSingle(),
    auth.supabase.from('app_config').select('weekly_budget_naira,prizes_paused,minimum_predictions,prize_tiers').eq('id', true).single(),
    auth.supabase.rpc('weekly_payout_candidates', { p_gameweek_id: gameweekId }),
    auth.supabase.from('weekly_leaderboard').select('user_id,nickname,points,exact_scores,correct_results,predictions_count,qualified,first_prediction_at').eq('gameweek_id', gameweekId).order('points', { ascending: false }).order('exact_scores', { ascending: false }).order('correct_results', { ascending: false }).order('first_prediction_at', { ascending: true }).limit(50),
    auth.supabase.from('fixtures').select('id,status').eq('gameweek_id', gameweekId).in('status', ['scheduled', 'live']),
    auth.supabase.from('weekly_qualification').select('computed_at').eq('gameweek_id', gameweekId).order('computed_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const failed = [gameweekResult, configResult, eligibleResult, leaderboardResult, fixturesResult, qualificationResult].find((result) => result.error)
  if (failed?.error) return serverError()
  const gameweek = gameweekResult.data
  if (!gameweek) return Response.json({ error: 'Gameweek not found' }, { status: 404 })
  const config = configResult.data ?? { weekly_budget_naira: 0, prizes_paused: false, minimum_predictions: 0, prize_tiers: [] }
  const eligible = eligibleResult.data ?? []
  const candidateIds = new Set(eligible.map((row: any) => row.user_id))
  const participants = (leaderboardResult.data ?? []).map((row: any, index: number) => {
    const eligibleRow = candidateIds.has(row.user_id)
    const reason = eligibleRow ? null : !row.qualified && !gameweek.qualification_waived ? 'Not qualified' : Number(row.predictions_count ?? 0) < Number(config.minimum_predictions ?? 0) ? 'Below minimum predictions' : Number(row.points ?? 0) <= 0 ? 'No points' : 'Not eligible'
    return { ...row, rank: index + 1, eligible: eligibleRow, reason }
  })
  const projectedTotal = eligible.reduce((sum: number, row: any) => sum + Number(row.amount_naira ?? 0), 0)
  const ended = new Date(gameweek.ends_at) < new Date()
  const unsettledFixtures = fixturesResult.data?.length ?? 0
  const paid = gameweek.prize_status === 'paid'
  const paused = Boolean(config.prizes_paused)
  const overBudget = projectedTotal > Number(config.weekly_budget_naira ?? 0)
  const blockers: string[] = []
  if (!ended) blockers.push('Week has not ended')
  if (unsettledFixtures) blockers.push(`${unsettledFixtures} fixture${unsettledFixtures === 1 ? '' : 's'} still unsettled`)
  if (paid) blockers.push('Already paid')
  if (paused) blockers.push('Prizes are paused')
  if (overBudget) blockers.push('Over budget')
  return Response.json({ gameweek, config, eligible, participants, state: { ended, unsettled_fixtures: unsettledFixtures, paid, paused, projected_total: projectedTotal, over_budget: overBudget, qualification_refreshed_at: qualificationResult.data?.computed_at ?? null, blockers } })
}
