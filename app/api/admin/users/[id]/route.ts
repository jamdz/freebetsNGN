import { z } from 'zod'
import { requireAdminApi, serverError, writeAudit } from '@/lib/admin-api'
import { queueNotification } from '@/lib/notifications'

const schema = z.object({ status: z.enum(['active', 'suspended', 'banned']), reason: z.string().trim().min(3).optional() }).strict()
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi(); if ('response' in auth) return auth.response
  const id = (await params).id
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || ((parsed.data?.status === 'suspended' || parsed.data?.status === 'banned') && !parsed.data.reason)) return Response.json({ error: 'Invalid status change', issues: parsed.success ? [{ path: ['reason'], message: 'Reason is required' }] : parsed.error.issues }, { status: 400 })
  const { data, error } = await auth.supabase.from('profiles').update({ status: parsed.data.status }).eq('id', id).select('id,status').single()
  if (error) { console.error('[admin] user status', error); return serverError() }
  await writeAudit(auth.supabase, `${parsed.data.status}_user`, 'profile', id, { reason: parsed.data.reason ?? null })
  await queueNotification(parsed.data.status === 'suspended' ? 'account_suspended' : parsed.data.status === 'banned' ? 'account_banned' : 'account_reactivated', id, { reason: parsed.data.reason ?? null })
  return Response.json({ user: data })
}
