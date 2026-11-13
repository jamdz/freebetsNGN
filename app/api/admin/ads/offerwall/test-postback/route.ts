import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { requireAdminApi, writeAudit } from '@/lib/admin-api'
import { buildAdgemPostbackUrl, ADGEM_POSTBACK_PATH } from '@/lib/server/adgem-postback'
import { getIntegration } from '@/lib/server/integrations'

export async function POST(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Test postbacks are disabled in production' }, { status: 403 })

  try {
    const integration = await getIntegration('offerwall_adgem')
    const secret = typeof integration.secrets.postbackSecret === 'string' && integration.secrets.postbackSecret
      ? integration.secrets.postbackSecret
      : process.env.ADGEM_POSTBACK_KEY
    if (!integration.isActive || !secret) return NextResponse.json({ error: 'Activate the offerwall and configure its postback secret first' }, { status: 400 })

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
    const signedUrl = buildAdgemPostbackUrl(siteUrl, {
      player_id: randomUUID(),
      payout: '1.00',
      amount: '70',
      transaction_id: `v0-test-${randomUUID()}`,
      request_id: randomUUID(),
      campaign_id: 'v0-test',
    }, secret)
    const signedQuery = new URL(signedUrl).search
    const endpoint = new URL(`${ADGEM_POSTBACK_PATH}${signedQuery}`, new URL(request.url).origin)
    const response = await fetch(endpoint, { method: 'GET', headers: { 'x-v0-postback-test': 'true' }, cache: 'no-store' })
    const result = await response.text()
    await writeAudit(auth.supabase, 'test_ads_postback', 'ads', 'offerwall', { details: { response_status: response.status } })
    return NextResponse.json({ ok: response.ok, status: response.status, result }, { status: response.ok ? 200 : 502 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message.includes('INTEGRATION_ENCRYPTION_KEY') ? 'The integration encryption key is required to test the encrypted postback secret.' : 'Unable to send the test postback' }, { status: 500 })
  }
}
