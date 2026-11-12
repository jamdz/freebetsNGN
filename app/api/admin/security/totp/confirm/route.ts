import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verify } from 'otplib'
import { ADMIN_COOKIE, verifyReauthPassword } from '@/lib/admin-auth'
import { currentAdminIdentity, decryptTotpSecret, securityDb } from '@/lib/admin-security'
import { requireAdminApi } from '@/lib/admin-api'

const schema = z.object({ code: z.string().regex(/^\d{6}$/), admin_password: z.string().min(1) })
export async function POST(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid six-digit code and password' }, { status: 400 })
  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value
  const { email } = currentAdminIdentity(cookie)
  if (!(await verifyReauthPassword(email, parsed.data.admin_password))) return NextResponse.json({ error: 'Re-authentication failed' }, { status: 403 })
  const { data: admin, error } = await securityDb().from('admin_users').select('id,pending_totp_secret_ciphertext').eq('email', email).eq('is_active', true).maybeSingle()
  if (error || !admin?.pending_totp_secret_ciphertext) return NextResponse.json({ error: 'Start two-factor setup before confirming it' }, { status: 400 })
  let valid = false
  try { valid = (await verify({ secret: decryptTotpSecret(admin.pending_totp_secret_ciphertext), token: parsed.data.code, digits: 6, period: 30, epochTolerance: 30 })).valid } catch {}
  if (!valid) return NextResponse.json({ error: 'Invalid authenticator code' }, { status: 400 })
  const { error: updateError } = await securityDb().from('admin_users').update({ totp_secret_ciphertext: admin.pending_totp_secret_ciphertext, pending_totp_secret_ciphertext: null }).eq('id', admin.id)
  if (updateError) return NextResponse.json({ error: 'Unable to enable two-factor authentication' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
