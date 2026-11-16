import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await auth.supabase.from('integration_logs')
    .select('detail,created_at')
    .eq('integration_key', 'csp').eq('action', 'violation').gte('created_at', since)
  if (error) {
    console.error('[ads/blocked-hosts] Failed to read CSP diagnostics', { code: error.code ?? 'unknown' })
    return NextResponse.json({ error: 'Unable to load blocked hosts' }, { status: 500 })
  }
  const groups = new Map<string, { blockedHost: string; directive: string; count: number }>()
  for (const row of data ?? []) {
    let detail: Record<string, unknown> = {}
    try {
      const raw = row.detail
      detail = typeof raw === 'string' ? JSON.parse(raw) : raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
    } catch { continue }
    const blockedHost = typeof detail.blockedHost === 'string' ? detail.blockedHost : ''
    const directive = typeof detail.directive === 'string' ? detail.directive : ''
    if (!blockedHost || !directive) continue
    const key = `${blockedHost}\u0000${directive}`
    const group = groups.get(key) ?? { blockedHost, directive, count: 0 }
    group.count += 1
    groups.set(key, group)
  }
  return NextResponse.json({ groups: [...groups.values()].sort((a, b) => b.count - a.count), hosts: [...new Set([...groups.values()].filter((item) => item.directive.startsWith('script-src')).map((item) => item.blockedHost))] }, { headers: { 'Cache-Control': 'private, no-store' } })
}
