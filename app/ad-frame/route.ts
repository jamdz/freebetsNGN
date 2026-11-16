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
  'Content-Security-Policy': "default-src 'none'; script-src https: 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline' https:; img-src https: data:; font-src https: data:; frame-src https:; connect-src https:; media-src https:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; report-uri /api/csp-report",
}
const htmlEntities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => htmlEntities[character])
const empty = (debug: boolean, message = 'No active creative is available for this placement.') => debug
  ? new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:12px;background:#111;color:#fff;font:13px system-ui"><strong>Ad slot check</strong><p>${escapeHtml(message)}</p></body></html>`, { status: 200, headers: { ...securityHeaders, 'Cache-Control': 'private, no-store' } })
  : new Response(null, { status: 204, headers: securityHeaders })

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const pageParam = params.get('page')
  const slotParam = params.get('slot')
  const hasAdConsent = /(?:^|;\s*)freebet_ads_consent=accepted(?:;|$)/.test(request.headers.get('cookie') ?? '')
  const debug = params.get('debug') === '1' && hasAdConsent && await hasAdminSession()
  if (!hasAdConsent) return empty(false)
  if (!pageParam || !AD_PAGES.includes(pageParam as AdPage) || !slotParam || !/^\d+$/.test(slotParam)) return empty(debug, 'The page or slot identifier is invalid.')

  const referer = request.headers.get('referer')
  if (referer && !debug) {
    try {
      const refererPage = adPageFromPath(new URL(referer).pathname)
      if (!refererPage || refererPage !== pageParam) return empty(false)
    } catch {
      return empty(false)
    }
  }

  try {
    const settings = await readAdSettings()
    const page = pageParam as AdPage
    const placement = settings.placements[page]
    const index = Number(slotParam)
    const slot = placement?.slots[index]
    if (!placement?.enabled) return empty(debug, 'The page placement is disabled.')
    if (!slot || !dimensions[slot.size]) return empty(debug, 'No slot is configured at this index.')

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
    if (!source) return empty(debug, `${slot.network} is inactive or the selected ${slot.size} creative switch is off.`)

    const parsed = parseAdSnippet(source)
    if (!parsed.ok) return empty(debug, `Saved creative failed validation: ${parsed.issues.join(' ')}`)
    const isNative = slot.size === 'native'
    const pageScript = `<script>const page=${JSON.stringify(page)},slot=${JSON.stringify(slotParam)};${isNative ? "const sendHeight=()=>parent.postMessage({type:'freebet-ad-height',page,slot,size:'native',height:document.documentElement.scrollHeight},'*');new ResizeObserver(sendHeight).observe(document.documentElement);" : ''}${debug ? "const diagnostic=(stage,detail={})=>parent.postMessage({type:'freebet-ad-diagnostic',page,slot,stage,detail},'*');diagnostic('document-start',{origin:location.origin,opaqueOrigin:location.origin==='null'});const seenScripts=new WeakSet(),seenFrames=new WeakSet();const inspect=node=>{if(!(node instanceof Element))return;if(node.matches('script[src]')&&!seenScripts.has(node)){seenScripts.add(node);const url=new URL(node.src,location.href);diagnostic('script-requested',{host:url.host});node.addEventListener('load',()=>diagnostic('script-loaded',{host:url.host}));node.addEventListener('error',()=>diagnostic('script-load-error',{host:url.host}));}if(node.matches('iframe')&&!seenFrames.has(node)){seenFrames.add(node);diagnostic('nested-frame-created',{host:node.src?new URL(node.src,location.href).host:'unknown'});node.addEventListener('load',()=>diagnostic('nested-frame-loaded',{host:node.src?new URL(node.src,location.href).host:'unknown'}));node.addEventListener('error',()=>diagnostic('nested-frame-error',{host:node.src?new URL(node.src,location.href).host:'unknown'}));}};new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(inspect))).observe(document,{subtree:true,childList:true});document.querySelectorAll('script[src],iframe').forEach(inspect);addEventListener('error',event=>{const target=event.target;diagnostic(target&&target.src?'resource-error':'script-error',{host:target&&target.src?new URL(target.src,location.href).host:'',message:event.message||''})},true);addEventListener('securitypolicyviolation',event=>diagnostic('csp-violation',{blockedURI:event.blockedURI,directive:event.violatedDirective}));const reportBox=document.createElement('pre');reportBox.style='position:fixed;bottom:0;left:0;right:0;max-height:35vh;overflow:auto;margin:0;padding:6px;background:#111;color:#fff;font:11px monospace;z-index:2147483647';document.body.append(reportBox);function report(message){const line=document.createElement('div');line.textContent=message;reportBox.append(line)}diagnostic('creative-markup-ready',{scripts:document.querySelectorAll('script[src]').length,iframes:document.querySelectorAll('iframe').length});" : ''}addEventListener('load',()=>{${isNative ? 'sendHeight();' : ''}${debug ? "report('Iframe document loaded; creative markup was validated. This does not confirm script execution, a visible ad, or a paid impression.');diagnostic('document-loaded',{visible:document.visibilityState==='visible'});" : ''}});${debug ? "const observe=()=>{const adElements=[...document.querySelectorAll('iframe,ins,[id*=ad]')];const visible=adElements.some(element=>{const rect=element.getBoundingClientRect(),style=getComputedStyle(element);return rect.width>1&&rect.height>1&&style.display!=='none'&&style.visibility!=='hidden'});diagnostic('visibility-check',{visible,elementCount:adElements.length});};new MutationObserver(observe).observe(document.documentElement,{subtree:true,childList:true,attributes:true});setInterval(observe,3000);" : ''}</script>`
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="background:transparent;margin:0;${isNative ? '' : 'display:flex;align-items:center;justify-content:center;overflow:hidden;'}">${pageScript}${parsed.html}</body></html>`
    return new Response(html, { status: 200, headers: { ...securityHeaders, 'Cache-Control': 'private, no-store' } })
  } catch {
    return empty(debug, 'The ad settings could not be read for this slot.')
  }
}
