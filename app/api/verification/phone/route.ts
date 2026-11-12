import { createHmac, randomInt } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIntegration } from '@/lib/server/integrations'
import { sendVerificationSms } from '@/lib/providers/sms'

export const runtime = 'nodejs'
const MOCK_OTP_ENABLED = process.env.NODE_ENV !== 'production' || process.env.ALLOW_MOCK_OTP === 'true'
const DEFAULTS = { codeLength: 6, expiryMinutes: 10, resendCooldownSeconds: 30, maxAttempts: 5, maxSendsPerNumberPerDay: 5 }
function otpHash(userId: string, phone: string, code: string) {
  const secret = process.env.OTP_HASH_SECRET
  if (!secret || secret.length < 32) throw new Error('OTP_HASH_SECRET is not configured with at least 32 characters')
  return createHmac('sha256', secret).update(`${userId}:${phone}:${code}`).digest('hex')
}
function maskPhone(phone: string) { return `${phone.slice(0, 4)}***${phone.slice(-4)}` }

export async function POST() {
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createAdminClient()
  const { data: profile, error: profileError } = await db.from('profiles').select('phone,phone_verified').eq('id', user.id).maybeSingle()
  if (profileError || !profile?.phone) return NextResponse.json({ error: 'A phone number is required on your profile' }, { status: 400 })
  if (profile.phone_verified) return NextResponse.json({ error: 'Phone number is already verified' }, { status: 409 })
  if (!/^\+234\d{10}$/.test(profile.phone)) return NextResponse.json({ error: 'Profile phone number must use +234 format' }, { status: 400 })

  const mock = MOCK_OTP_ENABLED
  let settings = DEFAULTS
  try {
    const integration = await getIntegration('sms')
    const config = integration.publicConfig as Partial<typeof DEFAULTS>
    settings = {
      codeLength: 6,
      expiryMinutes: Number(config.expiryMinutes ?? DEFAULTS.expiryMinutes),
      resendCooldownSeconds: Number(config.resendCooldownSeconds ?? DEFAULTS.resendCooldownSeconds),
      maxAttempts: Number(config.maxAttempts ?? DEFAULTS.maxAttempts),
      maxSendsPerNumberPerDay: Number(config.maxSendsPerNumberPerDay ?? DEFAULTS.maxSendsPerNumberPerDay),
    }
    if (!mock && !integration.isActive) return NextResponse.json({ error: 'SMS verification is not configured' }, { status: 503 })
  } catch (error) {
    if (!mock) return NextResponse.json({ error: error instanceof Error ? error.message : 'SMS verification is not configured' }, { status: 503 })
  }

  const latestResult = await db.from('phone_otps').select('id,created_at,attempts,consumed').eq('user_id', user.id).eq('phone', profile.phone).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (latestResult.error) return NextResponse.json({ error: 'Unable to check verification cooldown' }, { status: 500 })
  const latestCreatedAt = latestResult.data?.created_at ? new Date(latestResult.data.created_at).getTime() : 0
  const retryAfterSeconds = settings.resendCooldownSeconds - Math.floor((Date.now() - latestCreatedAt) / 1000)
  if (latestCreatedAt && retryAfterSeconds > 0) return NextResponse.json({ error: 'Please wait before requesting another code', retryAfterSeconds }, { status: 429 })

  const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
  const { count, error: countError } = await db.from('phone_otps').select('id', { count: 'exact', head: true }).eq('phone', profile.phone).gte('created_at', dayAgo)
  if (countError) return NextResponse.json({ error: 'Unable to check daily verification limit' }, { status: 500 })
  if ((count ?? 0) >= settings.maxSendsPerNumberPerDay) return NextResponse.json({ error: 'Daily phone verification limit reached' }, { status: 429 })

  const code = mock ? '123456' : String(randomInt(100000, 1000000))
  let codeHash: string
  try { codeHash = otpHash(user.id, profile.phone, code) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'OTP hashing is not configured' }, { status: 503 }) }
  await db.from('phone_otps').update({ consumed: true }).eq('user_id', user.id).eq('phone', profile.phone).eq('consumed', false)
  const expiresAt = new Date(Date.now() + settings.expiryMinutes * 60_000).toISOString()
  const { data: otp, error: insertError } = await db.from('phone_otps').insert({ user_id: user.id, phone: profile.phone, code_hash: codeHash, expires_at: expiresAt, attempts: 0, consumed: false }).select('id').single()
  if (insertError || !otp) return NextResponse.json({ error: 'Unable to create verification code' }, { status: 500 })

  if (!mock) {
    try {
      await sendVerificationSms(profile.phone, code, settings.expiryMinutes)
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 300) : 'SMS provider failed'
      await db.from('phone_otps').update({ consumed: true }).eq('id', otp.id)
      await db.from('delivery_logs').insert({ channel: 'sms', event_key: 'phone_verification', recipient_masked: maskPhone(profile.phone), status: 'failed', error: message })
      return NextResponse.json({ error: 'Unable to send verification code' }, { status: 502 })
    }
  }
  await db.from('delivery_logs').insert({ channel: 'sms', event_key: 'phone_verification', recipient_masked: maskPhone(profile.phone), status: 'sent' })
  return NextResponse.json({ ok: true, mock, expiresInMinutes: settings.expiryMinutes, cooldownSeconds: settings.resendCooldownSeconds, ...(mock ? { developmentCode: code } : {}) })
}
