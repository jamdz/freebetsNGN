import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({ identifier: z.string().trim().min(1).max(120) })

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid login details' }, { status: 400 })

  const identifier = parsed.data.identifier.toLowerCase()
  const admin = createAdminClient()
  const query = admin.from('profiles').select('email,status,deactivated_at').or(`email.ilike.${identifier},nickname.ilike.${identifier},phone.eq.${parsed.data.identifier}`).maybeSingle()
  const { data, error } = await query
  if (error || !data?.email) return NextResponse.json({ error: 'Invalid login details' }, { status: 401 })
  return NextResponse.json({ email: data.email, status: data.status, deactivatedAt: data.deactivated_at })
}
