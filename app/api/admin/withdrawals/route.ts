import { NextResponse } from 'next/server'
import { requireAdminApi, serverError } from '@/lib/admin-api'
import { buildPagination, parsePagination } from '@/lib/admin-pagination'

function getLagosTodayRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? ''
  const start = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00+01:00`)
  return { start: start.toISOString(), end: new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString() }
}

function aggregateAmounts(rows: Array<{ amount: number | string }>) {
  return { count: rows.length, sum: rows.reduce((total, row) => total + Number(row.amount ?? 0), 0) }
}

export async function GET(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response

  const params = new URL(request.url).searchParams
  const { page, pageSize, from, to } = parsePagination(params, { defaultSize: 10, allowed: [10, 25, 50] })
  const method = params.get('method')
  const status = params.get('status')
  const q = params.get('q')?.replace(/[%,*]/g, '').trim()
  const { start, end } = getLagosTodayRange()
  let query = auth.supabase.from('withdrawals').select('id,method,amount,fee,status,reference,created_at,source_breakdown,bank_name,account_number,account_name,network,phone_number,user:profiles!withdrawals_user_id_fkey(nickname,email)', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to)
  if (method) query = query.eq('method', method.toLowerCase())
  if (status) query = query.eq('status', status.toLowerCase())
  if (q) query = query.or(`reference.ilike.%${q}%`)

  const [listResult, sentResult, failedResult] = await Promise.all([
    query,
    auth.supabase.from('withdrawals').select('amount').eq('status', 'sent').gte('processed_at', start).lt('processed_at', end),
    auth.supabase.from('withdrawals').select('amount').eq('status', 'failed').gte('processed_at', start).lt('processed_at', end),
  ])
  if (listResult.error || sentResult.error || failedResult.error) return serverError()

  const rows = listResult.data ?? []
  const sent = aggregateAmounts(sentResult.data ?? [])
  const failed = aggregateAmounts(failedResult.data ?? [])
  const summary = {
    pending_airtime_count: rows.filter((row) => row.method === 'airtime' && row.status === 'pending').length,
    pending_airtime_sum: rows.filter((row) => row.method === 'airtime' && row.status === 'pending').reduce((total, row) => total + Number(row.amount), 0),
    pending_bank_count: rows.filter((row) => row.method === 'bank' && row.status === 'pending').length,
    pending_bank_sum: rows.filter((row) => row.method === 'bank' && row.status === 'pending').reduce((total, row) => total + Number(row.amount), 0),
    sent_today_count: sent.count,
    sent_today_sum: sent.sum,
    failed_today_count: failed.count,
    failed_today_sum: failed.sum,
  }

  return NextResponse.json({ withdrawals: rows, summary, payout_modes: { airtime: 'Coming with the API configuration update', bank: 'manual' }, pagination: buildPagination(page, pageSize, listResult.count ?? 0) })
}

export async function POST() {
  return NextResponse.json({ error: 'Use the action endpoint' }, { status: 405 })
}
