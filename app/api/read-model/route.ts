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
    const { data, error } = await supabase.from('fixtures').select('id, competition_id, home_team_id, away_team_id, kickoff_at, status, home_goals, away_goals, competitions(name, country), home_team:teams!fixtures_home_team_id_fkey(id, name), away_team:teams!fixtures_away_team_id_fkey(id, name)').gte('kickoff_at', now).order('kickoff_at').limit(100)
    if (error) return NextResponse.json({ error: 'Unable to load fixtures' }, { status: 500 })
    return NextResponse.json({ gameweek, fixtures: data ?? [] })
  }

  if (resource === 'predictions') {
    const { data, error } = await supabase.from('predictions').select('fixture_id, outcome, home_goals, away_goals, booster, points_awarded, result, created_at, fixtures(id, kickoff_at, status, home_goals, away_goals, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name))').eq('user_id', user.id).order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: 'Unable to load predictions' }, { status: 500 })
    return NextResponse.json({ gameweek, predictions: data ?? [] })
  }

  if (resource === 'leaderboard') {
    const range = searchParams.get('range') ?? 'weekly'
    let query = supabase.from('weekly_leaderboard').select('user_id, nickname, gameweek_id, points, exact_scores, correct_results, first_prediction_at, predictions_count, qualified').order('points', { ascending: false }).limit(100)
    if (range === 'weekly' && gameweek) query = query.eq('gameweek_id', gameweek.id)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Unable to load leaderboard' }, { status: 500 })
    return NextResponse.json({ leaderboard: data ?? [] })
  }

  if (resource === 'leagues') {
    const { data, error } = await supabase.from('league_members').select('league_id, joined_at, leagues(id, name, invite_code, owner_id, created_at)').eq('user_id', user.id)
    if (error) return NextResponse.json({ error: 'Unable to load leagues' }, { status: 500 })
    return NextResponse.json({ leagues: data ?? [] })
  }

  if (resource === 'profile') {
    const [profile, activity, qualification, predictions, prizes] = await Promise.all([
      supabase.from('profiles').select('id, nickname, email, phone, phone_verified, email_verified, referral_code, streak_count, last_visit_date, created_at').eq('id', user.id).maybeSingle(),
      supabase.from('daily_activity').select('activity_date, logged_in, predictions_count').eq('user_id', user.id).order('activity_date', { ascending: false }).limit(35),
      supabase.from('weekly_qualification').select('gameweek_id, active_days, qualified, computed_at, gameweeks(starts_at, ends_at)').eq('user_id', user.id).order('computed_at', { ascending: false }).limit(12),
      supabase.from('predictions').select('points_awarded, result, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('prize_awards').select('rank, amount_naira, gameweek_id, gameweeks(starts_at, ends_at)').eq('user_id', user.id).order('gameweek_id', { ascending: false }),
    ])
    const failed = [profile, activity, qualification, predictions, prizes].find((result) => result.error)
    if (failed) return NextResponse.json({ error: 'Unable to load profile data' }, { status: 500 })
    return NextResponse.json({ profile: profile.data, activity: activity.data ?? [], qualification: qualification.data ?? [], predictions: predictions.data ?? [], prizes: prizes.data ?? [] })
  }

  return NextResponse.json({ error: 'Unknown read model' }, { status: 400 })
}
