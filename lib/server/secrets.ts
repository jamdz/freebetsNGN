import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

function key() {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY
  if (raw) {
    const value = Buffer.from(raw, 'base64')
    if (value.length !== 32) throw new Error('INTEGRATION_ENCRYPTION_KEY must be base64-encoded 32 bytes')
    return value
  }
  const adminSecret = process.env.ADMIN_SESSION_SECRET
  if (!adminSecret || adminSecret.length < 32) throw new Error('An existing 32-character encryption secret is required')
  return Buffer.from(hkdfSync('sha256', Buffer.from(adminSecret), Buffer.from('freebetngn'), Buffer.from('admin-totp-secrets'), 32))
}

export function encryptSecrets(value: Record<string, unknown>) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')
}

export function decryptSecrets(ciphertext: string): Record<string, unknown> {
  const payload = Buffer.from(ciphertext, 'base64')
  if (payload.length < 28) throw new Error('Invalid encrypted integration secret')
  const decipher = createDecipheriv('aes-256-gcm', key(), payload.subarray(0, 12))
  decipher.setAuthTag(payload.subarray(12, 28))
  return JSON.parse(Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8'))
}
