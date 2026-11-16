import assert from 'node:assert/strict'
import test from 'node:test'
import { CSP_REPORT_MAX_BYTES, isSupportedCspContentType, isWithinCspReportLimit, redactDatabaseMessage, reportRecord } from '../lib/server/csp-report-utils.ts'

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

test('redacts URLs, identifiers, quoted values, and long tokens from database diagnostics', () => {
  const output = redactDatabaseMessage('failed https://example.com/path?uuid=abcdefabcdefabcdefabcdefabcdefab "sensitive value" abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef')
  assert.doesNotMatch(output, /https:\/\/|sensitive value|abcdefabcdef/)
  assert.match(output, /\[redacted-url\]/)
  assert.match(redactDatabaseMessage('new row for relation "integration_logs" violates check constraint "integration_logs_status_check"'), /integration_logs_status_check/)
})
