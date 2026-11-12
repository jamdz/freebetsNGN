import 'server-only'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/providers/email'

export const NOTIFICATION_EVENTS = ['withdrawal_airtime_sent', 'withdrawal_airtime_rejected', 'withdrawal_bank_paid', 'withdrawal_bank_rejected', 'account_suspended', 'account_banned', 'account_reactivated', 'spin_win', 'prize_won', 'referral_credit'] as const
export type NotificationEvent = typeof NOTIFICATION_EVENTS[number]
export const TEMPLATE_VARIABLES = ['nickname', 'amount', 'reference', 'reason', 'rank', 'date', 'link'] as const
const variablePattern = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g

export function validateTemplate(text: string) {
  const unknown = [...text.matchAll(variablePattern)].map((match) => match[1]).filter((name) => !TEMPLATE_VARIABLES.includes(name as typeof TEMPLATE_VARIABLES[number]))
  return [...new Set(unknown)]
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}

export function renderTemplate(text: string, values: Record<string, unknown>) {
  return text.replace(variablePattern, (_match, name: string) => {
    const value = values[name] ?? ''
    if (name === 'link' && value) {
      const link = String(value)
      const isRelative = link.startsWith('/') && !link.startsWith('//')
      let isWebUrl = false
      try { const parsed = new URL(link); isWebUrl = parsed.protocol === 'https:' || parsed.protocol === 'http:' } catch { isWebUrl = false }
      if (!isRelative && !isWebUrl) return ''
      return escapeHtml(link)
    }
    return escapeHtml(value)
  })
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  return `${name.slice(0, 1)}***@${domain}`
}

async function logDelivery(input: { id: string; eventKey: string; recipient: string; status: 'sent' | 'failed'; error?: string }) {
  const { error } = await createAdminClient().from('delivery_logs').upsert({ id: input.id, channel: 'email', event_key: input.eventKey, recipient_masked: maskEmail(input.recipient), status: input.status, error: input.error ?? null }, { onConflict: 'id' })
  if (error) console.error('[notifications] delivery log failed', { eventKey: input.eventKey, message: error.message })
}

export async function queueNotification(event: NotificationEvent, userId: string, payload: Record<string, unknown>) {
  try {
    if (!NOTIFICATION_EVENTS.includes(event)) return
    const { error } = await createAdminClient().from('notification_outbox').insert({ event, user_id: userId, payload, channel: 'email' })
    if (error) {
      console.error('[notifications] queue failed', { event, userId, message: error.message })
      return
    }
    after(() => processNotificationOutbox(25))
  } catch (error) {
    console.error('[notifications] queue exception', { event, userId, error })
  }
}

export async function processNotificationOutbox(limit = 25) {
  const db = createAdminClient()
  const now = new Date().toISOString()
  await db.from('notification_outbox').update({ status: 'queued' }).eq('status', 'processing').lt('created_at', new Date(Date.now() - 15 * 60_000).toISOString())
  const { data: rows, error } = await db.from('notification_outbox').select('id,event,user_id,channel,payload,status,attempts').in('status', ['queued', 'failed']).lt('attempts', 3).order('created_at', { ascending: true }).limit(Math.max(1, Math.min(100, limit)))
  if (error) {
    console.error('[notifications] outbox read failed', { message: error.message })
    return { processed: 0, failed: 0 }
  }

  let processed = 0
  let failed = 0
  for (const row of rows ?? []) {
    const { data: claimed, error: claimError } = await db.from('notification_outbox').update({ status: 'processing' }).eq('id', row.id).eq('status', row.status).select('id').maybeSingle()
    if (claimError || !claimed) continue
    const attempt = Number(row.attempts ?? 0) + 1
    try {
      if (row.channel !== 'email') throw new Error('Unsupported notification channel')
      const { data: template, error: templateError } = await db.from('message_templates').select('enabled,subject,body').eq('event_key', row.event).eq('channel', 'email').maybeSingle()
      if (templateError) throw templateError
      if (template?.enabled === false) {
        await db.from('notification_outbox').update({ status: 'sent', attempts: attempt, last_error: 'template disabled', sent_at: now }).eq('id', row.id)
        processed += 1
        continue
      }
      if (!template) throw new Error('Email template not found')
      const { data: profile, error: profileError } = await db.from('profiles').select('email,nickname').eq('id', row.user_id).maybeSingle()
      if (profileError) throw profileError
      if (!profile?.email) throw new Error('Recipient email not found in profiles')
      const payload = row.payload && typeof row.payload === 'object' ? row.payload as Record<string, unknown> : {}
      const values: Record<string, unknown> = {
        nickname: profile.nickname,
        amount: payload.amount ?? payload.amount_naira,
        reference: payload.reference,
        reason: payload.reason,
        rank: payload.rank,
        date: payload.date ?? new Date().toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos' }),
        link: payload.link,
      }
      const subject = renderTemplate(template.subject ?? '', values)
      const html = renderTemplate(template.body, values)
      await sendEmail({ to: profile.email, subject, html })
      await db.from('notification_outbox').update({ status: 'sent', attempts: attempt, last_error: null, sent_at: new Date().toISOString() }).eq('id', row.id)
      await logDelivery({ id: row.id, eventKey: row.event, recipient: profile.email, status: 'sent' })
      processed += 1
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Delivery failed'
      await db.from('notification_outbox').update({ status: 'failed', attempts: attempt, last_error: message }).eq('id', row.id)
      const { data: profile } = await db.from('profiles').select('email').eq('id', row.user_id).maybeSingle()
      if (profile?.email) await logDelivery({ id: row.id, eventKey: row.event, recipient: profile.email, status: 'failed', error: message.replaceAll(profile.email, maskEmail(profile.email)) })
      console.error('[notifications] delivery failed', { id: row.id, event: row.event, attempt, error: message })
      failed += 1
    }
  }
  return { processed, failed }
}
