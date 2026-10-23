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

  if (resource === 'leaderboard') {
    const period = searchParams.get('period') ?? 'week'
    const columns = 'user_id, nickname, gameweek_id, points, exact_scores, correct_results, first_prediction_at, predictions_count, qualified'
    let query = supabase.from('weekly_leaderboard').select(columns)

    if (period === 'week') {
      if (!gameweek?.id) return NextResponse.json({ rows: [], currentUserId: user.id, prizeTiers: config.prizeTiers })
      query = query.eq('gameweek_id', gameweek.id)
    } else if (period === 'month') {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
      const year = parts.find((part) => part.type === 'year')?.value
      const month = parts.find((part) => part.type === 'month')?.value
      const monthStart = `${year}-${month}-01T00:00:00+01:00`
      const nextMonth = new Date(`${monthStart}`)
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
      const nextParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit' }).formatToParts(nextMonth)
      const nextMonthStart = `${nextParts.find((part) => part.type === 'year')?.value}-${nextParts.find((part) => part.type === 'month')?.value}-01T00:00:00+01:00`
      const { data: monthGameweeks, error: monthError } = await supabase.from('gameweeks').select('id').gte('starts_at', monthStart).lt('starts_at', nextMonthStart)
      if (monthError) {
        console.error('[leaderboard] gameweek month lookup failed', { message: monthError.message, code: monthError.code, details: monthError.details })
        return failure('Unable to load leaderboard', monthError)
      }
      const ids = (monthGameweeks ?? []).map((row) => row.id)
      if (!ids.length) return NextResponse.json({ rows: [], currentUserId: user.id, prizeTiers: config.prizeTiers })
      query = query.in('gameweek_id', ids)
    }

    const { data: rows, error } = await query
    if (error) {
      console.error('[leaderboard] weekly_leaderboard query failed', { message: error.message, code: error.code, details: error.details })
      return failure('Unable to load leaderboard', error)
    }

    const currentQualified = new Map((rows ?? []).filter((row) => row.gameweek_id === gameweek?.id).map((row) => [row.user_id, Boolean(row.qualified)]))
    const grouped = Object.values((rows ?? []).reduce<Record<string, { user_id: string; nickname: string; points: number; exact_scores: number; correct_results: number; qualified: boolean; first_prediction_at: string | null }>>((acc, row) => {
      const current = acc[row.user_id] ?? { user_id: row.user_id, nickname: row.nickname, points: 0, exact_scores: 0, correct_results: 0, qualified: true, first_prediction_at: null }
      current.points += Number(row.points ?? 0)
      current.exact_scores += Number(row.exact_scores ?? 0)
      current.correct_results += Number(row.correct_results ?? 0)
      current.first_prediction_at = !current.first_prediction_at || (row.first_prediction_at && row.first_prediction_at < current.first_prediction_at) ? row.first_prediction_at : current.first_prediction_at
      if (period === 'week') current.qualified = Boolean(row.qualified)
      acc[row.user_id] = current
      return acc
    }, {})).map((row) => ({ ...row, qualified: period === 'week' ? row.qualified : (currentQualified.get(row.user_id) ?? false) })).sort((a, b) => b.points - a.points || b.exact_scores - a.exact_scores || b.correct_results - a.correct_results || String(a.first_prediction_at ?? '').localeCompare(String(b.first_prediction_at ?? ''))).map((row, index) => ({ nickname: row.nickname, points: row.points, exact_scores: row.exact_scores, correct_results: row.correct_results, qualified: row.qualified, rank: index + 1 }))
    return NextResponse.json({ rows: grouped, currentUserId: user.id, prizeTiers: config.prizeTiers })
  }

  if (resource === 'profile') {
    const [profileResult, pointsResult, prizesResult, qualificationResult] = await Promise.all([
      supabase.from('profiles').select('id,nickname,email,phone,email_verified,phone_verified,referral_code,created_at').eq('id', user.id).maybeSingle(),
      supabase.from('weekly_leaderboard').select('gameweek_id,points,exact_scores,correct_results,predictions_count,qualified,first_prediction_at,gameweeks(starts_at,ends_at)').eq('user_id', user.id),
      supabase.from('prize_awards').select('id,gameweek_id,rank,amount,status,awarded_at,gameweeks(starts_at,ends_at)').eq('user_id', user.id).order('awarded_at', { ascending: false }),
      supabase.from('weekly_qualification').select('gameweek_id,active_days,qualified,gameweeks(starts_at,ends_at)').eq('user_id', user.id).order('gameweek_id', { ascending: false }),
    ])
    const failed = [profileResult, pointsResult, prizesResult, qualificationResult].find((result) => result.error)
    if (failed) return failure('Unable to load profile data', failed.error ?? undefined)
    return NextResponse.json({ profile: profileResult.data, points: pointsResult.data ?? [], prizes: prizesResult.data ?? [], qualification: qualificationResult.data ?? [] })
  }

  return NextResponse.json({ error: 'Unsupported read model' }, { status: 400 })
}
