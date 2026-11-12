import { NextResponse } from 'next/server'
import { requireAdminApi, serverError, writeAudit } from '@/lib/admin-api'
import { getSmsBalance } from '@/lib/providers/sms'

export async function GET() {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  try {
    const balance = await getSmsBalance()
    const balanceAmount = Number(balance.balance)
    const isLow = Number.isFinite(balanceAmount) && balanceAmount <= balance.lowBalanceThreshold
    await writeAudit(auth.supabase, 'check_sms_balance', 'integration:sms', 'sms', { is_low: isLow })
    return NextResponse.json({ ...balance, isLow })
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Unable to check SMS balance')
  }
}
