import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { generateSecret, generateURI } from 'otplib'
import { ADMIN_COOKIE, getAdminEmail, verifyReauthPassword } from '@/lib/admin-auth'
import { encryptTotpSecret, securityDb } from '@/lib/admin-security'
import { requireAdminApi } from '@/lib/admin-api'
import { getSiteSettings } from '@/lib/server/site-content'

export async function POST(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => ({}))
  const email = getAdminEmail((await cookies()).get(ADMIN_COOKIE)?.value)
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (typeof body.admin_password !== 'string' || !(await verifyReauthPassword(email, body.admin_password))) return NextResponse.json({ error: 'Re-authentication required' }, { status: 403 })
  const { data: admin, error: selectError } = await securityDb().from('admin_users').select('id').eq('email', email).eq('is_active', true).maybeSingle()
  if (selectError || !admin) return NextResponse.json({ error: 'Two-factor enrollment requires an active admin account' }, { status: 400 })
  const secret = generateSecret({ length: 20 })
  const { siteName } = await getSiteSettings()
  const otpauthUrl = generateURI({ issuer: siteName, label: email, secret, digits: 6, period: 30 })
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: 'M', margin: 1, width: 256 })
  const { error } = await securityDb().from('admin_users').update({ pending_totp_secret_ciphertext: encryptTotpSecret(secret) }).eq('id', admin.id)
  if (error) return NextResponse.json({ error: 'Unable to save two-factor setup' }, { status: 500 })
  return NextResponse.json({ otpauthUrl, qrCodeDataUrl })
}
