import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  if (!body.phone) return NextResponse.json({ error: 'Phone is required' }, { status: 400 })
  return NextResponse.json({ ok: true, code: '123456', mock: true, message: 'OTP queued' })
}
