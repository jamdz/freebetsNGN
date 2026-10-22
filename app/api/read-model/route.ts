import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { lagosDate } from '@/lib/dates'

export const dynamic = 'force-dynamic'

function failure(message: string, error?: { message?: string }, status = 500) {
  if (error) console.error(`[read-model] ${message}:`, error.message ?? error)
  return NextResponse.json({ error: message, ...(process.env.NODE_ENV === 'development' && error?.message ? { detail: error.message } : {}) }, { status })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const resource = searchParams.get('resource') ?? 'home'
  const now = new Date().toISOString()
  const { data: gameweek, error: gameweekError } = await supabase.from('gameweeks').select('id, starts_at, ends_at, prize_status, qualification_waived').lte('starts_at', now).gte('ends_at', now).maybeSingle()
  if (gameweekError) return failure('Unable to load the current gameweek', gameweekError)

  const { data: settings, error: configError } = await supabase.from('app_config').select('points, boosters, streak_days, prize_tiers, minimum_predictions, qualification_rules').eq('id', true).single()
  if (configError) return failure('Unable to load scoring configuration', configError)
  if (!settings) return failure('Settings row missing in app_config')
  const points = (settings.points ?? {}) as Record<string, unknown>
  const boosters = (settings.boosters ?? {}) as Record<string, unknown>
  const config = {
    correctOutcome: Number(points.correctOutcome), exactScoreBonus: Number(points.exactScoreBonus), boosterMultiplier: Number(points.boosterMultiplier),
    boostersPerWeek: Number(boosters.perWeek ?? 1), streakDays: settings.streak_days, prizeTiers: settings.prize_tiers,
    minimumPredictions: settings.minimum_predictions, qualificationRules: settings.qualification_rules,
  }

  if (resource === 'home' || resource === 'fixtures') {
    const fixturesQuery = supabase.from('fixtures').select('id, competition_id, home_team_id, away_team_id, kickoff_at, status, home_goals, away_goals, competitions(id, name, country), home_team:teams!fixtures_home_team_id_fkey(id, name), away_team:teams!fixtures_away_team_id_fkey(id, name)').order('kickoff_at').limit(100)
    const predictionsQuery = gameweek ? supabase.from('predictions').select('fixture_id, outcome, home_goals, away_goals, booster, points_awarded, result').eq('user_id', user.id).eq('gameweek_id', gameweek.id) : Promise.resolve({ data: [], error: null })
    const [fixturesResult, predictionsResult] = await Promise.all([fixturesQuery, predictionsQuery])
    if (fixturesResult.error) return failure('Unable to load fixtures', fixturesResult.error)
    if (predictionsResult.error) return failure('Unable to load predictions', predictionsResult.error)
    if (resource === 'fixtures') return NextResponse.json({ gameweek, config, fixtures: fixturesResult.data ?? [], predictions: predictionsResult.data ?? [] })

    const startDate = gameweek ? lagosDate(new Date(gameweek.starts_at)) : null
    const endDate = gameweek ? lagosDate(new Date(gameweek.ends_at)) : null
    const [profileResult, activityResult, qualificationResult, leaderboardResult] = await Promise.all([
      supabase.from('profiles').select('nickname, streak_count, boosters_bonus').eq('id', user.id).maybeSingle(),
      gameweek && startDate && endDate ? supabase.from('daily_activity').select('activity_date, logged_in, predictions_count').eq('user_id', user.id).gte('activity_date', startDate).lte('activity_date', endDate).order('activity_date') : Promise.resolve({ data: [], error: null }),
      gameweek ? supabase.from('weekly_qualification').select('active_days, qualified').eq('user_id', user.id).eq('gameweek_id', gameweek.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      gameweek ? supabase.from('weekly_leaderboard').select('user_id, points, predictions_count').eq('gameweek_id', gameweek.id).order('points', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    ])
    const failed = [profileResult, activityResult, qualificationResult, leaderboardResult].find((result) => result.error)
    if (failed) return failure('Unable to load home data', failed.error ?? undefined)
    const leaderboard = leaderboardResult.data ?? []
    const current = leaderboard.findIndex((row) => row.user_id === user.id)
    const predictions = predictionsResult.data ?? []
    const boostersUsed = predictions.filter((prediction) => prediction.booster).length
    const boostersLeft = Math.max(0, config.boostersPerWeek + Number(profileResult.data?.boosters_bonus ?? 0) - boostersUsed)
    return NextResponse.json({ gameweek, config, fixtures: fixturesResult.data ?? [], predictions, profile: profileResult.data, activity: activityResult.data ?? [], qualification: qualificationResult.data, weekly: { points: leaderboard.find((row) => row.user_id === user.id)?.points ?? 0, rank: current < 0 ? null : current + 1, predictions: predictions.length, boostersLeft } })
  }

  if (resource === 'predictions') {
    const gameweekId = searchParams.get('gameweek') ?? gameweek?.id
    const predictionsQuery = supabase.from('predictions').select('id, fixture_id, outcome, home_goals, away_goals, booster, points_awarded, result, created_at, fixtures(id, kickoff_at, status, home_goals, away_goals, competitions(name), home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name))').eq('user_id', user.id).order('created_at', { ascending: false })
    const scopedQuery = gameweekId ? predictionsQuery.eq('gameweek_id', gameweekId) : predictionsQuery
    const { data, error } = await scopedQuery
    if (error) return failure('Unable to load predictions', error)
    return NextResponse.json({ gameweek, config, predictions: data ?? [] })
  }

  return NextResponse.json({ error: 'Unsupported read model' }, { status: 400 })
}
