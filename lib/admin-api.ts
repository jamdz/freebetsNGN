import { cookies } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { ADMIN_COOKIE, getAdminEmail, isAdminConfigured, verifyAdminSession } from '@/lib/admin-auth'

export function serviceClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function requireAdminApi() {
  const session = (await cookies()).get(ADMIN_COOKIE)?.value
  if (!isAdminConfigured()) return { response: Response.json({ error: 'Admin is not configured' }, { status: 503 }) }
  if (!verifyAdminSession(session)) return { response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { supabase: serviceClient() }
}

export async function writeAudit(supabase: ReturnType<typeof serviceClient>, action: string, entity: string, entityId: string | null, details: Record<string, unknown> = {}) {
  const session = (await cookies()).get(ADMIN_COOKIE)?.value
  const { error } = await supabase.from('audit_log').insert({ action, entity, entity_id: entityId, details: { ...details, admin_email: getAdminEmail(session) } })
  if (error) console.error('[admin] audit_log insert failed after write', { action, entity, entityId, message: error.message })
}

export function badRequest(message: string) { return Response.json({ error: message }, { status: 400 }) }
export function serverError(message = 'Admin action failed') { return Response.json({ error: message }, { status: 500 }) }
