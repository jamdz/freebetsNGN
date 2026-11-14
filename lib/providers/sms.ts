import 'server-only'
import { getIntegration } from '@/lib/server/integrations'
import { getSiteSettings } from '@/lib/server/site-content'

export type SmsSettings = {
  baseUrl: string
  senderId: string
  channel: 'generic' | 'dnd' | 'whatsapp' | 'voice'
  codeLength: 6
  expiryMinutes: number
  resendCooldownSeconds: number
  maxAttempts: number
  maxSendsPerNumberPerDay: number
  lowBalanceThreshold: number
}

async function getSmsConfig() {
  const integration = await getIntegration('sms')
  const settings = integration.publicConfig as Partial<SmsSettings>
  const apiKey = integration.secrets.apiKey
  if (!integration.isActive) throw new Error('SMS delivery is disabled')
  if (typeof settings.baseUrl !== 'string' || typeof apiKey !== 'string' || !settings.senderId) throw new Error('SMS settings are incomplete')
  let baseUrl: URL
  try {
    baseUrl = new URL(settings.baseUrl)
  } catch {
    throw new Error('Enter the base URL provided by your Termii account')
  }
  if (baseUrl.protocol !== 'https:') throw new Error('SMS provider URL must use HTTPS')
  return { settings, apiKey, baseUrl }
}

export async function sendVerificationSms(to: string, code: string, expiryMinutes: number) {
  const [{ settings, apiKey, baseUrl }, site] = await Promise.all([getSmsConfig(), getSiteSettings()])
  const endpoint = new URL('/api/sms/send', baseUrl)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      to,
      from: settings.senderId,
      sms: `Your ${site.siteName} verification code is ${code}. It expires in ${expiryMinutes} minutes. Do not share this code.`,
      channel: settings.channel ?? 'generic',
      type: 'plain',
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || result?.code !== 'ok' && result?.message?.toLowerCase?.().includes('success') !== true) {
    throw new Error(typeof result?.message === 'string' ? result.message : `SMS provider returned HTTP ${response.status}`)
  }
  return result
}

export async function getSmsBalance() {
  const { settings, apiKey, baseUrl } = await getSmsConfig()
  const endpoint = new URL('/api/get-balance', baseUrl)
  endpoint.searchParams.set('api_key', apiKey)
  const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(typeof result?.message === 'string' ? result.message : `SMS provider returned HTTP ${response.status}`)
  return { balance: result?.balance ?? null, currency: result?.currency ?? null, lowBalanceThreshold: Number(settings.lowBalanceThreshold ?? 0) }
}
