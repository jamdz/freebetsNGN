import 'server-only'
import { cookies } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { ADMIN_COOKIE, getAdminEmail, hasAdminSession, isAdminConfigured, verifyReauthPassword } from '@/lib/admin-auth'

export function serviceClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function requireAdminApi() {
  if (!isAdminConfigured()) return { response: Response.json({ error: 'Admin is not configured' }, { status: 503 }) }
  if (!(await hasAdminSession())) return { response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { supabase: serviceClient() }
}

function redactAuditDetails(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditDetails)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    /secret|password|token|authorization|api.?key|credential|otp/i.test(key) ? '[REDACTED]' : redactAuditDetails(nested),
  ]))
}

export async function verifyAdminPasswordForRequest(password: unknown) {
  if (typeof password !== 'string' || !password) return false
  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value
  const email = getAdminEmail(cookie)
  return email ? verifyReauthPassword(email, password) : false
}

export async function writeAudit(supabase: ReturnType<typeof serviceClient>, action: string, entity: string, entityId: string | null, details: Record<string, unknown> = {}) {
  const session = (await cookies()).get(ADMIN_COOKIE)?.value
  const safeDetails = redactAuditDetails({ ...details, admin_email: getAdminEmail(session) })
  const { error } = await supabase.from('audit_log').insert({ action, entity, entity_id: entityId, details: safeDetails })
  if (error) console.error('[admin] audit_log insert failed after write', { action, entity, entityId, message: error.message })
}

export function badRequest(message: string) { return Response.json({ error: message }, { status: 400 }) }
export function serverError(message = 'Admin action failed') { return Response.json({ error: message }, { status: 500 }) }
