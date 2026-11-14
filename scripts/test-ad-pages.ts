import assert from 'node:assert/strict'
// @ts-expect-error Node 24 runs this standalone TypeScript test directly.
import { adPageFromPath, isValidPublicFormPlacement } from '../lib/ad-settings.ts'

const paths: Array<[string, string | null]> = [
  ['/', 'Landing'],
  ['/login', 'Login'],
  ['/signup', 'Signup'],
  ['/terms', 'Terms'],
  ['/privacy', 'Privacy'],
  ['/prize-rules', 'PrizeRules'],
  ['/responsible-play', 'ResponsiblePlay'],
  ['/verify', null],
  ['/verify/email', null],
  ['/forgot-password', null],
  ['/reset-password', null],
  ['/auth/callback', null],
  ['/join', null],
]

for (const [path, expected] of paths) {
  assert.equal(adPageFromPath(path), expected, `${path} maps to ${expected ?? 'excluded'}`)
  console.log(`PASS ${path} maps to ${expected ?? 'excluded'}`)
}

assert.equal(isValidPublicFormPlacement('Login', [
  { position: 'bottom', network: 'A-ADS', size: '728x90' },
  { position: 'bottom', network: 'A-ADS', size: '728x90' },
]), false)
console.log('PASS Login placement with 2 slots is rejected')
assert.equal(isValidPublicFormPlacement('Login', [{ position: 'top', network: 'A-ADS', size: '728x90' }]), false)
console.log('PASS Login placement with position top is rejected')
assert.equal(isValidPublicFormPlacement('Login', [{ position: 'bottom', network: 'A-ADS', size: '728x90' }]), true)
console.log('PASS Login placement with one bottom slot is accepted')
