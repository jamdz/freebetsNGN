import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ADMIN_COOKIE, getAdminTokenHash, verifyReauthPassword } from '@/lib/admin-auth'
import { securityDb } from '@/lib/admin-security'
import { requireAdminApi } from '@/lib/admin-api'

async function reauthenticated(password: unknown) {
  const auth = await requireAdminApi()
  if ('response' in auth) return null
  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value
  const { getAdminEmail } = await import('@/lib/admin-auth')
  const adminEmail = getAdminEmail(cookie)
  if (typeof password !== 'string' || !adminEmail || !(await verifyReauthPassword(adminEmail, password))) return null
  return { adminEmail, tokenHash: getAdminTokenHash(cookie) }
}

export async function GET(request: Request) {
  const identity = await reauthenticated(request.headers.get('x-admin-password'))
  if (!identity) return NextResponse.json({ error: 'Re-authentication required' }, { status: 403 })
  const params = new URL(request.url).searchParams
  const page = Math.max(1, Number(params.get('page')) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(params.get('pageSize')) || 10))
  const { data, count, error } = await securityDb().from('admin_sessions').select('id,token_hash,ip,user_agent,created_at,last_seen_at,revoked_at', { count: 'exact' }).order('last_seen_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1)
  if (error) return NextResponse.json({ error: 'Unable to load sessions' }, { status: 500 })
  return NextResponse.json({ sessions: (data ?? []).map(({ token_hash, ...item }) => ({ ...item, current: token_hash === identity.tokenHash })), total: count ?? 0, page, pageSize })
}

const revokeSchema = z.object({ id: z.string().uuid(), admin_password: z.string().min(1) })
export async function POST(request: Request) {
  const parsed = revokeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid session request' }, { status: 400 })
  const identity = await reauthenticated(parsed.data.admin_password)
  if (!identity) return NextResponse.json({ error: 'Re-authentication required' }, { status: 403 })
  const { error } = await securityDb().from('admin_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', parsed.data.id).is('revoked_at', null)
  if (error) return NextResponse.json({ error: 'Unable to revoke session' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
