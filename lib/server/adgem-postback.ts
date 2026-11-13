import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

export const ADGEM_POSTBACK_PATH = '/api/postbacks/adgem'

const decimalString = z.string().trim().regex(/^(?:\d+(?:\.\d*)?|\.\d+)$/).transform(Number).refine(Number.isFinite)
const amountString = z.string().trim().transform((value) => value === '' || value.toLowerCase() === 'null' ? null : value).pipe(
  z.union([z.null(), z.string().regex(/^(?:\d+(?:\.\d*)?|\.\d+)$/).transform(Number).refine(Number.isFinite)]),
)
const requiredText = z.string().trim().min(1).max(200)
const postbackSchema = z.object({
  player_id: z.string().uuid(),
  payout: decimalString,
  amount: amountString,
  transaction_id: requiredText,
  request_id: requiredText,
  campaign_id: requiredText,
})

export type AdgemPostbackPayload = z.infer<typeof postbackSchema>
export type AdgemCreditArguments = {
  p_provider: 'adgem'
  p_external_id: string
  p_user_id: string
  p_payout_usd: number
  p_naira: number
  p_hold_days: number
  p_signature_ok: true
  p_payload: {
    player_id: string
    payout: number
    amount: number | null
    transaction_id: string
    request_id: string
    campaign_id: string
  }
}

type OfferwallSettings = {
  fxRate?: number
  rewardShare?: number
  holdDays?: number
}

type ProcessOptions = {
  siteUrl: string
  secret: string | undefined
  testOnly?: boolean
  offerwall?: OfferwallSettings
  isActiveProfile?: (playerId: string) => Promise<boolean>
  applyOfferPostback?: (args: AdgemCreditArguments) => Promise<{ duplicate?: boolean }>
}

export type AdgemPostbackResult = {
  status: number
  body: string
  success: boolean
  signatureOk: boolean
  reason: string
}

function result(status: number, body: string, reason: string, signatureOk = false): AdgemPostbackResult {
  return { status, body, success: status >= 200 && status < 300, signatureOk, reason }
}

function extractRawQuery(url: string) {
  const queryIndex = url.indexOf('?')
  return queryIndex < 0 ? '' : url.slice(queryIndex + 1).split('#', 1)[0]
}

function decodeFormPart(value: string) {
  return decodeURIComponent(value.replace(/\+/g, ' '))
}

function removeVerifier(rawQuery: string): { verifier: string | null; query: string } | null {
  const kept: string[] = []
  let verifier: string | null = null
  let verifierCount = 0

  for (const segment of rawQuery.split('&')) {
    const equalsIndex = segment.indexOf('=')
    let key: string
    try {
      key = decodeFormPart(equalsIndex < 0 ? segment : segment.slice(0, equalsIndex))
    } catch {
      return null
    }

    if (key !== 'verifier') {
      kept.push(segment)
      continue
    }

    verifierCount += 1
    try {
      verifier = decodeFormPart(equalsIndex < 0 ? '' : segment.slice(equalsIndex + 1))
    } catch {
      return null
    }
  }

  if (verifierCount !== 1) return { verifier: null, query: kept.join('&') }
  return { verifier, query: kept.join('&') }
}

function verifierMatches(expected: string, received: string) {
  if (!/^[\da-f]{64}$/i.test(received)) return false
  const expectedBuffer = Buffer.from(expected, 'utf8')
  const receivedBuffer = Buffer.from(received.toLowerCase(), 'utf8')
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer)
}

export function buildAdgemPostbackUrl(siteUrl: string, values: {
  player_id: string
  payout: string | number
  amount: string | number | null
  transaction_id: string
  request_id: string
  campaign_id: string
}, secret: string) {
  const origin = new URL(siteUrl).origin
  const query = new URLSearchParams([
    ['player_id', values.player_id],
    ['payout', String(values.payout)],
    ['amount', String(values.amount)],
    ['transaction_id', values.transaction_id],
    ['campaign_id', values.campaign_id],
    // AdGem v2 appends this UUID when postback hashing is enabled; this helper builds the resulting signed request.
    ['request_id', values.request_id],
  ]).toString()
  const unsignedUrl = `${origin}${ADGEM_POSTBACK_PATH}?${query}`
  const verifier = createHmac('sha256', secret).update(unsignedUrl, 'utf8').digest('hex')
  return `${unsignedUrl}&verifier=${verifier}`
}

export async function processAdgemPostback(requestUrl: string, options: ProcessOptions): Promise<AdgemPostbackResult> {
  const { siteUrl, secret } = options
  let request: URL
  let origin: string
  try {
    request = new URL(requestUrl)
    origin = new URL(siteUrl).origin
  } catch {
    return result(422, 'Error: postback URL is unavailable', 'invalid_site_url')
  }

  if (request.pathname !== ADGEM_POSTBACK_PATH) return result(404, 'Not found', 'wrong_path')
  if (!secret?.trim()) return result(422, 'Error: postback key is not configured', 'missing_key')

  const rawQuery = extractRawQuery(requestUrl)
  const stripped = removeVerifier(rawQuery)
  if (!stripped) return result(422, 'Error: invalid verifier', 'invalid_query')

  const parameters = new URLSearchParams(rawQuery)
  const requiredKeys = ['player_id', 'payout', 'amount', 'transaction_id', 'request_id', 'campaign_id'] as const
  if (requiredKeys.some((key) => parameters.getAll(key).length !== 1)) {
    return result(400, 'Error: invalid postback parameters', 'invalid_parameters')
  }

  const parsed = postbackSchema.safeParse(Object.fromEntries(requiredKeys.map((key) => [key, parameters.get(key)])))
  if (!parsed.success) return result(400, 'Error: invalid postback parameters', 'invalid_parameters')
  const payload = parsed.data
  if (!stripped.verifier) return result(422, 'Error: missing verifier', 'missing_verifier')

  const signedUrl = `${origin}${request.pathname}${stripped.query ? `?${stripped.query}` : ''}`
  const expected = createHmac('sha256', secret).update(signedUrl, 'utf8').digest('hex')
  if (!verifierMatches(expected, stripped.verifier)) return result(422, 'Error: invalid verifier', 'invalid_verifier')

  if (options.testOnly) return result(200, 'OK', 'test_verified', true)
  if (!options.isActiveProfile || !options.applyOfferPostback) {
    return result(500, 'Error: postback processing is unavailable', 'processing_unavailable', true)
  }

  let activeProfile: boolean
  try {
    activeProfile = await options.isActiveProfile(payload.player_id)
  } catch {
    return result(500, 'Error: unable to validate player', 'profile_lookup_failed', true)
  }
  if (!activeProfile) return result(400, 'Error: player is not active', 'inactive_player', true)

  const fxRate = Number.isFinite(options.offerwall?.fxRate) ? Math.max(0, options.offerwall!.fxRate!) : 1
  const rewardShare = Number.isFinite(options.offerwall?.rewardShare) ? Math.min(100, Math.max(0, options.offerwall!.rewardShare!)) : 70
  const holdDays = Number.isFinite(options.offerwall?.holdDays) ? Math.min(365, Math.max(0, Math.floor(options.offerwall!.holdDays!))) : 7
  const naira = Math.floor(payload.payout * fxRate * (rewardShare / 100))
  if (!Number.isSafeInteger(naira) || naira < 0) return result(503, 'Error: offerwall settings are invalid', 'invalid_offerwall_settings', true)

  const rpcArguments: AdgemCreditArguments = {
    p_provider: 'adgem',
    p_external_id: payload.transaction_id,
    p_user_id: payload.player_id,
    p_payout_usd: payload.payout,
    p_naira: naira,
    p_hold_days: holdDays,
    p_signature_ok: true,
    p_payload: {
      player_id: payload.player_id,
      payout: payload.payout,
      amount: payload.amount,
      transaction_id: payload.transaction_id,
      request_id: payload.request_id,
      campaign_id: payload.campaign_id,
    },
  }

  try {
    const applied = await options.applyOfferPostback(rpcArguments)
    return result(200, 'OK', applied.duplicate ? 'duplicate' : 'credited', true)
  } catch {
    return result(500, 'Error: unable to apply postback', 'credit_failed', true)
  }
}
