import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({ identifier: z.string().trim().min(1).max(120) })

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid login details' }, { status: 400 })

  const identifier = parsed.data.identifier.trim()
  const admin = createAdminClient()
  const selection = 'email,status,deactivated_at'
  const isEmail = identifier.includes('@')
  const isPhone = /^\+?[\d\s()-]+$/.test(identifier)
  const query = isEmail
    ? admin.from('profiles').select(selection).eq('email', identifier.toLowerCase()).maybeSingle()
    : isPhone
      ? admin.from('profiles').select(selection).eq('phone', identifier).maybeSingle()
      : admin.from('profiles').select(selection).ilike('nickname', identifier.replace(/[\\%_]/g, '\\$&')).maybeSingle()
  const { data, error } = await query
  if (error || !data?.email) return NextResponse.json({ error: 'Invalid login details' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json({ email: data.email, status: data.status, deactivatedAt: data.deactivated_at }, { headers: { 'Cache-Control': 'no-store' } })
}
