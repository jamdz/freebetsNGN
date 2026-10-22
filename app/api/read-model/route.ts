import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const resource = searchParams.get('resource') ?? 'home'
  const now = new Date().toISOString()
  const { data: gameweek, error: gameweekError } = await supabase.from('gameweeks').select('id, starts_at, ends_at, prize_status, qualification_waived').lte('starts_at', now).gte('ends_at', now).maybeSingle()
  if (gameweekError) return NextResponse.json({ error: 'Unable to load the current gameweek' }, { status: 500 })

  if (resource === 'home' || resource === 'fixtures') {
    const fixturesQuery = supabase.from('fixtures').select('id, competition_id, home_team_id, away_team_id, kickoff_at, status, home_goals, away_goals, competitions(id, name, country), home_team:teams!fixtures_home_team_id_fkey(id, name), away_team:teams!fixtures_away_team_id_fkey(id, name)').order('kickoff_at').limit(100)
    const predictionsQuery = gameweek ? supabase.from('predictions').select('fixture_id, outcome, home_goals, away_goals, booster, points_awarded, result').eq('user_id', user.id).eq('gameweek_id', gameweek.id) : Promise.resolve({ data: [], error: null })
    const [fixturesResult, predictionsResult] = await Promise.all([fixturesQuery, predictionsQuery])
    if (fixturesResult.error || predictionsResult.error) return NextResponse.json({ error: 'Unable to load fixtures' }, { status: 500 })
    if (resource === 'fixtures') return NextResponse.json({ gameweek, fixtures: fixturesResult.data ?? [], predictions: predictionsResult.data ?? [] })

    const [profileResult, activityResult, qualificationResult, leaderboardResult] = await Promise.all([
      supabase.from('profiles').select('nickname, streak_count').eq('id', user.id).maybeSingle(),
      gameweek ? supabase.from('daily_activity').select('activity_date, logged_in, predictions_count').eq('user_id', user.id).gte('activity_date', gameweek.starts_at.slice(0, 10)).lte('activity_date', gameweek.ends_at.slice(0, 10)).order('activity_date') : Promise.resolve({ data: [], error: null }),
      gameweek ? supabase.from('weekly_qualification').select('active_days, qualified').eq('user_id', user.id).eq('gameweek_id', gameweek.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      gameweek ? supabase.from('weekly_leaderboard').select('user_id, points, predictions_count').eq('gameweek_id', gameweek.id).order('points', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    ])
    const failed = [profileResult, activityResult, qualificationResult, leaderboardResult].find((result) => result.error)
    if (failed) return NextResponse.json({ error: 'Unable to load home data' }, { status: 500 })
    const leaderboard = leaderboardResult.data ?? []
    const current = leaderboard.findIndex((row) => row.user_id === user.id)
    const predictions = predictionsResult.data ?? []
    return NextResponse.json({ gameweek, fixtures: fixturesResult.data ?? [], predictions, profile: profileResult.data, activity: activityResult.data ?? [], qualification: qualificationResult.data, weekly: { points: leaderboard.find((row) => row.user_id === user.id)?.points ?? 0, rank: current < 0 ? null : current + 1, predictions: predictions.length, boostersLeft: Math.max(0, 3 - predictions.filter((prediction) => prediction.booster).length) } })
  }

  if (resource === 'predictions') {
    const gameweekId = searchParams.get('gameweek') ?? gameweek?.id
    const predictionsQuery = supabase.from('predictions').select('id, fixture_id, outcome, home_goals, away_goals, booster, points_awarded, result, created_at, fixtures(id, kickoff_at, status, home_goals, away_goals, competitions(name), home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name))').eq('user_id', user.id).order('created_at', { ascending: false })
    const scopedQuery = gameweekId ? predictionsQuery.eq('gameweek_id', gameweekId) : predictionsQuery
    const { data, error } = await scopedQuery
    if (error) return NextResponse.json({ error: 'Unable to load predictions' }, { status: 500 })
    return NextResponse.json({ gameweek, predictions: data ?? [] })
  }

  return NextResponse.json({ error: 'Unsupported read model' }, { status: 400 })
}
