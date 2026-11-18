import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { ADMIN_COOKIE, getAdminEmail, isAdminConfigured, verifyAdminSession, verifyReauthPassword } from '@/lib/admin-auth'
import { securityDb } from '@/lib/admin-security'
import { buildPagination, parsePagination } from '@/lib/admin-pagination'

async function authorized(password: unknown, request: Request) {
  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value
  const email = getAdminEmail(cookie)
  if (!isAdminConfigured(request) || !(await verifyAdminSession(cookie, request)) || typeof password !== 'string' || !email || !(await verifyReauthPassword(email, password, request))) return null
  return { email }
}

export async function GET(request: Request) {
  const identity = await authorized(request.headers.get('x-admin-password'), request)
  if (!identity) return NextResponse.json({ error: 'Re-authentication required' }, { status: 403 })
  const { page, pageSize, from, to } = parsePagination(new URL(request.url).searchParams, { defaultSize: 10, allowed: [10, 25, 50] })
  const { data, count, error } = await securityDb().from('admin_users').select('id,email,is_active,created_at,totp_secret_ciphertext', { count: 'exact' }).order('created_at', { ascending: true }).range(from, to)
  if (error) return NextResponse.json({ error: 'Unable to load administrators' }, { status: 500 })
  const items = (data ?? []).map(({ totp_secret_ciphertext: totp, ...admin }) => ({ ...admin, totp_enabled: Boolean(totp) }))
  return NextResponse.json({ items, pagination: buildPagination(page, pageSize, count ?? 0) })
}

const createSchema = z.object({ email: z.string().email().max(254), password: z.string().min(12).max(128), admin_password: z.string().min(1) })
export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Valid email and password (at least 12 characters) are required' }, { status: 400 })
  const identity = await authorized(parsed.data.admin_password, request)
  if (!identity) return NextResponse.json({ error: 'Re-authentication required' }, { status: 403 })
  const { email, password } = parsed.data
  const db = securityDb()
  const { data, error } = await db.from('admin_users').insert({ email: email.trim().toLowerCase(), password_hash: await bcrypt.hash(password, 12), is_active: true }).select('id,email,is_active,created_at').single()
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'An administrator with this email already exists' : 'Unable to create administrator' }, { status: error.code === '23505' ? 409 : 500 })
  await db.from('audit_log').insert({ action: 'admin_created', entity: 'admin', entity_id: data.id, details: { admin_email: identity.email, target_email: data.email } })
  return NextResponse.json({ admin: data }, { status: 201 })
}

const patchSchema = z.object({ id: z.string().uuid(), is_active: z.boolean().optional(), password: z.string().min(12).max(128).optional(), admin_password: z.string().min(1) }).refine((value) => value.is_active !== undefined || Boolean(value.password), 'An update is required')
export async function PATCH(request: Request) {
  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid administrator update' }, { status: 400 })
  const identity = await authorized(parsed.data.admin_password, request)
  if (!identity) return NextResponse.json({ error: 'Re-authentication required' }, { status: 403 })
  const { id, password, is_active } = parsed.data
  if (is_active === false) {
    const { data: target } = await securityDb().from('admin_users').select('email').eq('id', id).maybeSingle()
    if (target?.email?.toLowerCase() === identity.email.toLowerCase()) return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 })
  }
  const updates: Record<string, unknown> = {}
  if (is_active !== undefined) updates.is_active = is_active
  if (password) updates.password_hash = await bcrypt.hash(password, 12)
  const { error } = await securityDb().from('admin_users').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: 'Unable to update administrator' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
