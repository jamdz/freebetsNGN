import { createAdminClient } from '@/lib/supabase/admin'
import { decryptSecrets, encryptSecrets } from './secrets'

export async function getIntegration(key: string) {
  const { data, error } = await createAdminClient().from('integration_settings').select('key,public_config,secret_ciphertext,is_active').eq('key', key).maybeSingle()
  if (error) throw error
  return { publicConfig: data?.public_config ?? {}, secrets: data?.secret_ciphertext ? decryptSecrets(data.secret_ciphertext) : {}, isActive: Boolean(data?.is_active) }
}

export async function saveIntegration(key: string, input: { publicConfig: Record<string, unknown>; secrets?: Record<string, unknown>; isActive: boolean }, adminEmail: string) {
  const db = createAdminClient(); const existing = await getIntegration(key); const merged = { ...existing.secrets }
  for (const [name, value] of Object.entries(input.secrets ?? {})) if (typeof value === 'string' ? value.trim() : value !== undefined && value !== null) merged[name] = value
  const secretCiphertext = Object.keys(merged).length ? encryptSecrets(merged) : null
  const { error } = await db.from('integration_settings').upsert({ key, public_config: input.publicConfig, secret_ciphertext: secretCiphertext, is_active: input.isActive, updated_by: adminEmail, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
}

export function maskedHints(secrets: Record<string, unknown>) { return Object.fromEntries(Object.entries(secrets).filter(([, value]) => value !== undefined && value !== null && String(value)).map(([name, value]) => [name, `••••${String(value).slice(-4)}`])) }
