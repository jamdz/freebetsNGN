import { adPageFromPath, type AdPage, type AdSize } from '@/lib/ad-settings'
import { readAdSettings, AD_PAGES } from '@/lib/server/ads'
import { aadsUnitSnippet, isAadsUnitId, parseAdSnippet } from '@/lib/server/ad-snippets'

export const dynamic = 'force-dynamic'

const dimensions: Record<AdSize, { width: number; height: number }> = {
  '320x100': { width: 320, height: 100 },
  '300x250': { width: 300, height: 250 },
  '728x90': { width: 728, height: 90 },
}
const securityHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, max-age=60',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "default-src 'none'; script-src https: 'unsafe-inline'; style-src 'unsafe-inline' https:; img-src https: data:; font-src https: data:; frame-src https:; connect-src https:; media-src https:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
}
const empty = () => new Response(null, { status: 204, headers: securityHeaders })

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const pageParam = params.get('page')
  const slotParam = params.get('slot')
  if (!pageParam || !AD_PAGES.includes(pageParam as AdPage) || !slotParam || !/^\d+$/.test(slotParam)) return empty()

  const referer = request.headers.get('referer')
  if (referer) {
    try {
      const refererPage = adPageFromPath(new URL(referer).pathname)
      if (!refererPage || refererPage !== pageParam) return empty()
    } catch {
      return empty()
    }
  }

  try {
    const settings = await readAdSettings()
    const page = pageParam as AdPage
    const placement = settings.placements[page]
    const index = Number(slotParam)
    const slot = placement?.slots[index]
    if (!placement?.enabled || !slot || !dimensions[slot.size]) return empty()

    let source = ''
    if (slot.network === 'A-ADS') {
      const config = settings.networks.aads
      const stored = config.active && config.unitActive[slot.size] ? config.units[slot.size] : ''
      if (isAadsUnitId(stored)) source = aadsUnitSnippet(stored, dimensions[slot.size])
      else source = stored
    } else {
      const config = settings.networks.adsterra
      source = config.active && config.bannerActive[slot.size] ? config.banner[slot.size] : ''
    }
    if (!source) return empty()

    const parsed = parseAdSnippet(source)
    if (!parsed.ok) return empty()
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="background: transparent; margin: 0; display: flex; align-items: center; justify-content: center; overflow: hidden">${parsed.html}</body></html>`
    return new Response(html, { status: 200, headers: securityHeaders })
  } catch {
    return empty()
  }
}
