import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const configuredPath = process.env.ADMIN_PATH?.trim() || 'ops-x7k2p'
  const adminPath = `/${configuredPath.replace(/^\/+|\/+$/g, '')}`
  if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/console-internal' || pathname.startsWith('/console-internal/')) return new NextResponse('Not Found', { status: 404 })
  if (!pathname.toLowerCase().startsWith(adminPath.toLowerCase())) return NextResponse.next()
  const target = pathname.slice(adminPath.length) || '/'
  const rewrite = request.nextUrl.clone()
  rewrite.pathname = `/console-internal${target}`
  return NextResponse.rewrite(rewrite)
}

export const config = { matcher: ['/((?!_next|api|favicon.ico).*)'] }
