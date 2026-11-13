import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const requestedNext = url.searchParams.get('next')
  const hasUnsafeNext = !requestedNext
    || !requestedNext.startsWith('/')
    || requestedNext.startsWith('//')
    || requestedNext.includes('//')
    || requestedNext.includes('\\')
    || /^[a-z][a-z\d+.-]*:/i.test(requestedNext)
  const nextUrl = hasUnsafeNext ? new URL('/verify?step=phone', url.origin) : new URL(requestedNext, url.origin)
  const next = nextUrl.origin === url.origin ? nextUrl : new URL('/verify?step=phone', url.origin)

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(next)
}
