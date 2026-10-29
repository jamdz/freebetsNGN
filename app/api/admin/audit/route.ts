import { NextResponse } from 'next/server'
import { requireAdminApi, serverError } from '@/lib/admin-api'
import { buildPagination, parsePagination } from '@/lib/admin-pagination'

export async function GET(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const params = new URL(request.url).searchParams
  const { page, pageSize, from, to } = parsePagination(params, { defaultSize: 10, allowed: [10, 25, 50] })
  const action = params.get('action')?.trim(); const entity = params.get('entity')?.trim(); const fromDate = params.get('from'); const toDate = params.get('to')
  let query = auth.supabase.from('audit_log').select('id,created_at,action,entity,entity_id,details', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to)
  if (action) query = query.eq('action', action); if (entity) query = query.ilike('entity', `%${entity.replace(/[%*]/g, '')}%`)
  if (fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)) query = query.gte('created_at', `${fromDate}T00:00:00+01:00`)
  if (toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate)) query = query.lt('created_at', `${toDate}T00:00:00+01:00`)
  const [logsResult, actionsResult] = await Promise.all([query, auth.supabase.from('audit_log').select('action').not('action', 'is', null).order('action').limit(100)])
  if (logsResult.error) { console.error('[admin] audit list', logsResult.error); return serverError() }
  if (actionsResult.error) { console.error('[admin] audit actions', actionsResult.error); return serverError() }
  const actions = Array.from(new Set((actionsResult.data ?? []).map((row) => row.action).filter(Boolean)))
  return NextResponse.json({ logs: logsResult.data ?? [], actions, pagination: buildPagination(page, pageSize, logsResult.count ?? 0) })
}
