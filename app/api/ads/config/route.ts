import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { readAdSettings, publicAdConfig, resolvePage } from '@/lib/server/ads'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const surface = params.get('surface') ?? undefined
  const refererPath = (() => { try { return new URL(request.headers.get('referer') ?? '').pathname } catch { return '' } })()
  const smartlinkRefererAllowed = /^\/(?:earn|home|predictions|fixtures)(?:\/|$)/i.test(refererPath)
  const page = surface === 'smartlink' && params.get('page') === 'Earn' && smartlinkRefererAllowed ? 'Earn' : resolvePage(request, params.get('page'))
  const excludedSurface = ['prediction-dialog', 'withdrawal-dialog', 'spin-result-dialog', 'admin', 'auth'].includes(surface ?? '')
  if (!page || excludedSurface) return NextResponse.json({ page: null, consent: false, enabled: false, previewMode: false, slots: [], smartlink: null }, { headers: { 'Cache-Control': 'private, no-store' } })
  const consent = (await cookies()).get('freebet_ads_consent')?.value === 'accepted'
  try {
    const settings = await readAdSettings()
    return NextResponse.json(publicAdConfig(settings, page, consent, surface), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ page, consent, enabled: false, previewMode: false, slots: [], smartlink: null }, { headers: { 'Cache-Control': 'private, no-store' } })
  }
}
