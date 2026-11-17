import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [route, visitorSlots, pageSlots, adminPanel] = await Promise.all([
  readFile(new URL('../app/ad-frame/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../components/ads/PageAdSlots.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/ads/AdManager.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/admin/ads-offers-panel.tsx', import.meta.url), 'utf8'),
])

test('ad-frame responses use the narrow standalone CSP and remain private and non-cacheable', () => {
  assert.match(route, /'Content-Security-Policy':\s*"default-src 'none';[^"]*img-src https: data:/)
  assert.match(route, /'Cache-Control':\s*'private, no-store, max-age=0, must-revalidate'/)
  assert.match(route, /headers:\s*\{\s*\.\.\.securityHeaders,\s*'Cache-Control':\s*'private, no-store'\s*\}/)
  assert.match(route, /new Response\(null,\s*\{\s*status:\s*204,\s*headers:\s*securityHeaders\s*\}\)/)
  assert.doesNotMatch(route, /static\.nresystems\.com/)
})

test('visitor ad frames keep the existing restrictive sandbox attributes', () => {
  for (const source of [visitorSlots, pageSlots, adminPanel]) {
    assert.match(source, /sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"/)
    assert.doesNotMatch(source, /allow-same-origin/)
  }
})

test('diagnostic frame remains gated by consent and admin authorization', () => {
  assert.match(route, /const debug = params\.get\('debug'\) === '1' && hasAdConsent && await hasAdminSession\(\)/)
  assert.match(route, /if \(!hasAdConsent\) return empty\(false\)/)
})
