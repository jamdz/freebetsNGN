import { cookies } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { ADMIN_COOKIE, verifyAdminSession } from '@/lib/admin-auth'

export function serviceClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function requireAdminApi() {
  const session = (await cookies()).get(ADMIN_COOKIE)?.value
  if (!verifyAdminSession(session)) return { response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { supabase: serviceClient() }
}

export async function writeAudit(supabase: ReturnType<typeof serviceClient>, action: string, entity: string, entityId: string | null, details: Record<string, unknown> = {}) {
  const { error } = await supabase.from('audit_log').insert({ action, entity, entity_id: entityId, details })
  if (error) throw error
}

export function badRequest(message: string) { return Response.json({ error: message }, { status: 400 }) }
export function serverError(message = 'Admin action failed') { return Response.json({ error: message }, { status: 500 }) }
