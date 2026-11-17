import assert from 'node:assert/strict'
import test from 'node:test'
import { CSP_REPORT_MAX_BYTES, isSupportedCspContentType, isWithinCspReportLimit, redactDatabaseMessage, reportRecord, sanitizeCspViolation } from '../lib/server/csp-report-utils.ts'
import { isExpectedDiagnosticMessage } from '../lib/ad-diagnostics.ts'

test('accepts valid legacy and JSON CSP report media types', () => {
  assert.equal(isSupportedCspContentType('application/csp-report'), true)
  assert.equal(isSupportedCspContentType('application/json; charset=utf-8'), true)
})

test('accepts reports within the 8 KB limit and rejects oversized reports', () => {
  assert.equal(isWithinCspReportLimit(CSP_REPORT_MAX_BYTES), true)
  assert.equal(isWithinCspReportLimit(CSP_REPORT_MAX_BYTES + 1), false)
})

test('rejects unsupported and missing content types', () => {
  assert.equal(isSupportedCspContentType('text/plain'), false)
  assert.equal(isSupportedCspContentType(null), false)
})

test('normalizes both legacy and Reporting API report objects', () => {
  assert.deepEqual(reportRecord({ 'csp-report': { 'blocked-uri': 'https://ads.example/image' } }), { 'blocked-uri': 'https://ads.example/image' })
  assert.deepEqual(reportRecord([{ body: { 'blocked-uri': 'https://ads.example/image' } }]), { 'blocked-uri': 'https://ads.example/image' })
})

test('ignores malformed report shapes', () => {
  assert.equal(reportRecord(null), null)
  assert.equal(reportRecord({ 'csp-report': [] }), null)
  assert.equal(reportRecord('not a report'), null)
})

test('sanitizes about:blank CSP violations without preserving resource URLs or query parameters', () => {
  const result = sanitizeCspViolation({
    'blocked-uri': 'https://static.nresystems.com/img.gif?publisher=secret&uuid=secret',
    'document-uri': 'about:blank?private=value',
    'effective-directive': 'img-src',
    'source-file': 'https://provider.example/script.js?token=secret',
    'original-policy': "default-src 'self'; img-src 'self'",
    disposition: 'enforce',
    'status-code': 0,
  })
  assert.deepEqual(result, {
    directive: 'img-src', resourceType: 'image', blockedHost: 'static.nresystems.com',
    documentCategory: 'about:blank', sourceFileHost: 'provider.example', policyScope: 'application-policy',
    statusCode: 0, disposition: 'enforce',
  })
  assert.doesNotMatch(JSON.stringify(result), /https:\/\/|publisher=|uuid=|token=|secret/)
})

test('identifies ad-frame policy only when its distinct policy marker is present', () => {
  assert.equal(sanitizeCspViolation({ 'blocked-uri': 'https://cdn.example/a', 'original-policy': "default-src 'none'; img-src https:" }).policyScope, 'ad-frame-policy')
  assert.equal(sanitizeCspViolation({ 'blocked-uri': 'https://cdn.example/a' }).policyScope, 'unknown-policy')
})

test('accepts diagnostic messages only from the expected iframe window', () => {
  const expected = {};
  const valid = { type: 'freebet-ad-diagnostic', stage: 'csp-violation' }
  assert.equal(isExpectedDiagnosticMessage(expected, expected, valid), true)
  assert.equal(isExpectedDiagnosticMessage({}, expected, valid), false)
  assert.equal(isExpectedDiagnosticMessage(expected, expected, { ...valid, type: 'other' }), false)
})

test('redacts URLs, identifiers, quoted values, and long tokens from database diagnostics', () => {
  const output = redactDatabaseMessage('failed https://example.com/path?uuid=abcdefabcdefabcdefabcdefabcdefab "sensitive value" abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef')
  assert.doesNotMatch(output, /https:\/\/|sensitive value|abcdefabcdef/)
  assert.match(output, /\[redacted-url\]/)
  assert.match(redactDatabaseMessage('new row for relation "integration_logs" violates check constraint "integration_logs_status_check"'), /integration_logs_status_check/)
})
