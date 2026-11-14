import 'server-only'
import nodemailer from 'nodemailer'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIntegration } from '@/lib/server/integrations'
import { getSiteSettings } from '@/lib/server/site-content'
import { DEFAULTS } from '@/lib/site-settings'

export type EmailSettings = {
  host: string
  port: number
  username: string
  fromName: string
  fromAddress: string
  replyTo?: string
  dailySendCap: number
  perMinuteLimit: number
  secure?: boolean
}

export async function sendEmail(input: { to: string; subject: string; html: string; text?: string }) {
  const integration = await getIntegration('email')
  const settings = integration.publicConfig as Partial<EmailSettings>
  const password = integration.secrets.password
  if (!integration.isActive) throw new Error('Email delivery is disabled')
  if (!settings.host || !settings.port || !settings.username || typeof password !== 'string' || !settings.fromAddress) {
    throw new Error('SMTP settings are incomplete')
  }
  const dailyCap = Number(settings.dailySendCap)
  const perMinuteLimit = Number(settings.perMinuteLimit)
  if (!Number.isInteger(dailyCap) || dailyCap < 1 || !Number.isInteger(perMinuteLimit) || perMinuteLimit < 1) {
    throw new Error('SMTP send limits are invalid')
  }

  const db = createAdminClient()
  const now = Date.now()
  const [daily, recent] = await Promise.all([
    db.from('delivery_logs').select('id', { count: 'exact', head: true }).eq('channel', 'email').eq('status', 'sent').gte('created_at', new Date(now - 86_400_000).toISOString()),
    db.from('delivery_logs').select('id', { count: 'exact', head: true }).eq('channel', 'email').eq('status', 'sent').gte('created_at', new Date(now - 60_000).toISOString()),
  ])
  if (daily.error || recent.error) throw new Error('Unable to validate email send limits')
  if ((daily.count ?? 0) >= dailyCap) throw new Error('Daily email send cap reached')
  if ((recent.count ?? 0) >= perMinuteLimit) throw new Error('Email per-minute rate limit reached')

  const transport = nodemailer.createTransport({
    host: settings.host,
    port: Number(settings.port),
    secure: settings.secure ?? Number(settings.port) === 465,
    auth: { user: settings.username, pass: password },
  })
  const { siteName } = await getSiteSettings()
  const from = { name: settings.fromName && settings.fromName !== DEFAULTS.siteName ? settings.fromName : siteName, address: settings.fromAddress }
  await transport.sendMail({ from, to: input.to, replyTo: settings.replyTo || undefined, subject: input.subject, html: input.html, text: input.text })
}
