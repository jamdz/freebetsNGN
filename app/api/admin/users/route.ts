import { requireAdminApi, serverError } from '@/lib/admin-api'

export async function GET(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const params = new URL(request.url).searchParams
  let query = auth.supabase.from('profiles').select('id,nickname,phone,email,status,created_at,referral_code').order('created_at', { ascending: false })
  const q = params.get('q')?.trim()
  const status = params.get('status')
  if (q) query = query.or(`nickname.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) { console.error('[admin] users list', error); return serverError() }
  return Response.json({ users: data ?? [] })
}
