import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api'

type QueryResult = { data: any; count?: number | null; error: { message: string; code?: string } | null }

export async function GET() {
  const auth = await requireAdminApi()
  if (auth.response) return auth.response
  const db = auth.supabase
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date())
  const errors: Record<string, string> = {}
  const metric = async (name: string, query: PromiseLike<QueryResult>) => {
    const result = await query
    if (result.error) { errors[name] = result.error.message; console.error('[admin] overview metric failed', { metric: name, message: result.error.message, code: result.error.code }); return null }
    return result
  }
  const [users, activity, fixtures, config, gameweek, recentActivity] = await Promise.all([
    metric('total_users', db.from('profiles').select('id', { count: 'exact', head: true })),
    metric('daily_activity', db.from('daily_activity').select('activity_date,logged_in,predictions_count').eq('activity_date', today)),
    metric('fixtures_awaiting_results', db.from('fixtures').select('id', { count: 'exact', head: true }).in('status', ['scheduled', 'live']).lt('kickoff_at', new Date().toISOString())),
    metric('weekly_prize_pool', db.from('app_config').select('weekly_budget_naira').eq('id', true).maybeSingle()),
    metric('current_gameweek', db.from('gameweeks').select('id,starts_at,ends_at,prize_status').lte('starts_at', new Date().toISOString()).gte('ends_at', new Date().toISOString()).order('starts_at', { ascending: false }).limit(1).maybeSingle()),
    metric('recent_activity', db.from('audit_log').select('id,created_at,action,entity,entity_id,details->>admin_email').order('created_at', { ascending: false }).limit(5)),
  ])
  const rows = activity?.data ?? []
  return NextResponse.json({ total_users: users?.count ?? null, active_today: activity ? rows.filter((row: any) => row.logged_in).length : null, predictions_today: activity ? rows.reduce((sum: number, row: any) => sum + Number(row.predictions_count ?? 0), 0) : null, fixtures_awaiting_results: fixtures?.count ?? null, weekly_prize_pool: config ? Number(config.data?.weekly_budget_naira ?? 0) : null, current_gameweek: gameweek?.data ?? null, recent_activity: recentActivity?.data ?? null, errors })
}
