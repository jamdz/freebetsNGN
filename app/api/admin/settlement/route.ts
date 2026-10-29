import { NextResponse } from 'next/server'
import { requireAdminApi, serverError } from '@/lib/admin-api'
import { buildPagination, parsePagination } from '@/lib/admin-pagination'
import { getLagosDateRange, parseLagosYearMonth } from '@/lib/admin-date-filters'

const tabs = ['awaiting', 'settled', 'void'] as const
type Tab = typeof tabs[number]

export async function GET(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const url = new URL(request.url)
  const tab = tabs.includes(url.searchParams.get('tab') as Tab) ? url.searchParams.get('tab') as Tab : 'awaiting'
  const { year, month } = parseLagosYearMonth(url.searchParams)
  const gameweekId = url.searchParams.get('gameweek_id') || null
  const competitionId = url.searchParams.get('competition_id') || null
  const pagination = parsePagination(url.searchParams, { defaultSize: 10, allowed: [10, 25, 50] })
  let start: string | null = null; let end: string | null = null
  if (gameweekId) {
    const { data, error } = await auth.supabase.from('gameweeks').select('starts_at,ends_at').eq('id', gameweekId).maybeSingle()
    if (error) { console.error('[admin] settlement gameweek filter', error); return serverError() }
    if (!data) return NextResponse.json({ fixtures: [], counts: { awaiting: 0, settled: 0, void: 0 }, pagination: buildPagination(pagination.page, pagination.pageSize, 0) })
    start = data.starts_at; end = data.ends_at
  } else if (year) {
    const range = getLagosDateRange(year, month ?? undefined)
    start = range.start
    end = range.end
  }
  const applyFilters = (query: any) => {
    if (start) query = query.gte('kickoff_at', start)
    if (end) query = query.lt('kickoff_at', end)
    if (competitionId) query = query.eq('competition_id', competitionId)
    return query
  }
  const applyTab = (query: any, selected: Tab) => selected === 'awaiting' ? query.in('status', ['scheduled', 'live']).lte('kickoff_at', new Date().toISOString()).order('kickoff_at', { ascending: true }) : selected === 'settled' ? query.eq('status', 'finished').order('settled_at', { ascending: false }) : query.eq('status', 'void').order('kickoff_at', { ascending: false })
  const select = 'id,kickoff_at,status,home_goals,away_goals,settled_at,competition_id,competitions(name),home:teams!fixtures_home_team_id_fkey(name),away:teams!fixtures_away_team_id_fkey(name)'
  const listQuery = applyTab(applyFilters(auth.supabase.from('fixtures').select(select, { count: 'exact' }).range(pagination.from, pagination.to)), tab)
  const countQueries = tabs.map((selected) => applyTab(applyFilters(auth.supabase.from('fixtures').select('id', { count: 'exact', head: true })), selected))
  const [{ data, error, count }, awaiting, settled, voided] = await Promise.all([listQuery, ...countQueries])
  if (error || awaiting.error || settled.error || voided.error) { const failure = error ?? awaiting.error ?? settled.error ?? voided.error; console.error('[admin] settlement list', failure); return serverError() }
  const rows = data ?? []; const ids = rows.map((row: any) => row.id)
  const statsResult = ids.length ? await auth.supabase.rpc('admin_fixture_prediction_stats', { p_fixture_ids: ids }) : { data: [], error: null }
  if (statsResult.error) { console.error('[admin] settlement prediction stats', statsResult.error); return serverError() }
  const stats = new Map<string, any>((statsResult.data ?? []).map((row: any) => [row.fixture_id, row]))
  return NextResponse.json({ fixtures: rows.map((row: any) => { const stat = stats.get(row.id) ?? {}; return { id: row.id, kickoff_at: row.kickoff_at, status: row.status, home_goals: row.home_goals, away_goals: row.away_goals, settled_at: row.settled_at, competition_name: row.competitions?.name ?? row.competitions?.[0]?.name ?? 'Unknown competition', home_name: row.home?.name ?? row.home?.[0]?.name ?? 'Home', away_name: row.away?.name ?? row.away?.[0]?.name ?? 'Away', prediction_count: Number(stat.prediction_count ?? 0), exact_count: Number(stat.exact_count ?? 0), correct_count: Number(stat.correct_count ?? 0), wrong_count: Number(stat.wrong_count ?? 0), total_points: Number(stat.total_points ?? 0) } }), counts: { awaiting: awaiting.count ?? 0, settled: settled.count ?? 0, void: voided.count ?? 0 }, pagination: buildPagination(pagination.page, pagination.pageSize, count ?? 0) })
}
