import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIntegration } from '@/lib/server/integrations'

export const runtime = 'nodejs'
const schema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict()
function otpHash(userId: string, phone: string, code: string) {
  const secret = process.env.OTP_HASH_SECRET
  if (!secret || secret.length < 32) throw new Error('OTP_HASH_SECRET is not configured with at least 32 characters')
  return createHmac('sha256', secret).update(`${userId}:${phone}:${code}`).digest()
}

export async function POST(request: Request) {
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter the 6-digit code' }, { status: 400 })
  const db = createAdminClient()
  const { data: profile, error: profileError } = await db.from('profiles').select('phone,phone_verified').eq('id', user.id).maybeSingle()
  if (profileError || !profile?.phone) return NextResponse.json({ error: 'Phone number not found' }, { status: 400 })
  if (profile.phone_verified) return NextResponse.json({ verified: true })

  let maxAttempts = 5
  try {
    const integration = await getIntegration('sms')
    maxAttempts = Number((integration.publicConfig as { maxAttempts?: number }).maxAttempts ?? maxAttempts)
  } catch {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_OTP !== 'true') return NextResponse.json({ error: 'SMS verification settings are unavailable' }, { status: 503 })
  }
  const { data: otp, error: otpError } = await db.from('phone_otps').select('id,code_hash,expires_at,attempts,consumed').eq('user_id', user.id).eq('phone', profile.phone).eq('consumed', false).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (otpError) return NextResponse.json({ error: 'Unable to check verification code' }, { status: 500 })
  if (!otp) return NextResponse.json({ error: 'Request a new verification code' }, { status: 400 })
  if (new Date(otp.expires_at).getTime() <= Date.now()) {
    await db.from('phone_otps').update({ consumed: true }).eq('id', otp.id).eq('consumed', false)
    return NextResponse.json({ error: 'Verification code expired. Request a new one.' }, { status: 400 })
  }
  if (Number(otp.attempts) >= maxAttempts) {
    await db.from('phone_otps').update({ consumed: true }).eq('id', otp.id).eq('consumed', false)
    return NextResponse.json({ error: 'Too many attempts. Request a new code.' }, { status: 429 })
  }

  let expected: Buffer
  try { expected = otpHash(user.id, profile.phone, parsed.data.code) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'OTP hashing is not configured' }, { status: 503 }) }
  const stored = Buffer.from(otp.code_hash, 'hex')
  const matches = stored.length === expected.length && timingSafeEqual(stored, expected)
  if (!matches) {
    const { data: counted, error: countError } = await db.from('phone_otps').update({ attempts: Number(otp.attempts) + 1 }).eq('id', otp.id).eq('attempts', otp.attempts).eq('consumed', false).select('id').maybeSingle()
    if (countError) return NextResponse.json({ error: 'Unable to record verification attempt' }, { status: 500 })
    if (!counted) return NextResponse.json({ error: 'Too many verification attempts. Request a new code.' }, { status: 429 })
    return NextResponse.json({ error: 'That code is not correct' }, { status: 400 })
  }

  const { data: consumed, error: consumeError } = await db.from('phone_otps').update({ consumed: true }).eq('id', otp.id).eq('consumed', false).select('id').maybeSingle()
  if (consumeError || !consumed) return NextResponse.json({ error: 'Verification code has already been used' }, { status: 409 })
  const { error: updateError } = await db.from('profiles').update({ phone_verified: true }).eq('id', user.id)
  if (updateError) return NextResponse.json({ error: 'Unable to update phone verification status' }, { status: 500 })
  return NextResponse.json({ verified: true })
}
