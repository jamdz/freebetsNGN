import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi, serverError, writeAudit } from '@/lib/admin-api'
import { NOTIFICATION_EVENTS, validateTemplate } from '@/lib/notifications'

const templateSchema = z.object({ event_key: z.enum(NOTIFICATION_EVENTS), channel: z.literal('email'), enabled: z.boolean(), subject: z.string().trim().min(1).max(200), body: z.string().min(1).max(20000) }).strict()

export async function GET() {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const { data, error } = await auth.supabase.from('message_templates').select('event_key,channel,enabled,subject,body,updated_at').eq('channel', 'email').order('event_key')
  if (error) return serverError('Unable to load message templates')
  await writeAudit(auth.supabase, 'view_message_templates', 'message_templates', null)
  return NextResponse.json({ templates: data ?? [] })
}

export async function PUT(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const input = await request.json().catch(() => null)
  const parsed = z.array(templateSchema).min(1).max(NOTIFICATION_EVENTS.length).safeParse(input?.templates)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid templates', issues: parsed.error.issues }, { status: 400 })
  const seen = new Set<string>()
  for (const item of parsed.data) {
    if (seen.has(item.event_key)) return NextResponse.json({ error: 'Each event can appear only once' }, { status: 400 })
    seen.add(item.event_key)
    const unknown = [...validateTemplate(item.subject), ...validateTemplate(item.body)]
    if (unknown.length) return NextResponse.json({ error: `Unsupported template variable: ${unknown[0]}` }, { status: 400 })
  }
  const rows = parsed.data.map((item) => ({ ...item, updated_at: new Date().toISOString() }))
  const { error } = await auth.supabase.from('message_templates').upsert(rows, { onConflict: 'event_key,channel' })
  if (error) return serverError('Unable to save message templates')
  await writeAudit(auth.supabase, 'save_message_templates', 'message_templates', null, { count: rows.length })
  return NextResponse.json({ ok: true })
}
