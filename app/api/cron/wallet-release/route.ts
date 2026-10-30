import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase.from('wallet_ledger').update({ status: 'available' }).eq('status', 'pending').not('available_at', 'is', null).lte('available_at', now).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { data: evaluated, error: referralError } = await supabase.rpc('evaluate_general_referrals')
  if (referralError) return NextResponse.json({ error: referralError.message }, { status: 500 })
  const { data: spinTick, error: spinError } = await supabase.rpc('spin_tick')
  if (spinError) return NextResponse.json({ error: spinError.message }, { status: 500 })
  return NextResponse.json({ released: data?.length ?? 0, referralsEvaluated: evaluated ?? 0, spinTick, releasedAt: now })
}
