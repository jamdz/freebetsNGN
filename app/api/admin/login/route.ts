import { NextResponse } from 'next/server'
import { ADMIN_COOKIE, adminCookieOptions, adminPath, createAdminSession, isAdminConfigured, verifyAdminCredentials } from '@/lib/admin-auth'
import { decryptTotpSecret, isAdminLoginLocked, recordAdminLoginFailure } from '@/lib/admin-security'
import { verify } from 'otplib'

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  const body = await request.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const code = typeof body.code === 'string' ? body.code : ''
  const isPreview = process.env.NODE_ENV !== 'production'
  if (!isPreview) {
    try { if (await isAdminLoginLocked(email, ip)) return NextResponse.json({ error: 'Too many login attempts. Try again later.' }, { status: 429 }) }
    catch { return NextResponse.json({ error: 'Admin login is temporarily unavailable' }, { status: 503 }) }
  }
  if (!isAdminConfigured()) return NextResponse.json({ error: 'Admin login is not configured' }, { status: 503 })
  let credentials
  try { credentials = await verifyAdminCredentials(email, password) }
  catch { return NextResponse.json({ error: 'Admin login is temporarily unavailable' }, { status: 503 }) }
  let valid = credentials.valid
  if (valid && credentials.admin?.totp_secret_ciphertext) {
    try {
      const result = await verify({ secret: decryptTotpSecret(credentials.admin.totp_secret_ciphertext), token: code, digits: 6, period: 30, epochTolerance: 30 })
      valid = result.valid
    } catch { valid = false }
  }
  if (!valid) {
    try { await recordAdminLoginFailure(email, ip) }
    catch { return NextResponse.json({ error: 'Admin login is temporarily unavailable' }, { status: 503 }) }
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }
  let cookie: string
  try { cookie = await createAdminSession(credentials.email, request) }
  catch { return NextResponse.json({ error: 'Admin login is temporarily unavailable' }, { status: 503 }) }
  const response = NextResponse.json({ ok: true, path: adminPath(), requiresTotp: false })
  response.cookies.set(ADMIN_COOKIE, cookie, adminCookieOptions)
  return response
}
