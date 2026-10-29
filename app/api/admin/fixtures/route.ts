import { z } from 'zod'
import { requireAdminApi, serverError, writeAudit } from '@/lib/admin-api'
import { buildPagination, parsePagination } from '@/lib/admin-pagination'
import { getLagosDateRange, parseLagosYearMonth } from '@/lib/admin-date-filters'

const createSchema = z.object({ competition_id: z.string().uuid(), home_team_id: z.string().uuid(), away_team_id: z.string().uuid(), kickoff_at: z.string().datetime() }).strict().refine((v) => v.home_team_id !== v.away_team_id, { message: 'Teams must differ' }).refine((v) => new Date(v.kickoff_at).getTime() > Date.now(), { message: 'Kickoff must be in the future', path: ['kickoff_at'] })

export async function GET(request: Request) {
  const auth = await requireAdminApi(); if ('response' in auth) return auth.response
  const params = new URL(request.url).searchParams
  const { year, month } = parseLagosYearMonth(params)
  const gameweekId = params.get('gameweek_id'); const competitionId = params.get('competition_id'); const status = params.get('status'); const pagination = parsePagination(params, { defaultSize: 10, allowed: [10, 25, 50] })
  let start: string | null = null; let end: string | null = null
  if (gameweekId) { const result = await auth.supabase.from('gameweeks').select('starts_at,ends_at').eq('id', gameweekId).maybeSingle(); if (result.error) { console.error('[admin] fixtures gameweek filter', result.error); return serverError() }; if (!result.data) return Response.json({ fixtures: [], pagination: buildPagination(pagination.page, pagination.pageSize, 0) }); start = result.data.starts_at; end = result.data.ends_at } else if (year) { const range = getLagosDateRange(year, month ?? undefined); start = range.start; end = range.end }
  let query = auth.supabase.from('fixtures').select('id,kickoff_at,status,home_goals,away_goals,settled_at,external_id,competition_id,home_team_id,away_team_id,competitions(name),home:teams!fixtures_home_team_id_fkey(name),away:teams!fixtures_away_team_id_fkey(name),predictions(count)', { count: 'exact' }).order('kickoff_at', { ascending: false }).range(pagination.from, pagination.to)
  if (start) query = query.gte('kickoff_at', start); if (end) query = query.lt('kickoff_at', end); if (gameweekId) { /* date bounds above are authoritative */ }; if (competitionId) query = query.eq('competition_id', competitionId); if (status) query = query.eq('status', status)
  const { data, error, count } = await query
  if (error) { console.error('[admin] fixtures list', { message: error.message, code: error.code }); return serverError() }
  return Response.json({ fixtures: (data ?? []).map((row: any) => ({ ...row, competition_name: row.competitions?.name ?? row.competitions?.[0]?.name ?? null, home_name: row.home?.name ?? row.home?.[0]?.name ?? null, away_name: row.away?.name ?? row.away?.[0]?.name ?? null, prediction_count: row.predictions?.[0]?.count ?? 0 })), pagination: buildPagination(pagination.page, pagination.pageSize, count ?? 0) })
}

export async function POST(request: Request) { const auth = await requireAdminApi(); if ('response' in auth) return auth.response; const parsed = createSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: 'Invalid fixture', issues: parsed.error.issues }, { status: 400 }); const { data: teams } = await auth.supabase.from('teams').select('id,competition_id').in('id', [parsed.data.home_team_id, parsed.data.away_team_id]); if (!teams || teams.length !== 2 || teams.some((team) => team.competition_id !== parsed.data.competition_id)) return Response.json({ error: 'Teams must belong to competition' }, { status: 400 }); const { data, error } = await auth.supabase.from('fixtures').insert(parsed.data).select('id,kickoff_at,status').single(); if (error) { console.error('[admin] fixture create', error); return serverError() } await writeAudit(auth.supabase, 'create_fixture', 'fixture', data.id, parsed.data); return Response.json({ fixture: data }, { status: 201 }) }
