import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api'

export async function GET() {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const { data, error } = await auth.supabase.from('gameweeks').select('id,label,starts_at,ends_at,prizes_paid,prizes_paused').order('starts_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ gameweeks: data ?? [] })
}
