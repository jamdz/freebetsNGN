import { requireAdminApi, serverError } from '@/lib/admin-api'
import { buildPagination, parsePagination } from '@/lib/admin-pagination'

export async function GET(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response

  const params = new URL(request.url).searchParams
  const optionsMode = params.get('mode') === 'options'
  const { page, pageSize, from, to } = optionsMode
    ? { page: 1, pageSize: 200, from: 0, to: 199 }
    : parsePagination(params, { defaultSize: 10, allowed: [10, 25, 50] })
  const columns = optionsMode ? 'id,starts_at,ends_at' : 'id,starts_at,ends_at,prize_status,qualification_waived'
  const { data, count, error } = await auth.supabase
    .from('gameweeks')
    .select(columns, { count: 'exact' })
    .order('starts_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[admin] gameweeks list', { message: error.message, code: error.code })
    return serverError()
  }

  return Response.json({ items: data ?? [], pagination: buildPagination(page, pageSize, count ?? 0) })
}
