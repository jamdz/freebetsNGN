import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi, serverError, writeAudit } from '@/lib/admin-api'
import { getIntegration, maskedHints, saveIntegration } from '@/lib/server/integrations'

const emailConfig = z.object({ host: z.string().trim().min(1).max(255), port: z.number().int().min(1).max(65535), username: z.string().trim().min(1).max(255), fromName: z.string().trim().min(1).max(120), fromAddress: z.string().email(), replyTo: z.union([z.string().email(), z.literal('')]).optional(), dailySendCap: z.number().int().min(1).max(100000), perMinuteLimit: z.number().int().min(1).max(10000), secure: z.boolean().optional() }).strict()
const smsConfig = z.object({ baseUrl: z.string().url().refine((value) => value.startsWith('https://'), 'Provider URL must use HTTPS'), senderId: z.string().trim().min(1).max(20), channel: z.enum(['generic', 'dnd', 'whatsapp', 'voice']), codeLength: z.literal(6), expiryMinutes: z.number().int().min(1).max(60), resendCooldownSeconds: z.number().int().min(30).max(3600), maxAttempts: z.number().int().min(1).max(10), maxSendsPerNumberPerDay: z.number().int().min(1).max(10), lowBalanceThreshold: z.number().min(0) }).strict()

export async function GET() {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  try {
    const [email, sms] = await Promise.all([getIntegration('email'), getIntegration('sms')])
    await writeAudit(auth.supabase, 'view_messaging_settings', 'messaging', null)
    return NextResponse.json({ email: { publicConfig: email.publicConfig, isActive: email.isActive, secretHints: maskedHints(email.secrets) }, sms: { publicConfig: sms.publicConfig, isActive: sms.isActive, secretHints: maskedHints(sms.secrets) } })
  } catch (error) {
    console.error('[admin] messaging settings read', error)
    return serverError('Unable to load messaging settings')
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const input = await request.json().catch(() => null) as { channel?: unknown; publicConfig?: unknown; secrets?: unknown; isActive?: unknown } | null
  if (!input || (input.channel !== 'email' && input.channel !== 'sms') || typeof input.isActive !== 'boolean') return NextResponse.json({ error: 'Invalid messaging settings' }, { status: 400 })
  const isEmail = input.channel === 'email'
  const config = (isEmail ? emailConfig : smsConfig).safeParse(input.publicConfig)
  const secrets = (isEmail ? z.object({ password: z.string().max(2048).optional() }) : z.object({ apiKey: z.string().max(2048).optional() })).safeParse(input.secrets ?? {})
  if (!config.success || !secrets.success) return NextResponse.json({ error: 'Invalid messaging settings', issues: [...(config.success ? [] : config.error.issues), ...(secrets.success ? [] : secrets.error.issues)] }, { status: 400 })
  try {
    await saveIntegration(input.channel, { publicConfig: config.data as Record<string, unknown>, secrets: secrets.data, isActive: input.isActive }, process.env.ADMIN_EMAIL ?? 'admin')
    await writeAudit(auth.supabase, 'save_messaging_settings', `integration:${input.channel}`, input.channel, { is_active: input.isActive })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[admin] messaging settings save', error)
    return serverError('Unable to save messaging settings. Confirm INTEGRATION_ENCRYPTION_KEY is configured.')
  }
}
