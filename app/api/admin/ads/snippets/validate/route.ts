import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/admin-api'
import { isAadsUnitId, aadsUnitSnippet, parseAdSnippet, parseAdcashInput } from '@/lib/server/ad-snippets'
import { AD_SIZES } from '@/lib/server/ads'
import type { AdSize } from '@/lib/ad-settings'

const dimensions: Record<AdSize, { width: number; height: number }> = {
  '320x100': { width: 320, height: 100 },
  '300x250': { width: 300, height: 250 },
  '728x90': { width: 728, height: 90 },
  native: { width: 0, height: 0 },
}
const schema = z.object({ network: z.enum(['A-ADS', 'Adsterra', 'Adcash']), size: z.enum(AD_SIZES as [AdSize, ...AdSize[]]), snippet: z.string().max(8192) })

export async function POST(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response

  const input = schema.safeParse(await request.json().catch(() => null))
  if (!input.success) return NextResponse.json({ ok: false, issues: ['Invalid validation request.'], html: '' }, { status: 400 })

  const { network, size, snippet } = input.data
  if (network === 'Adcash') {
    const result = parseAdcashInput(snippet)
    const { error: auditError } = await auth.supabase.from('audit_log').insert({
      action: result.ok ? 'validate_ad_snippet_ok' : 'validate_ad_snippet_failed',
      entity: 'Adcash',
      entity_id: result.ok ? result.zoneId : 'zone',
      details: { network, format: result.ok ? result.format : null, ok: result.ok },
    })
    if (auditError) console.error('[admin] Adcash validation audit insert failed', { ok: result.ok, message: auditError.message })
    return NextResponse.json({ ok: result.ok, issues: result.ok ? [] : [result.issue], format: result.ok ? result.format : undefined, zoneId: result.ok ? result.zoneId : undefined }, { headers: { 'Cache-Control': 'no-store' } })
  }
  const source = network === 'A-ADS' && isAadsUnitId(snippet) ? aadsUnitSnippet(snippet, dimensions[size]) : snippet
  const result = parseAdSnippet(source)
  const { error: auditError } = await auth.supabase.from('audit_log').insert({
    action: result.ok ? 'validate_ad_snippet_ok' : 'validate_ad_snippet_failed',
    entity: network,
    entity_id: size,
    details: { network, size, ok: result.ok },
  })
  if (auditError) console.error('[admin] ad snippet validation audit insert failed', { network, size, ok: result.ok, message: auditError.message })
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
