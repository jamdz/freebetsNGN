import { z } from 'zod'
import { requireAdminApi, serverError, writeAudit } from '@/lib/admin-api'

const schema = z.object({ gameweek_id: z.string().uuid() }).strict()

export async function POST(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid refresh request', issues: parsed.error.issues }, { status: 400 })
  const { data: users, error: usersError } = await auth.supabase.from('predictions').select('user_id').eq('gameweek_id', parsed.data.gameweek_id)
  if (usersError) return serverError()
  const ids = [...new Set((users ?? []).map((row) => row.user_id))]
  for (const userId of ids) {
    const { error } = await auth.supabase.rpc('compute_weekly_qualification', { p_user_id: userId, p_gameweek_id: parsed.data.gameweek_id })
    if (error) return Response.json({ error: 'Unable to refresh qualification' }, { status: 409 })
  }
  await writeAudit(auth.supabase, 'refresh_qualification', 'gameweek', parsed.data.gameweek_id, { refreshed: ids.length })
  return Response.json({ refreshed: ids.length })
}
