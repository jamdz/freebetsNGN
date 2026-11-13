import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimit, type RateLimitPolicy } from '@/lib/server/rate-limit'
import { updateSession } from '@/lib/supabase/proxy'

const publicRoutes = ['/', '/login', '/signup', '/verify', '/auth/callback', '/forgot-password', '/reset-password', '/ad-verification', '/terms', '/privacy', '/prize-rules', '/responsible-play']
const publicApiRoutes = ['/api/admin/login', '/api/admin/logout', '/api/admin/session', '/api/auth/status', '/api/auth/resolve-identifier', '/api/ads/config', '/api/offers/config']

function rateLimitPolicy(pathname: string, method: string): RateLimitPolicy | null {
  if (pathname === '/api/admin/login') return { scope: 'admin-login', limit: 5, windowSeconds: 900 }
  if (pathname === '/api/predictions') return { scope: 'predictions', limit: 30, windowSeconds: 60 }
  if (pathname === '/api/withdrawals') return method === 'POST'
    ? { scope: 'withdrawals-write', limit: 5, windowSeconds: 60 }
    : { scope: 'withdrawals-read', limit: 60, windowSeconds: 60 }
  if (pathname === '/api/spin') return method === 'POST'
    ? { scope: 'spin-write', limit: 5, windowSeconds: 60 }
    : { scope: 'spin-read', limit: 60, windowSeconds: 60 }
  if (pathname === '/api/visit') return { scope: 'visit', limit: 20, windowSeconds: 60 }
  if (pathname === '/api/bank-account' || pathname.startsWith('/api/bank-account/')) return { scope: 'bank-account', limit: 10, windowSeconds: 3600 }
  if (pathname.startsWith('/api/verification/')) return { scope: 'phone-verification', limit: 5, windowSeconds: 3600 }
  if (pathname.startsWith('/api/auth/')) return { scope: 'auth', limit: 15, windowSeconds: 900 }
  if (pathname.startsWith('/api/postbacks/')) return { scope: 'offerwall-postback', limit: 120, windowSeconds: 60 }
  return null
}

async function inactiveAccountResponse(userId: string) {
  try {
    const { data, error } = await createAdminClient().from('profiles').select('status').eq('id', userId).maybeSingle()
    if (error) return NextResponse.json({ error: 'Account status could not be verified' }, { status: 503 })
    if (data?.status !== 'active') return NextResponse.json({ error: 'This account is unavailable.' }, { status: 403 })
    return null
  } catch {
    return NextResponse.json({ error: 'Account status could not be verified' }, { status: 503 })
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const configuredPath = process.env.ADMIN_PATH?.trim()
  const adminPath = configuredPath ? `/${configuredPath.replace(/^\/+|\/+$/g, '')}` : null
  if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/console-internal' || pathname.startsWith('/console-internal/')) return new NextResponse('Not Found', { status: 404 })
  if (adminPath && pathname.toLowerCase().startsWith(adminPath.toLowerCase())) {
    const target = pathname.slice(adminPath.length) || '/'
    const rewrite = request.nextUrl.clone()
    rewrite.pathname = `/console-internal${target}`
    return NextResponse.rewrite(rewrite)
  }
  if (pathname === '/ad-frame') return NextResponse.next()

  const { response, user } = await updateSession(request)
  if (pathname.startsWith('/api/')) {
    const needsAccountCheck = user && !pathname.startsWith('/api/admin/') && !pathname.startsWith('/api/cron/') && !pathname.startsWith('/api/postbacks/') && !pathname.startsWith('/api/webhooks/') && !publicApiRoutes.includes(pathname)
    if (needsAccountCheck) {
      const blocked = await inactiveAccountResponse(user.id)
      if (blocked) return blocked
    }
    const policy = rateLimitPolicy(pathname, request.method)
    if (policy) {
      const limited = await enforceRateLimit(request, policy, user?.id)
      if (limited) return limited
    }
    return response
  }

  const isPublic = publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  if (isPublic) return response
  if (!user) return NextResponse.redirect(new URL('/login', request.url))
  const blocked = await inactiveAccountResponse(user.id)
  if (blocked) return blocked
  return response
}

export const config = { matcher: ['/((?!_next|favicon.ico).*)'] }
