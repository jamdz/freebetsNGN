import { badRequest, requireAdminApi, serverError, writeAudit } from '@/lib/admin-api'

export async function POST(request: Request) {
  const auth = await requireAdminApi(); if ('response' in auth) return auth.response
  try { const body = await request.json(); if (!body.competition_id || !body.home_team_id || !body.away_team_id || !body.kickoff_at) return badRequest('competition_id, home_team_id, away_team_id and kickoff_at are required')
    const { data, error } = await auth.supabase.from('fixtures').insert({ competition_id: body.competition_id, home_team_id: body.home_team_id, away_team_id: body.away_team_id, kickoff_at: body.kickoff_at, external_id: body.external_id ?? null }).select('id').single(); if (error) throw error
    await writeAudit(auth.supabase, 'create_fixture', 'fixture', data.id, body); return Response.json({ fixture: data }, { status: 201 })
  } catch (error) { console.error('[admin] create fixture', error); return serverError() }
}

export async function GET() { const auth = await requireAdminApi(); if ('response' in auth) return auth.response; const { data, error } = await auth.supabase.from('fixtures').select('id,competition_id,home_team_id,away_team_id,kickoff_at,status,home_goals,away_goals,settled_at,external_id').order('kickoff_at'); if (error) return serverError(); return Response.json({ fixtures: data ?? [] }) }
