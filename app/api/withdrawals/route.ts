import { NextResponse } from 'next/server'
import { MIN_AIRTIME_WITHDRAWAL_NAIRA } from '@/lib/config'

const phonePattern = /^(?:\+234|0)(?:70|80|81|90|91)\d{8}$/
let pendingWithdrawal = false
export async function POST(request: Request) {
  if (pendingWithdrawal) return NextResponse.json({ error: 'You already have a pending withdrawal request.' }, { status: 409 })
  const body = await request.json().catch(() => null)
  const amount = Number(body?.amount)
  const phoneNumber = String(body?.phoneNumber ?? '').replace(/\s/g, '')
  if (!Number.isInteger(amount) || amount < MIN_AIRTIME_WITHDRAWAL_NAIRA) return NextResponse.json({ error: `Minimum withdrawal is ₦${MIN_AIRTIME_WITHDRAWAL_NAIRA}.` }, { status: 400 })
  if (amount > 1250) return NextResponse.json({ error: 'Insufficient balance for this withdrawal.' }, { status: 400 })
  if (!phonePattern.test(phoneNumber)) return NextResponse.json({ error: 'Enter a valid Nigerian mobile number.' }, { status: 400 })
  pendingWithdrawal = true
  return NextResponse.json({ id: `wd_${Date.now()}`, status: 'pending' }, { status: 201 })
}
