import 'server-only'
import { createHash } from 'node:crypto'
import { decryptSecrets, encryptSecrets } from '@/lib/server/secrets'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getAdminEmail, getAdminTokenHash } from '@/lib/admin-auth'

export function securityDb() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function maskAdminEmail(email: string) {
  const [local = '', domain = ''] = email.toLowerCase().split('@')
  return `${local.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(local.length - 1, 8)))}@${domain || 'invalid'}`
}

export async function recordAdminLoginFailure(email: string, ip: string) {
  const { error } = await securityDb().from('audit_log').insert({
    action: 'admin_login_failed', entity: 'admin', entity_id: null,
    details: { masked_email: maskAdminEmail(email), email_hash: createHash('sha256').update(email.trim().toLowerCase()).digest('hex'), ip },
  })
  if (error) throw new Error('ADMIN_AUDIT_UNAVAILABLE')
}

export async function isAdminLoginLocked(email: string, ip: string) {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { data, error } = await securityDb().from('audit_log').select('details').eq('action', 'admin_login_failed').gte('created_at', cutoff)
  if (error) throw new Error('ADMIN_AUDIT_UNAVAILABLE')
  let ipFailures = 0
  let emailFailures = 0
  const emailHash = createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
  for (const entry of data ?? []) {
    if (entry.details?.ip === ip) ipFailures += 1
    if (entry.details?.email_hash === emailHash) emailFailures += 1
  }
  return ipFailures >= 5 || emailFailures >= 5
}

export function decryptTotpSecret(ciphertext: string) {
  const value = decryptSecrets(ciphertext).secret
  if (typeof value !== 'string') throw new Error('Invalid encrypted TOTP secret')
  return value
}

export function encryptTotpSecret(secret: string) { return encryptSecrets({ secret }) }

export function currentAdminIdentity(cookie: string | null | undefined) {
  const email = getAdminEmail(cookie)
  const tokenHash = getAdminTokenHash(cookie)
  if (!email || !tokenHash) throw new Error('UNAUTHORIZED')
  return { email, tokenHash }
}
