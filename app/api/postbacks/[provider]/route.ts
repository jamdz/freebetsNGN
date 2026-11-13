import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readAdSettings } from '@/lib/server/ads'
import { getIntegration } from '@/lib/server/integrations'
import { processAdgemPostback, type AdgemCreditArguments, type AdgemPostbackResult } from '@/lib/server/adgem-postback'

function plainText(body: string, status: number) {
  return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })
}

async function logAttempt(result: AdgemPostbackResult, startedAt: number) {
  try {
    await createAdminClient().from('integration_logs').insert({
      provider: 'offerwall_adgem',
      event_type: 'offer_postback',
      success: result.success,
      response_status: result.status,
      latency_ms: Date.now() - startedAt,
      error_message: result.success ? null : result.reason,
      response_summary: { status: result.success ? 'ok' : 'error', reason: result.reason },
    })
  } catch {
    console.error('[postback] log failed')
  }
}

function requestIp(request: Request) {
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  return request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ?? ''
}

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  if (provider !== 'adgem') return plainText('Not found', 404)

  const startedAt = Date.now()
  const testOnly = process.env.NODE_ENV !== 'production' && request.headers.get('x-v0-postback-test') === 'true'
  const db = createAdminClient()

  try {
    const [integration, settings] = await Promise.all([getIntegration('offerwall_adgem'), readAdSettings()])
    const secret = typeof integration.secrets.postbackSecret === 'string' && integration.secrets.postbackSecret
      ? integration.secrets.postbackSecret
      : process.env.ADGEM_POSTBACK_KEY
    if (!secret) {
      const failure: AdgemPostbackResult = { status: 422, body: 'Error: postback key is not configured', success: false, signatureOk: false, reason: 'missing_key' }
      await logAttempt(failure, startedAt)
      return plainText(failure.body, failure.status)
    }
    if (!integration.isActive || !settings.offerwall.active) {
      const failure: AdgemPostbackResult = { status: 403, body: 'Error: offerwall is inactive', success: false, signatureOk: false, reason: 'offerwall_inactive' }
      await logAttempt(failure, startedAt)
      return plainText(failure.body, failure.status)
    }

    const allowedIps = Array.isArray(integration.publicConfig.allowedIps)
      ? (integration.publicConfig.allowedIps as unknown[]).filter((value: unknown): value is string => typeof value === 'string' && Boolean(value.trim())).map((value: string) => value.trim())
      : []
    if (!testOnly && allowedIps.length > 0 && !allowedIps.includes(requestIp(request))) {
      const failure: AdgemPostbackResult = { status: 403, body: 'Error: IP is not allowed', success: false, signatureOk: false, reason: 'ip_not_allowed' }
      await logAttempt(failure, startedAt)
      return plainText(failure.body, failure.status)
    }

    const result = await processAdgemPostback(request.url, {
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? '',
      secret,
      testOnly,
      offerwall: settings.offerwall,
      isActiveProfile: async (playerId) => {
        const { data, error } = await db.from('profiles').select('id').eq('id', playerId).eq('status', 'active').maybeSingle()
        if (error) throw error
        return Boolean(data)
      },
      // AdGem's documented v2 and v3 postbacks do not define a reversal or chargeback signal.
      // TODO: Add reverse_offer handling if AdGem documents a supported reversal event.
      applyOfferPostback: async (args: AdgemCreditArguments) => {
        const { data, error } = await db.rpc('apply_offer_postback', args)
        if (error) throw error
        const rpcResult = Array.isArray(data) ? data[0] : data
        return { duplicate: Boolean(rpcResult && typeof rpcResult === 'object' && 'duplicate' in rpcResult && rpcResult.duplicate) }
      },
    })
    await logAttempt(result, startedAt)
    return plainText(result.body, result.status)
  } catch {
    const failure: AdgemPostbackResult = { status: 500, body: 'Error: unable to process postback', success: false, signatureOk: false, reason: 'processing_error' }
    await logAttempt(failure, startedAt)
    return plainText(failure.body, failure.status)
  }
}

export async function POST() {
  return NextResponse.json({ error: 'AdGem v2 postbacks must use GET' }, { status: 405, headers: { Allow: 'GET' } })
}
