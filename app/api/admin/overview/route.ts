import { NextResponse } from 'next/server'
import { requireAdminApi, serverError } from '@/lib/admin-api'

export async function GET() {
  const auth = await requireAdminApi()
  if (auth.response) return auth.response
  const db = auth.supabase
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date())
  const [{ count: totalUsers, error: usersError }, { data: activity, error: activityError }, { count: awaiting, error: fixturesError }, { data: config, error: configError }, { data: gameweek, error: gameweekError }] = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('daily_activity').select('active_date,logged_in,predictions_count').eq('active_date', today),
    db.from('fixtures').select('id', { count: 'exact', head: true }).in('status', ['scheduled', 'live']).lt('kickoff_at', new Date().toISOString()),
    db.from('app_config').select('weekly_budget_naira').eq('id', true).maybeSingle(),
    db.from('gameweeks').select('id,starts_at,ends_at,prize_status').lte('starts_at', new Date().toISOString()).gte('ends_at', new Date().toISOString()).order('starts_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (usersError || activityError || fixturesError || configError || gameweekError) return serverError()
  return NextResponse.json({ total_users: totalUsers ?? 0, active_today: (activity ?? []).filter((row) => row.logged_in).length, predictions_today: (activity ?? []).reduce((sum, row) => sum + Number(row.predictions_count ?? 0), 0), fixtures_awaiting_results: awaiting ?? 0, weekly_prize_pool: Number(config?.weekly_budget_naira ?? 0), current_gameweek: gameweek ?? null })
}
