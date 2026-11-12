import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ADMIN_COOKIE, getAdminTokenHash, verifyReauthPassword } from '@/lib/admin-auth'
import { requireAdminApi, serviceClient } from '@/lib/admin-api'

const schema = z.object({ admin_password: z.string().min(1) })
export async function POST(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Re-authentication required' }, { status: 403 })
  const { getAdminEmail } = await import('@/lib/admin-auth')
  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value
  const email = getAdminEmail(cookie)
  if (!email || !(await verifyReauthPassword(email, parsed.data.admin_password))) return NextResponse.json({ error: 'Re-authentication required' }, { status: 403 })
  const currentTokenHash = getAdminTokenHash(cookie)
  let query = serviceClient().from('admin_sessions').update({ revoked_at: new Date().toISOString() }).is('revoked_at', null)
  if (currentTokenHash) query = query.neq('token_hash', currentTokenHash)
  const { error } = await query
  if (error) return NextResponse.json({ error: 'Unable to revoke other sessions' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
