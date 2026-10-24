import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api'

export async function GET() {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const [{ data: competitions, error: competitionsError }, { data: teams, error: teamsError }] = await Promise.all([
    auth.supabase.from('competitions').select('id,name').order('name'),
    auth.supabase.from('teams').select('id,name,competition_id').order('name'),
  ])
  if (competitionsError || teamsError) return NextResponse.json({ error: competitionsError?.message ?? teamsError?.message ?? 'Unable to load catalog' }, { status: 500 })
  return NextResponse.json({ competitions: competitions ?? [], teams: teams ?? [] })
}
