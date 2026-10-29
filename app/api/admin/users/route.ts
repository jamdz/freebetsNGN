import { requireAdminApi, serverError } from '@/lib/admin-api'
import { buildPagination, parsePagination } from '@/lib/admin-pagination'

export async function GET(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const params = new URL(request.url).searchParams
  const { page, pageSize, from, to } = parsePagination(params, { defaultSize: 10, allowed: [10, 25, 50] })
  const rawSearch = params.get('q') ?? ''
  const q = rawSearch.replace(/[(),%*]/g, '').trim().slice(0, 40)
  const status = params.get('status')?.trim()
  let query = auth.supabase.from('profiles').select('id,nickname,phone,email,status,created_at,referral_code', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to)
  if (q) query = query.or(`nickname.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
  if (status) query = query.eq('status', status)
  const { data, count, error } = await query
  if (error) { console.error('[admin] users list', { message: error.message, code: error.code }); return serverError() }
  const users = data ?? []
  const ids = users.map((user) => user.id)
  const balancesResult = ids.length ? await auth.supabase.from('user_balances').select('user_id,available,pending').in('user_id', ids) : { data: [], error: null }
  if (balancesResult.error) { console.error('[admin] user balances list', { message: balancesResult.error.message, code: balancesResult.error.code }); return serverError() }
  const balances = new Map((balancesResult.data ?? []).map((balance) => [balance.user_id, { available: Number(balance.available ?? 0), pending: Number(balance.pending ?? 0) }]))
  return Response.json({ users: users.map((user) => ({ ...user, balance: balances.get(user.id) ?? { available: 0, pending: 0 } })), pagination: buildPagination(page, pageSize, count ?? 0) })
}
