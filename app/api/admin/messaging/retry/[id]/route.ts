import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { requireAdminApi, serverError, writeAudit } from '@/lib/admin-api'
import { processNotificationOutbox } from '@/lib/notifications'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: 'Invalid delivery id' }, { status: 400 })
  const { data, error } = await auth.supabase.from('notification_outbox').update({ status: 'queued', last_error: null }).eq('id', id).eq('status', 'failed').lt('attempts', 3).select('id,event').maybeSingle()
  if (error) return serverError('Unable to queue delivery retry')
  if (!data) return NextResponse.json({ error: 'No failed notification eligible for retry was found' }, { status: 404 })
  await writeAudit(auth.supabase, 'retry_notification', 'notification_outbox', id, { event_key: data.event })
  after(() => processNotificationOutbox(25))
  return NextResponse.json({ ok: true })
}
