import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { adPageFromPath, type AdPage, type AdSettings, type AdSize } from '@/lib/ad-settings'

export const AD_PAGES: AdPage[] = ['Home', 'Fixtures', 'Predictions', 'Leaderboard', 'Rewards', 'Earn', 'Referrals', 'Profile', 'Spin']
export const AD_SIZES: AdSize[] = ['320x100', '300x250', '728x90']
const emptyPlacements = () => Object.fromEntries(AD_PAGES.map((page) => [page, { enabled: false, slots: [] }])) as unknown as AdSettings['placements']
const emptySizeValues = () => Object.fromEntries(AD_SIZES.map((size) => [size, ''])) as Record<AdSize, string>
const emptySizeSwitches = () => Object.fromEntries(AD_SIZES.map((size) => [size, false])) as Record<AdSize, boolean>

export function emptyAdSettings(): AdSettings {
  return {
    previewMode: false,
    networks: {
      aads: { active: false, units: emptySizeValues(), unitActive: emptySizeSwitches() },
      adsterra: { active: false, banner: emptySizeValues(), bannerActive: emptySizeSwitches(), native: '', nativeActive: false, socialBar: '', socialBarActive: false, popunder: '', popunderActive: false, smartlink: '', smartlinkActive: false },
    },
    offerwall: { active: false, provider: 'AdGem', appId: '', embedUrl: '', rewardShare: 70, holdDays: 7, fxRate: 1 },
    placements: emptyPlacements(),
    popunder: { enabled: false, frequencyMinutes: 30, pages: ['Earn'] },
  }
}

function record(value: unknown): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {} }
function normalizeSlots(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 5).flatMap((slot) => {
    const item = record(slot)
    if (!['top', 'inline', 'bottom', 'sidebar'].includes(item.position) || !['A-ADS', 'Adsterra'].includes(item.network) || !AD_SIZES.includes(item.size)) return []
    return [{ position: item.position, network: item.network, size: item.size }]
  }) as AdSettings['placements'][AdPage]['slots']
}

export async function readAdSettings() {
  const db = createAdminClient()
  const [networksResult, placementsResult, offerwallResult] = await Promise.all([
    db.from('ad_networks').select('id,enabled,config'),
    db.from('ad_placements').select('page_key,enabled,slots'),
    db.from('integration_settings').select('public_config,is_active').eq('key', 'offerwall_adgem').maybeSingle(),
  ])
  if (networksResult.error) throw networksResult.error
  if (placementsResult.error) throw placementsResult.error
  if (offerwallResult.error) throw offerwallResult.error
  const settings = emptyAdSettings()
  for (const row of networksResult.data ?? []) {
    const config = record(row.config)
    if (row.id === 'aads') settings.networks.aads = { ...settings.networks.aads, ...config, active: Boolean(row.enabled), units: { ...settings.networks.aads.units, ...record(config.units) }, unitActive: { ...settings.networks.aads.unitActive, ...record(config.unitActive) } }
    if (row.id === 'adsterra') {
      settings.networks.adsterra = { ...settings.networks.adsterra, ...config, active: Boolean(row.enabled), banner: { ...settings.networks.adsterra.banner, ...record(config.banner) }, bannerActive: { ...settings.networks.adsterra.bannerActive, ...record(config.bannerActive) } }
      settings.previewMode = Boolean(config.previewMode)
      const popunder = record(config.popunderSettings)
      if (popunder.enabled !== undefined) settings.popunder.enabled = Boolean(popunder.enabled)
      if (Number.isFinite(Number(popunder.frequencyMinutes))) settings.popunder.frequencyMinutes = Math.min(1440, Math.max(1, Number(popunder.frequencyMinutes)))
      if (Array.isArray(popunder.pages)) settings.popunder.pages = popunder.pages.filter((page: unknown): page is AdPage => AD_PAGES.includes(page as AdPage))
    }
  }
  for (const row of placementsResult.data ?? []) {
    if (!AD_PAGES.includes(row.page_key as AdPage)) continue
    settings.placements[row.page_key as AdPage] = { enabled: Boolean(row.enabled), slots: normalizeSlots(row.slots) }
  }
  const offerwall = record(offerwallResult.data?.public_config)
  settings.offerwall = {
    active: Boolean(offerwallResult.data?.is_active),
    provider: typeof offerwall.provider === 'string' ? offerwall.provider : 'AdGem',
    appId: typeof offerwall.appId === 'string' ? offerwall.appId : '',
    embedUrl: typeof offerwall.embedUrlTemplate === 'string' ? offerwall.embedUrlTemplate : '',
    rewardShare: Number.isFinite(Number(offerwall.rewardShare)) ? Math.min(100, Math.max(0, Number(offerwall.rewardShare))) : 70,
    holdDays: Number.isFinite(Number(offerwall.holdDays)) ? Math.min(365, Math.max(0, Number(offerwall.holdDays))) : 7,
    fxRate: Number.isFinite(Number(offerwall.fxRate)) ? Math.max(0, Number(offerwall.fxRate)) : 1,
  }
  return settings
}

export function isHttpsUrl(value: string) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password } catch { return false }
}

export function safeCreative(value: string) {
  const trimmed = value.trim()
  if (isHttpsUrl(trimmed)) return { kind: 'url' as const, src: trimmed }
  const script = trimmed.match(/^<script\s+src=(['"])(https:\/\/[^'"<>]+)\1\s*>\s*<\/script>$/i)
  if (script && isHttpsUrl(script[2])) return { kind: 'script' as const, src: script[2] }
  const iframe = trimmed.match(/^<iframe\s+src=(['"])(https:\/\/[^'"<>]+)\1\s*>\s*<\/iframe>$/i)
  if (iframe && isHttpsUrl(iframe[2])) return { kind: 'iframe' as const, src: iframe[2] }
  return null
}

export function safeScriptUrl(value: string) {
  let candidate = value.trim()
  if (/^<script\b/i.test(candidate)) {
    const tag = candidate.match(/^<script\b([^>]*)>\s*<\/script\s*>$/i)
    const src = tag?.[1].match(/(?:^|\s)src\s*=\s*(["'])(.*?)\1/i)
    if (!src) return ''
    candidate = src[2]
  }
  try {
    const url = new URL(candidate.startsWith('//') ? `https:${candidate}` : candidate)
    return url.protocol === 'https:' && !url.username && !url.password && url.pathname.toLowerCase().endsWith('.js') ? url.toString() : ''
  } catch { return '' }
}

export function resolvePage(request: Request, requestedPage: string | null) {
  if (!requestedPage || !AD_PAGES.includes(requestedPage as AdPage)) return null
  const referer = request.headers.get('referer')
  if (!referer) return null
  try {
    const refererPage = adPageFromPath(new URL(referer).pathname)
    return refererPage === requestedPage ? requestedPage as AdPage : null
  } catch { return null }
}

export function publicAdConfig(settings: AdSettings, page: AdPage, consent: boolean, surface?: string) {
  const isSmartlinkSurface = surface === 'smartlink'
  const smartlinkAllowed = consent && isSmartlinkSurface && settings.networks.adsterra.active && settings.networks.adsterra.smartlinkActive && Boolean(safeCreative(settings.networks.adsterra.smartlink)?.kind === 'url') && page === 'Earn'
  if (!consent) return { page, consent: false, enabled: false, previewMode: false, slots: [], smartlink: null }
  if (isSmartlinkSurface) return { page, consent: true, enabled: false, previewMode: false, slots: [], smartlink: smartlinkAllowed ? { href: safeCreative(settings.networks.adsterra.smartlink)!.src } : null }
  const placement = settings.placements[page]
  const slots = placement?.slots.flatMap((slot, index) => {
    if (!placement.enabled) return []
    return [{ position: slot.position, network: slot.network, size: slot.size, index }]
  }) ?? []
  const adsterra = settings.networks.adsterra
  const socialBar = placement?.enabled && adsterra.active && adsterra.socialBarActive ? safeScriptUrl(adsterra.socialBar) : ''
  const popunder = placement?.enabled && adsterra.active && settings.popunder.enabled && settings.popunder.pages.includes(page) && adsterra.popunderActive ? safeScriptUrl(adsterra.popunder) : ''
  return {
    page, consent: true, enabled: Boolean(placement?.enabled), previewMode: settings.previewMode, slots,
    globalScripts: { socialBar, popunder, popunderFrequencyMinutes: settings.popunder.frequencyMinutes, popunderPages: settings.popunder.pages },
    smartlink: smartlinkAllowed ? { href: safeCreative(adsterra.smartlink)!.src } : null,
  }
}
