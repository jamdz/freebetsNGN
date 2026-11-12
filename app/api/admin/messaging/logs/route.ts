import { NextResponse } from 'next/server'
import { requireAdminApi, serverError, writeAudit } from '@/lib/admin-api'
import { buildPagination, parsePagination } from '@/lib/admin-pagination'

export async function GET(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const params = new URL(request.url).searchParams
  const { page, pageSize, from, to } = parsePagination(params, { defaultSize: 25, allowed: [10, 25, 50] })
  const channel = params.get('channel')
  const status = params.get('status')
  let query = auth.supabase.from('delivery_logs').select('id,channel,event_key,recipient_masked,status,error,cost_naira,created_at', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to)
  if (channel === 'email' || channel === 'sms') query = query.eq('channel', channel)
  if (status === 'sent' || status === 'failed') query = query.eq('status', status)
  const { data, error, count } = await query
  if (error) return serverError('Unable to load delivery logs')
  await writeAudit(auth.supabase, 'view_delivery_logs', 'delivery_logs', null, { page, channel, status })
  return NextResponse.json({ logs: data ?? [], pagination: buildPagination(page, pageSize, count ?? 0) })
}
