import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ADMIN_COOKIE, isNonProductionAdminEnv, revokeAdminSession } from '@/lib/admin-auth'
export async function POST(request: Request) {
  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value
  await revokeAdminSession(cookie)
  const response = NextResponse.json({ ok: true })
  const nonProductionAdminEnv = isNonProductionAdminEnv(request)
  response.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: nonProductionAdminEnv ? 'none' : 'strict',
    ...(nonProductionAdminEnv ? { partitioned: true } : {}),
    path: '/',
    maxAge: 0,
  })
  return response
}
