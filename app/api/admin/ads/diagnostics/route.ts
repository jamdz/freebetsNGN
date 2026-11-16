import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api'
import { AD_PAGES, safeCreative, readAdSettings } from '@/lib/server/ads'
import { isAadsUnitId, parseAdSnippet } from '@/lib/server/ad-snippets'

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
    const slots = AD_PAGES.flatMap((slotPage) => settings.placements[slotPage].slots.map((slot, index) => {
      const placementEnabled = settings.placements[slotPage].enabled
      const network = slot.network === 'A-ADS' ? settings.networks.aads : settings.networks.adsterra
      const networkActive = network.active
      const sizeActive = slot.network === 'A-ADS'
        ? settings.networks.aads.unitActive[slot.size]
        : slot.size === 'native' ? settings.networks.adsterra.nativeActive : settings.networks.adsterra.bannerActive[slot.size]
      const creative = slot.network === 'A-ADS' ? settings.networks.aads.units[slot.size] : slot.size === 'native' ? settings.networks.adsterra.native : settings.networks.adsterra.banner[slot.size]
      const creativeValid = slot.network === 'A-ADS' && isAadsUnitId(creative) || parseAdSnippet(creative).ok
      const ready = placementEnabled && networkActive && sizeActive && creativeValid
      const reason = !placementEnabled ? 'Placement is disabled.'
        : !networkActive ? `${slot.network} is disabled.`
          : !sizeActive ? `${slot.size} format is disabled.`
            : !creative.trim() ? 'No creative is saved.'
              : !creativeValid ? 'Saved creative failed snippet validation.'
                : settings.previewMode ? 'Ready; visitors will see the preview placeholder.' : 'Ready for visitor delivery.'
      return [{ page: slotPage, index, position: slot.position, network: slot.network, size: slot.size, ready, reason, previewMode: settings.previewMode }]
    }))
    return NextResponse.json({ page, checks, adcashChecks, slots, visitorsMustAcceptCookieBanner: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to inspect smartlink settings' }, { status: 500 })
  }
}
