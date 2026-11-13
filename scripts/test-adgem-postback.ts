import assert from 'node:assert/strict'
// @ts-expect-error Node 24 runs this script with native TypeScript stripping; tsc does not emit scripts.
import { buildAdgemPostbackUrl, processAdgemPostback } from '../lib/server/adgem-postback.ts'

const siteUrl = 'https://freebets.example'
const secret = 'test-only-adgem-key'
const playerId = '4f3e997b-2b43-4b36-9a63-ccb20f23a701'
const baseValues = {
  player_id: playerId,
  payout: '1.50',
  amount: '105',
  transaction_id: 'conversion-test-1',
  request_id: 'b56ca52e-56ca-4253-91f7-87c17877298e',
  campaign_id: 'campaign-test-1',
}
const settings = { fxRate: 1500, rewardShare: 70, holdDays: 7 }
type ProcessOverrides = Partial<Parameters<typeof processAdgemPostback>[1]>

async function verify(url: string, overrides: ProcessOverrides = {}) {
  return processAdgemPostback(url, {
    siteUrl,
    secret,
    offerwall: settings,
    isActiveProfile: async () => true,
    applyOfferPostback: async () => ({ duplicate: false }),
    ...overrides,
  })
}

async function main() {
  const validUrl = buildAdgemPostbackUrl(siteUrl, baseValues, secret)
  const valid = await verify(validUrl)
  assert.equal(valid.status, 200)
  assert.equal(valid.body, 'OK')
  console.log('PASS correct verifier is accepted')

  const changedPayoutUrl = validUrl.replace('payout=1.50', 'payout=9.50')
  const changedPayout = await verify(changedPayoutUrl)
  assert.equal(changedPayout.status, 422)
  assert.equal(changedPayout.reason, 'invalid_verifier')
  console.log('PASS changed payout is rejected')

  const missingVerifierUrl = validUrl.replace(/&verifier=[0-9a-f]+$/i, '')
  const missingVerifier = await verify(missingVerifierUrl)
  assert.equal(missingVerifier.status, 422)
  assert.equal(missingVerifier.reason, 'missing_verifier')
  console.log('PASS missing verifier is rejected')

  const creditedTransactions = new Set<string>()
  let creditedCount = 0
  const mockRpc: NonNullable<Parameters<typeof processAdgemPostback>[1]['applyOfferPostback']> = async (args) => {
    if (creditedTransactions.has(args.p_external_id)) return { duplicate: true }
    creditedTransactions.add(args.p_external_id)
    creditedCount += 1
    return { duplicate: false }
  }
  const first = await verify(validUrl, { applyOfferPostback: mockRpc })
  const retryValues = { ...baseValues, request_id: '31fb04f8-20a8-4d97-9e5c-6ce0818f31a8' }
  const retryUrl = buildAdgemPostbackUrl(siteUrl, retryValues, secret)
  const retry = await verify(retryUrl, { applyOfferPostback: mockRpc })
  assert.equal(first.status, 200)
  assert.equal(retry.status, 200)
  assert.equal(retry.reason, 'duplicate')
  assert.equal(creditedCount, 1)
  console.log('PASS duplicate transaction is credited once with the mocked RPC')

  console.log('4/4 AdGem postback checks passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
