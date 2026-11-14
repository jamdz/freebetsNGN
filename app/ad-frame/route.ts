import { adPageFromPath, type AdPage, type AdSize } from '@/lib/ad-settings'
import { readAdSettings, AD_PAGES } from '@/lib/server/ads'
import { aadsUnitSnippet, isAadsUnitId, parseAdSnippet } from '@/lib/server/ad-snippets'
import { hasAdminSession } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const dimensions: Record<AdSize, { width: number; height: number }> = {
  '320x100': { width: 320, height: 100 },
  '300x250': { width: 300, height: 250 },
  '728x90': { width: 728, height: 90 },
  native: { width: 0, height: 0 },
}
const securityHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, max-age=60',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "default-src 'none'; script-src https: 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline' https:; img-src https: data:; font-src https: data:; frame-src https:; connect-src https:; media-src https:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
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
      source = !config.active ? '' : slot.size === 'native'
        ? config.nativeActive ? config.native : ''
        : config.bannerActive[slot.size] ? config.banner[slot.size] : ''
    }
    if (!source) return empty()

    const parsed = parseAdSnippet(source)
    if (!parsed.ok) return empty()
    const debug = params.get('debug') === '1' && await hasAdminSession()
    const pageScript = `<script>const page=${JSON.stringify(page)},slot=${JSON.stringify(slotParam)};const sendHeight=()=>parent.postMessage({type:'freebet-ad-height',page,slot,height:document.documentElement.scrollHeight},'*');new ResizeObserver(sendHeight).observe(document.documentElement);addEventListener('load',()=>{sendHeight();${debug ? "report('script finished')" : ''}});${debug ? "const box=document.createElement('pre');box.style='position:fixed;bottom:0;left:0;right:0;max-height:35vh;overflow:auto;margin:0;padding:6px;background:#111;color:#fff;font:11px monospace;z-index:2147483647';document.body.append(box);function report(message){const line=document.createElement('div');line.textContent=message;box.append(line)}addEventListener('error',event=>report('error: '+(event.message||'unknown')+' '+(event.filename||'')));addEventListener('securitypolicyviolation',event=>report('directive: '+event.violatedDirective+'; blocked URL: '+event.blockedURI+'; message: '+event.originalPolicy));" : ''}</script>`
    const isNative = slot.size === 'native'
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="background:transparent;margin:0;${isNative ? '' : 'display:flex;align-items:center;justify-content:center;overflow:hidden;'}">${pageScript}${parsed.html}</body></html>`
    return new Response(html, { status: 200, headers: { ...securityHeaders, 'Cache-Control': 'private, no-store' } })
  } catch {
    return empty()
  }
}
