import { NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { CSP_REPORT_MAX_BYTES, isSupportedCspContentType, isWithinCspReportLimit, redactDatabaseMessage, reportRecord, sanitizeCspViolation } from '@/lib/server/csp-report-utils'

export const dynamic = 'force-dynamic'

async function readLimitedBody(request: Request) {
  if (!isWithinCspReportLimit(Number(request.headers.get('content-length') ?? 0))) return null
  const reader = request.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (!isWithinCspReportLimit(length)) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, { scope: 'csp-report', limit: 30, windowSeconds: 60 })
  if (limited) return limited
  if (!isSupportedCspContentType(request.headers.get('content-type'))) return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 })
  const body = await readLimitedBody(request)
  if (body === null) return NextResponse.json({ error: 'Report exceeds 8 KB' }, { status: 413 })
  let parsed: unknown
  try { parsed = JSON.parse(body) } catch { return NextResponse.json({ error: 'Invalid report' }, { status: 400 }) }
  const report = reportRecord(parsed)
  if (!report) return NextResponse.json({ ok: true })
  const violation = sanitizeCspViolation(report)
  const blockedValue = String(report['blocked-uri'] ?? report.blockedURL ?? report.blockedURI ?? report.blockedUri ?? '')
  if (!violation.blockedHost) return NextResponse.json({ ok: true })
  try {
    if (new URL(blockedValue).origin === new URL(request.url).origin) return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ ok: true }) }
  let insertError: { code?: string; message?: string } | null = null
  try {
    const { error } = await createAdminClient().from('integration_logs').insert({
      integration_key: 'csp',
      action: 'violation',
      status: 'error',
      latency_ms: 0,
      detail: JSON.stringify(violation),
      created_at: new Date().toISOString(),
    })
    insertError = error
  } catch (error) {
    insertError = error instanceof Error ? { message: error.message } : { message: 'Unknown database error' }
  }
  if (insertError) {
    console.error('[csp-report] Failed to persist a CSP violation', {
      code: insertError.code ?? 'unknown',
      message: redactDatabaseMessage(insertError.message ?? 'Unknown database error'),
    })
    return NextResponse.json({ error: 'Unable to store report' }, { status: 500 })
  }
  return new Response(null, { status: 204 })
}
