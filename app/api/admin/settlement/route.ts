import { requireAdminApi, serverError } from '@/lib/admin-api'

export async function GET() {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response

  const past = new Date().toISOString()
  const recent = new Date(Date.now() - 14 * 86400000).toISOString()
  const { data, error } = await auth.supabase
    .from('fixtures')
    .select('id,kickoff_at,status,home_goals,away_goals,competitions(name),home:teams!fixtures_home_team_id_fkey(name),away:teams!fixtures_away_team_id_fkey(name),predictions(result,points_awarded)')
    .or(`and(status.in.(scheduled,live),kickoff_at.lte.${past}),and(status.eq.finished,kickoff_at.gte.${recent})`)
    .order('kickoff_at', { ascending: false })

  if (error) {
    console.error('[admin] settlement list', error)
    return serverError()
  }

  return Response.json({
    fixtures: (data ?? []).map((row: any) => ({
      id: row.id,
      kickoff_at: row.kickoff_at,
      status: row.status,
      home_goals: row.home_goals,
      away_goals: row.away_goals,
      competition_name: Array.isArray(row.competitions) ? row.competitions[0]?.name ?? 'Unknown competition' : row.competitions?.name ?? 'Unknown competition',
      home_name: Array.isArray(row.home) ? row.home[0]?.name ?? 'Home' : row.home?.name ?? 'Home',
      away_name: Array.isArray(row.away) ? row.away[0]?.name ?? 'Away' : row.away?.name ?? 'Away',
      prediction_count: row.predictions?.length ?? 0,
      exact: row.predictions?.filter((prediction: any) => prediction.result === 'exact').length ?? 0,
      correct: row.predictions?.filter((prediction: any) => prediction.result === 'correct').length ?? 0,
      wrong: row.predictions?.filter((prediction: any) => prediction.result === 'wrong').length ?? 0,
      total_points: row.predictions?.reduce((sum: number, prediction: any) => sum + Number(prediction.points_awarded ?? 0), 0) ?? 0,
    })),
  })
}
