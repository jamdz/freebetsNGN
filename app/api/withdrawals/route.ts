import { NextResponse } from 'next/server'
import { MIN_AIRTIME_WITHDRAWAL_NAIRA, WITHDRAWAL_RULES } from '@/lib/config'
import { getMockWithdrawalState, getMockWithdrawalMethodState, setMockWithdrawalMethodPending } from '@/lib/mock-store'

const phonePattern = /^(?:\+234|0)(?:70|80|81|90|91)\d{8}$/
const bankPattern = /^\d{10}$/
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const method = body?.method === 'bank' ? 'bank' : 'airtime'
  if (getMockWithdrawalMethodState(method)) return NextResponse.json({ error: `You already have a pending ${method} withdrawal request.` }, { status: 409 })
  const amount = Number(body?.amount)
  const state = getMockWithdrawalState()
  const minimum = method === 'bank' ? WITHDRAWAL_RULES.minCashWithdrawalNaira : MIN_AIRTIME_WITHDRAWAL_NAIRA
  if (!Number.isInteger(amount) || amount < minimum) return NextResponse.json({ error: `Minimum ${method} withdrawal is ₦${minimum}.` }, { status: 400 })
  if (amount > state.rewardBalanceNaira) return NextResponse.json({ error: 'Insufficient withdrawable balance.' }, { status: 400 })
  if (method === 'airtime' && !phonePattern.test(String(body?.phoneNumber ?? '').replace(/\s/g, ''))) return NextResponse.json({ error: 'Enter a valid Nigerian mobile number.' }, { status: 400 })
  if (method === 'bank' && (!bankPattern.test(String(body?.accountNumber ?? '')) || !body?.accountName)) return NextResponse.json({ error: 'Verify a valid 10-digit account and confirm the account name.' }, { status: 400 })
  setMockWithdrawalMethodPending(method, true)
  return NextResponse.json({ id: `wd_${Date.now()}`, reference: `FBT-${Date.now().toString().slice(-6)}`, status: 'pending', expected: method === 'bank' ? 'within 24 hours' : 'within minutes' }, { status: 201 })
}
