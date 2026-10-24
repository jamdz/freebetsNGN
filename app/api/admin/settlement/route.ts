import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api'

export async function GET() {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const { data, error } = await auth.supabase.from('fixtures').select('id,status,kickoff_at,home_score,away_score,competition_id,home_team_id,away_team_id,competitions(name),home_team:teams!fixtures_home_team_id_fkey(name),away_team:teams!fixtures_away_team_id_fkey(name),predictions(count)').in('status', ['scheduled','live','finished']).order('kickoff_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fixtures: data ?? [] })
}
