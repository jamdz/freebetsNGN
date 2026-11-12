import { randomInt } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi, serverError, writeAudit } from '@/lib/admin-api'
import { sendEmail } from '@/lib/providers/email'
import { sendVerificationSms } from '@/lib/providers/sms'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderTemplate, validateTemplate } from '@/lib/notifications'

const schema = z.object({ channel: z.enum(['email', 'sms']), event_key: z.string().optional(), target: z.string().optional(), email: z.string().email().optional(), phone: z.string().optional() }).strict()
function maskedRecipient(value: string, channel: 'email' | 'sms') {
  if (channel === 'email') { const [name, domain] = value.split('@'); return `${name.slice(0, 1)}***@${domain}` }
  return `${value.slice(0, 4)}***${value.slice(-4)}`
}

export async function POST(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid test request' }, { status: 400 })
  const { channel } = parsed.data
  const target = channel === 'email' ? parsed.data.email ?? parsed.data.target ?? process.env.ADMIN_EMAIL : parsed.data.phone ?? parsed.data.target
  if (!target || (channel === 'email' && !z.string().email().safeParse(target).success) || (channel === 'sms' && !/^\+\d{8,15}$/.test(target))) return NextResponse.json({ error: `Provide a valid ${channel === 'email' ? 'email address' : 'E.164 phone number'}` }, { status: 400 })
  const eventKey = parsed.data.event_key ?? (channel === 'sms' ? 'phone_verification_test' : 'messaging_test')
  try {
    if (channel === 'email') {
      let subject = 'FreeBetNGN email delivery test'
      let html = '<p>Your email provider test succeeded.</p>'
      if (parsed.data.event_key) {
        const { data: template } = await auth.supabase.from('message_templates').select('enabled,subject,body').eq('event_key', parsed.data.event_key).eq('channel', 'email').maybeSingle()
        if (!template || !template.enabled) return NextResponse.json({ error: 'Email template is missing or disabled' }, { status: 400 })
        const unknown = [...validateTemplate(template.subject ?? ''), ...validateTemplate(template.body)]
        if (unknown.length) return NextResponse.json({ error: `Unsupported template variable: ${unknown[0]}` }, { status: 400 })
        const values = { nickname: 'Admin', amount: '1,000', reference: 'TEST-001', reason: 'Provider test', rank: '1', date: new Date().toLocaleDateString('en-NG'), link: 'https://freebetngn.com' }
        subject = renderTemplate(template.subject ?? '', values)
        html = renderTemplate(template.body, values)
      }
      await sendEmail({ to: target, subject, html })
    } else {
      const code = String(randomInt(100000, 1000000))
      await sendVerificationSms(target, code, 5)
    }
    const { error } = await createAdminClient().from('delivery_logs').insert({ channel, event_key: eventKey, recipient_masked: maskedRecipient(target, channel), status: 'sent' })
    if (error) console.error('[admin] messaging test log failed', { channel, message: error.message })
    await writeAudit(auth.supabase, 'send_messaging_test', `messaging:${channel}`, maskedRecipient(target, channel), { event_key: eventKey })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : 'Provider test failed'
    await createAdminClient().from('delivery_logs').insert({ channel, event_key: eventKey, recipient_masked: maskedRecipient(target, channel), status: 'failed', error: message })
    await writeAudit(auth.supabase, 'send_messaging_test_failed', `messaging:${channel}`, maskedRecipient(target, channel), { event_key: eventKey, error: message })
    return serverError(message)
  }
}
