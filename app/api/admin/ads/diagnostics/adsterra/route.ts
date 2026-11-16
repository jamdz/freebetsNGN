import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api'
import { readAdSettings } from '@/lib/server/ads'
import { parseAdSnippet } from '@/lib/server/ad-snippets'
import type { AdSize } from '@/lib/ad-settings'

export const dynamic = 'force-dynamic'

const formats: AdSize[] = ['320x100', '300x250', '728x90', 'native']

function sourceHost(html: string) {
  const source = html.match(/\bsrc="([^"]+)"/i)?.[1]
  if (!source) return null
  try { return new URL(source).hostname } catch { return null }
}

export async function GET() {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response

  try {
    const { adsterra } = (await readAdSettings()).networks
    const items = formats.map((size) => {
      const creative = size === 'native' ? adsterra.native : adsterra.banner[size]
      const active = size === 'native' ? adsterra.nativeActive : adsterra.bannerActive[size]
      const parsed = parseAdSnippet(creative)
      const reason = !adsterra.active ? 'Adsterra network is disabled.'
        : !active ? `Adsterra ${size} format is disabled.`
          : !creative.trim() ? `No saved Adsterra ${size} creative.`
            : !parsed.ok ? `Saved creative failed validation: ${parsed.issues.join(' ')}`
              : 'Saved creative is active and passes snippet validation.'
      return { size, ready: adsterra.active && active && Boolean(creative.trim()) && parsed.ok, reason, sourceHost: parsed.ok ? sourceHost(parsed.html) : null }
    })
    return NextResponse.json({ network: 'Adsterra', formats: items }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to inspect saved Adsterra creatives.' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
