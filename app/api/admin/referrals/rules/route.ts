import { z } from 'zod'
import { requireAdminApi, writeAudit, badRequest, serverError, verifyAdminPasswordForRequest } from '@/lib/admin-api'

const schema = z.object({ rewardNaira: z.number().nonnegative(), activeDaysRequired: z.number().int().min(1).max(60), windowDays: z.number().int().min(1).max(90), minPredictions: z.number().int().min(0).max(200) }).refine((value) => value.windowDays >= value.activeDaysRequired, { message: 'windowDays must be at least activeDaysRequired' })

export async function PATCH(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return badRequest('Invalid referral rules')
  const { admin_password, ...rulesInput } = body as Record<string, unknown>
  if (!(await verifyAdminPasswordForRequest(admin_password))) return Response.json({ error: 'Valid admin password required' }, { status: 403 })

  const parsed = schema.safeParse(rulesInput)
  if (!parsed.success) return badRequest('Invalid referral rules')
  const { data, error } = await auth.supabase.from('app_config').update({ general_referral_rules: parsed.data }).eq('id', true).select('general_referral_rules').maybeSingle()
  if (error) return serverError(error.message)
  await writeAudit(auth.supabase, 'update_referral_rules', 'app_config', null, parsed.data)
  return Response.json({ rules: data?.general_referral_rules ?? parsed.data })
}
