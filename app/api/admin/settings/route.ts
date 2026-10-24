import { NextResponse } from 'next/server'
import { requireAdminApi, writeAudit } from '@/lib/admin-api'

export async function GET() {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const { data, error } = await auth.supabase.from('app_config').select('config').eq('id', 1).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data?.config ?? null })
}

export async function PUT(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid settings payload' }, { status: 400 })
  const { data, error } = await auth.supabase.from('app_config').upsert({ id: 1, config: body }, { onConflict: 'id' }).select('config').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await writeAudit(auth.supabase, 'save_settings', 'app_config', '1')
  return NextResponse.json({ settings: data.config })
}
