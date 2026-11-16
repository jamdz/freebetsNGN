import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ADMIN_COOKIE, revokeAdminSession } from '@/lib/admin-auth'
export async function POST() {
  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value
  await revokeAdminSession(cookie)
  const response = NextResponse.json({ ok: true })
  const previewEnvironment = process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview'
  response.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: previewEnvironment ? 'none' : 'strict',
    ...(previewEnvironment ? { partitioned: true } : {}),
    path: '/',
    maxAge: 0,
  })
  return response
}
