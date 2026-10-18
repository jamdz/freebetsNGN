import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const adminPath = process.env.ADMIN_PATH
  if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/console-internal' || pathname.startsWith('/console-internal/')) return new NextResponse('Not Found', { status: 404 })
  if (!adminPath || !pathname.startsWith(adminPath)) return NextResponse.next()
  const target = pathname.slice(adminPath.length) || '/'
  const rewrite = request.nextUrl.clone()
  rewrite.pathname = `/console-internal${target}`
  return NextResponse.rewrite(rewrite)
}

export const config = { matcher: ['/((?!_next|api|favicon.ico).*)'] }
