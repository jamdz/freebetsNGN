import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { queueNotification } from '@/lib/notifications'

export const runtime = 'nodejs'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createAdminClient()
  const startedAt = new Date().toISOString()
  const now = new Date().toISOString()
  const { data, error } = await supabase.rpc('release_pending_ledger')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { data: evaluated, error: referralError } = await supabase.rpc('evaluate_general_referrals')
  if (referralError) return NextResponse.json({ error: referralError.message }, { status: 500 })
  const { data: referralCredits } = await supabase.from('wallet_ledger').select('user_id,amount_naira,reference').in('type', ['referral_general', 'referral_promo']).gte('created_at', startedAt)
  for (const credit of referralCredits ?? []) await queueNotification('referral_credit', credit.user_id, { amount_naira: credit.amount_naira, reference: credit.reference })
  const { data: spinTick, error: spinError } = await supabase.rpc('spin_tick')
  if (spinError) return NextResponse.json({ error: spinError.message }, { status: 500 })
  return NextResponse.json({ released: data?.length ?? 0, referralsEvaluated: evaluated ?? 0, spinTick, releasedAt: now })
}
