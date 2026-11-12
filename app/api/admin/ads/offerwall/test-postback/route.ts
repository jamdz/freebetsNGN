import { createHmac, randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { requireAdminApi, writeAudit } from '@/lib/admin-api'
import { getIntegration } from '@/lib/server/integrations'

export async function POST(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Test postbacks are disabled in production' }, { status: 403 })
  try {
    const integration = await getIntegration('offerwall_adgem')
    const secret = integration.secrets.postbackSecret
    if (!integration.isActive || typeof secret !== 'string' || !secret) return NextResponse.json({ error: 'Activate the offerwall and configure its postback secret first' }, { status: 400 })
    const payload = { user_id: randomUUID(), payout_usd: 1, status: 'completed', transaction_id: `v0-test-${randomUUID()}` }
    const signature = createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex')
    const endpoint = new URL('/api/postbacks/adgem', new URL(request.url).origin)
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-v0-postback-test': 'true', 'x-adgem-signature': signature }, body: JSON.stringify(payload), cache: 'no-store' })
    const result = await response.json().catch(() => ({}))
    await writeAudit(auth.supabase, 'test_ads_postback', 'ads', 'offerwall', { details: { response_status: response.status } })
    return NextResponse.json({ ok: response.ok, status: response.status, result }, { status: response.ok ? 200 : 502 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message.includes('INTEGRATION_ENCRYPTION_KEY') ? 'The integration encryption key is required to test the encrypted postback secret.' : 'Unable to send test postback' }, { status: 500 })
  }
}
