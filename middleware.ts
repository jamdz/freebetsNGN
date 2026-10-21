import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

const publicRoutes = ['/', '/login', '/signup', '/verify', '/forgot-password', '/terms', '/privacy', '/prize-rules', '/responsible-play']

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const configuredPath = process.env.ADMIN_PATH?.trim() || 'ops-x7k2p'
  const adminPath = `/${configuredPath.replace(/^\/+|\/+$/g, '')}`
  if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/console-internal' || pathname.startsWith('/console-internal/')) return new NextResponse('Not Found', { status: 404 })
  if (pathname.toLowerCase().startsWith(adminPath.toLowerCase())) {
    const target = pathname.slice(adminPath.length) || '/'
    const rewrite = request.nextUrl.clone()
    rewrite.pathname = `/console-internal${target}`
    return NextResponse.rewrite(rewrite)
  }
  const response = await updateSession(request)
  if (pathname.startsWith('/api/')) return response
  const isPublic = publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  if (isPublic) return response
  const { createServerClient } = await import('@supabase/ssr')
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => request.cookies.getAll(), setAll() {} } })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))
  return response
}

export const config = { matcher: ['/((?!_next|favicon.ico).*)'] }
