import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  if (!body.email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  return NextResponse.json({ ok: true, message: 'Verification email queued', verificationUrl: `/verify/email?token=mock-${Date.now()}` })
}
