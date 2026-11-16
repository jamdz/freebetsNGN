import { NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function readLimitedBody(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 8192) return null
  const reader = request.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > 8192) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

function reportRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) value = value[0]
  if (!value || typeof value !== 'object') return null
  const wrapper = value as Record<string, unknown>
  const report = wrapper['csp-report'] ?? wrapper
  return report && typeof report === 'object' && !Array.isArray(report) ? report as Record<string, unknown> : null
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, { scope: 'csp-report', limit: 30, windowSeconds: 60 })
  if (limited) return limited
  const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
  if (contentType !== 'application/csp-report' && contentType !== 'application/json') return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 })
  const body = await readLimitedBody(request)
  if (body === null) return NextResponse.json({ error: 'Report exceeds 8 KB' }, { status: 413 })
  let parsed: unknown
  try { parsed = JSON.parse(body) } catch { return NextResponse.json({ error: 'Invalid report' }, { status: 400 }) }
  const report = reportRecord(parsed)
  if (!report) return NextResponse.json({ ok: true })
  const blocked = String(report['blocked-uri'] ?? report.blockedURI ?? report.blockedUri ?? '')
  const directive = String(report['effective-directive'] ?? report['violated-directive'] ?? report.effectiveDirective ?? report.violatedDirective ?? 'unknown')
  const documentUri = String(report['document-uri'] ?? report.documentURL ?? report.documentUri ?? '')
  if (!blocked || /^(?:inline|eval|self|data|blob)(?::|$)/i.test(blocked)) return NextResponse.json({ ok: true })
  let blockedHost: string
  let path = '/'
  try {
    const blockedUrl = new URL(blocked)
    if (blockedUrl.origin === new URL(request.url).origin) return NextResponse.json({ ok: true })
    blockedHost = blockedUrl.hostname
  } catch { return NextResponse.json({ ok: true }) }
  try { path = new URL(documentUri).pathname } catch { /* Keep the default path. */ }
  const { error } = await createAdminClient().from('integration_logs').insert({
    integration_key: 'csp',
    action: 'violation',
    status: 'blocked',
    latency_ms: 0,
    detail: { directive, blockedHost, path },
    created_at: new Date().toISOString(),
  })
  if (error) {
    console.error('[csp-report] Failed to persist a CSP violation', { code: error.code ?? 'unknown' })
    return NextResponse.json({ error: 'Unable to store report' }, { status: 500 })
  }
  return new Response(null, { status: 204 })
}
