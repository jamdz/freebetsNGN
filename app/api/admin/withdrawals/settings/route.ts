import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi, verifyAdminPasswordForRequest } from '@/lib/admin-api'

const keys = ['minAirtimeNaira', 'minCashNaira', 'cashFeeNaira', 'bankAccountChangeCooldownDays', 'minAccountAgeDays', 'paused', 'bankEnabled', 'requireEmailVerified', 'requirePhoneVerified', 'perUserDailyLimitNaira', 'dailyCashCapNaira'] as const
const schema = z.object(Object.fromEntries(keys.map((key) => [key, z.union([z.number().nonnegative(), z.boolean()]).optional()])) as any)

export async function GET() {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const { data, error } = await auth.supabase.from('app_config').select('withdrawal_rules').eq('id', true).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data?.withdrawal_rules ?? {} })
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid settings' }, { status: 400 })
  if (!(await verifyAdminPasswordForRequest((body as Record<string, unknown>).admin_password))) return NextResponse.json({ error: 'Valid admin password required' }, { status: 403 })
  const settingsInput = 'settings' in body && body.settings && typeof body.settings === 'object' ? body.settings : body
  const parsed = schema.safeParse(settingsInput)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid settings' }, { status: 400 })

  const current = await auth.supabase.from('app_config').select('withdrawal_rules').eq('id', true).maybeSingle()
  if (current.error) return NextResponse.json({ error: current.error.message }, { status: 500 })
  const merged = { ...(current.data?.withdrawal_rules ?? {}), ...Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined)) }
  const { error } = await auth.supabase.from('app_config').update({ withdrawal_rules: merged }).eq('id', true)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: merged })
}
