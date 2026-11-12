import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ADMIN_COOKIE, revokeAdminSession } from '@/lib/admin-auth'
export async function POST() {
  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value
  await revokeAdminSession(cookie)
  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 0 })
  return response
}
