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
    const adcash = settings.networks.adcash
    const adcashHostConfigured = (process.env.AD_SCRIPT_HOSTS ?? '').split(',').some((host) => host.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^\*\./, '').replace(/\/+$/, '') === 'acscdn.com')
    const adcashChecks = [
      { key: 'networkActive', ok: adcash.enabled, message: adcash.enabled ? 'Adcash is active.' : 'Turn on the Adcash Active switch.' },
      { key: 'zoneValid', ok: Boolean(adcash.zoneId && /^[A-Za-z0-9]{4,20}$/.test(adcash.zoneId) && adcash.format), message: adcash.zoneId && adcash.format ? `Adcash ${adcash.format} zone ${adcash.zoneId} is configured.` : 'Paste a valid Adcash zone ID or official script blocks.' },
      { key: 'pageAllowed', ok: adcash.allowedPages.includes(page), message: adcash.allowedPages.includes(page) ? `${page} is allowed for Adcash.` : `Add ${page} to Adcash allowed pages.` },
      { key: 'scriptHostConfigured', ok: adcashHostConfigured, message: adcashHostConfigured ? 'acscdn.com is included in AD_SCRIPT_HOSTS.' : 'Add acscdn.com to AD_SCRIPT_HOSTS and redeploy.' },
    ]
    return NextResponse.json({ page, checks, adcashChecks, visitorsMustAcceptCookieBanner: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to inspect smartlink settings' }, { status: 500 })
  }
}
