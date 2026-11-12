import 'server-only'
import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type RateLimitPolicy = { scope: string; limit: number; windowSeconds: number }

export async function enforceRateLimit(request: Request, policy: RateLimitPolicy, subjectId?: string) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const clientIp = request.headers.get('x-real-ip')?.trim() || forwardedFor?.split(',').at(-1)?.trim() || 'unknown'
  const subjects = [`ip:${clientIp}`, ...(subjectId ? [`subject:${subjectId}`] : [])]
  const db = createAdminClient()

  for (const subject of subjects) {
    const keyHash = createHash('sha256').update(`${policy.scope}:${subject}`).digest('hex')
    const { data, error } = await db.rpc('consume_rate_limit', {
      p_key_hash: keyHash,
      p_limit: policy.limit,
      p_window_seconds: policy.windowSeconds,
    })
    if (error || !data) {
      return NextResponse.json({ error: 'Request protection is temporarily unavailable' }, { status: 503 })
    }
    const result = Array.isArray(data) ? data[0] : data
    if (!result?.allowed) {
      const retryAfter = Math.max(1, Number(result?.retry_after_seconds ?? policy.windowSeconds))
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfterSeconds: retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      )
    }
  }

  return null
}
