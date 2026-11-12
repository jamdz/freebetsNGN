import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ADMIN_COOKIE, verifyReauthPassword } from '@/lib/admin-auth'
import { requireAdminApi, serviceClient } from '@/lib/admin-api'

const schema = z.object({ admin_password: z.string().min(1) })
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Re-authentication required' }, { status: 403 })
  const { getAdminEmail } = await import('@/lib/admin-auth')
  const email = getAdminEmail((await cookies()).get(ADMIN_COOKIE)?.value)
  if (!email || !(await verifyReauthPassword(email, parsed.data.admin_password))) return NextResponse.json({ error: 'Re-authentication required' }, { status: 403 })
  const { id } = await params
  const { error } = await serviceClient().from('admin_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', id).is('revoked_at', null)
  if (error) return NextResponse.json({ error: 'Unable to revoke session' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
