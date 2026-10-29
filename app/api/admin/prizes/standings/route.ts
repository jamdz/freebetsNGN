import { requireAdminApi, serverError } from '@/lib/admin-api'
import { buildPagination, parsePagination } from '@/lib/admin-pagination'

export async function GET(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const params = new URL(request.url).searchParams
  const gameweekId = params.get('gameweek_id')
  if (!gameweekId) return Response.json({ error: 'gameweek_id is required' }, { status: 400 })
  const pagination = parsePagination(params)
  const logFailure = (name: string, result: { error: any }) => { if (result.error) console.error('[admin] standings query failed', { query: name, message: result.error.message, code: result.error.code, details: result.error.details }) }
  const gameweekResult = await auth.supabase.from('gameweeks').select('id,starts_at,ends_at,prize_status,qualification_waived').eq('id', gameweekId).maybeSingle()
  logFailure('gameweek', gameweekResult)
  if (gameweekResult.error) return serverError()
  const gameweek = gameweekResult.data
  if (!gameweek) return Response.json({ error: 'Gameweek not found' }, { status: 404 })
  const [configResult, eligibleResult, leaderboardResult, fixturesResult, qualificationResult] = await Promise.all([
    auth.supabase.from('app_config').select('weekly_budget_naira,prizes_paused,minimum_predictions,prize_tiers').eq('id', true).single(),
    auth.supabase.rpc('weekly_payout_candidates', { p_gameweek_id: gameweekId }),
    auth.supabase.from('weekly_leaderboard').select('user_id,nickname,points,exact_scores,correct_results,predictions_count,qualified,first_prediction_at', { count: 'exact' }).eq('gameweek_id', gameweekId).order('points', { ascending: false }).order('exact_scores', { ascending: false }).order('correct_results', { ascending: false }).order('first_prediction_at', { ascending: true }).range(pagination.from, pagination.to),
    auth.supabase.from('fixtures').select('id,status').gte('kickoff_at', gameweek.starts_at).lte('kickoff_at', gameweek.ends_at).in('status', ['scheduled', 'live']),
    auth.supabase.from('weekly_qualification').select('computed_at').eq('gameweek_id', gameweekId).order('computed_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const results = [['config', configResult], ['payout_candidates', eligibleResult], ['leaderboard', leaderboardResult], ['fixtures', fixturesResult], ['qualification', qualificationResult]] as const
  const failed = results.find(([, result]) => result.error)
  results.forEach(([name, result]) => logFailure(name, result))
  if (failed) return serverError()
  const config = configResult.data ?? { weekly_budget_naira: 0, prizes_paused: false, minimum_predictions: 0, prize_tiers: [] }
  const eligible = eligibleResult.data ?? []
  const candidateIds = new Set(eligible.map((row: any) => row.user_id))
  const participants = (leaderboardResult.data ?? []).map((row: any, index: number) => ({ ...row, rank: pagination.from + index + 1, eligible: candidateIds.has(row.user_id), reason: candidateIds.has(row.user_id) ? null : !row.qualified && !gameweek.qualification_waived ? 'Not qualified' : Number(row.predictions_count ?? 0) < Number(config.minimum_predictions ?? 0) ? 'Below minimum predictions' : Number(row.points ?? 0) <= 0 ? 'No points' : 'Not eligible' }))
  const projectedTotal = eligible.reduce((sum: number, row: any) => sum + Number(row.amount_naira ?? 0), 0)
  const unsettledFixtures = fixturesResult.data?.length ?? 0
  const paid = gameweek.prize_status === 'paid'; const paused = Boolean(config.prizes_paused); const overBudget = projectedTotal > Number(config.weekly_budget_naira ?? 0)
  const blockers: string[] = []; if (new Date(gameweek.ends_at) >= new Date()) blockers.push('Week has not ended'); if (unsettledFixtures) blockers.push(`${unsettledFixtures} fixture${unsettledFixtures === 1 ? '' : 's'} still unsettled`); if (paid) blockers.push('Already paid'); if (paused) blockers.push('Prizes are paused'); if (overBudget) blockers.push('Over budget')
  return Response.json({ gameweek, config, eligible, participants, pagination: buildPagination(pagination.page, pagination.pageSize, leaderboardResult.count ?? 0), state: { ended: new Date(gameweek.ends_at) < new Date(), unsettled_fixtures: unsettledFixtures, paid, paused, projected_total: projectedTotal, over_budget: overBudget, qualification_refreshed_at: qualificationResult.data?.computed_at ?? null, blockers } })
}
