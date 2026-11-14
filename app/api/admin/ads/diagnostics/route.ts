import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api'
import { safeCreative, readAdSettings } from '@/lib/server/ads'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const page = new URL(request.url).searchParams.get('page')
  if (page !== 'Earn') return NextResponse.json({ error: 'Unsupported page' }, { status: 400 })
  try {
    const settings = await readAdSettings()
    const networkActive = settings.networks.adsterra.active
    const smartlinkEnabled = settings.networks.adsterra.smartlinkActive
    const urlValid = safeCreative(settings.networks.adsterra.smartlink)?.kind === 'url'
    const pageAllowed = page === 'Earn'
    const checks = [
      { key: 'networkActive', ok: networkActive, message: networkActive ? 'Adsterra network is active.' : 'Enable the Adsterra network.' },
      { key: 'smartlinkEnabled', ok: smartlinkEnabled, message: smartlinkEnabled ? 'Smartlink switch is on.' : 'Turn on the smartlink switch.' },
      { key: 'urlValid', ok: urlValid, message: urlValid ? 'Smartlink is a valid HTTPS URL.' : 'Enter a valid HTTPS smartlink URL.' },
      { key: 'pageAllowed', ok: pageAllowed, message: 'Smartlink cards are allowed on Earn.' },
    ]
    return NextResponse.json({ page, checks, visitorsMustAcceptCookieBanner: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to inspect smartlink settings' }, { status: 500 })
  }
}
