import 'server-only'
import { cookies } from 'next/headers'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const ADMIN_COOKIE = 'freebet_admin_session'
const SESSION_TTL = 2 * 60 * 60 * 1000

type SessionPayload = { email: string; token: string }

function adminConfig() {
  const sessionSecret = process.env.ADMIN_SESSION_SECRET?.trim()
  const path = process.env.ADMIN_PATH?.trim()
  return { valid: Boolean(sessionSecret && sessionSecret.length >= 32 && path), sessionSecret, path }
}

export function isAdminConfigured() { return adminConfig().valid }
function secret() { const configured = adminConfig().sessionSecret; if (!configured) throw new Error('Admin is not configured'); return configured }
function sign(value: string) { return createHmac('sha256', secret()).update(value).digest('base64url') }
function validSignature(value: string, signature: string) {
  const expected = sign(value)
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}
function decode(value?: string | null): SessionPayload | null {
  if (!value || !isAdminConfigured()) return null
  const [payload, signature, ...extra] = value.split('.')
  if (!payload || !signature || extra.length || !validSignature(payload, signature)) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionPayload
    return typeof parsed.email === 'string' && typeof parsed.token === 'string' ? parsed : null
  } catch { return null }
}
function supabase() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}
function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex') }

export function adminPath() { const configured = adminConfig().path; return configured ? `/${configured.replace(/^\/+|\/+$/g, '')}` : null }
export function isAdminPath(pathname: string) { const configured = adminPath(); return Boolean(configured && pathname.toLowerCase().startsWith(configured.toLowerCase())) }
export function getAdminEmail(value?: string | null) { return decode(value)?.email ?? null }
export function getAdminTokenHash(value?: string | null) { const payload = decode(value); return payload ? tokenHash(payload.token) : null }

export async function verifyAdminPassword(password: string) {
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim()
  if (!hash) return false
  try { return await bcrypt.compare(password, hash) } catch { return false }
}

export async function verifyAdminCredentials(email: string, password: string) {
  const normalized = email.trim().toLowerCase()
  const db = supabase()
  const { data: admins, error } = await db.from('admin_users').select('id,email,password_hash,is_active,totp_secret_ciphertext')
  if (error) throw new Error('ADMIN_DATABASE_UNAVAILABLE')
  if (admins?.length) {
    const admin = admins.find((item) => item.email?.toLowerCase() === normalized && item.is_active)
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) return { valid: false as const, email: normalized, admin: null }
    return { valid: true as const, email: admin.email as string, admin }
  }
  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return { valid: Boolean(expectedEmail && normalized === expectedEmail && await verifyAdminPassword(password)), email: normalized, admin: null }
}

export async function verifyReauthPassword(email: string, password: string) {
  const db = supabase()
  const { data: admin, error } = await db.from('admin_users').select('password_hash,is_active').eq('email', email).maybeSingle()
  if (error) return false
  if (admin?.is_active) {
    try { return await bcrypt.compare(password, admin.password_hash) } catch { return false }
  }
  if (admin) return false
  return email.toLowerCase() === process.env.ADMIN_EMAIL?.trim().toLowerCase() && verifyAdminPassword(password)
}

export async function createAdminSession(email: string, request: Request) {
  const token = randomBytes(32).toString('base64url')
  const hash = tokenHash(token)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  const userAgent = request.headers.get('user-agent')?.slice(0, 512) || null
  const now = new Date().toISOString()
  const { error } = await supabase().from('admin_sessions').insert({ token_hash: hash, ip, user_agent: userAgent, created_at: now, last_seen_at: now })
  if (error) throw new Error('ADMIN_SESSION_CREATE_FAILED')
  const payload = Buffer.from(JSON.stringify({ email: email.trim().toLowerCase(), token })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export async function revokeAdminSession(value?: string | null) {
  const payload = decode(value)
  if (!payload) return
  await supabase().from('admin_sessions').update({ revoked_at: new Date().toISOString() }).eq('token_hash', tokenHash(payload.token)).is('revoked_at', null)
}

export async function verifyAdminSession(value?: string | null) {
  const payload = decode(value)
  if (!payload) return false
  const hash = tokenHash(payload.token)
  const db = supabase()
  const { data: admins, error: adminsError } = await db.from('admin_users').select('email,is_active')
  if (adminsError) return false
  if (admins?.length) {
    if (!admins.some((admin) => admin.is_active && admin.email?.toLowerCase() === payload.email.toLowerCase())) return false
  } else if (payload.email !== process.env.ADMIN_EMAIL?.trim().toLowerCase()) return false
  const { data: session, error } = await db.from('admin_sessions').select('id,last_seen_at,revoked_at').eq('token_hash', hash).maybeSingle()
  if (error || !session || session.revoked_at) return false
  const lastSeen = Date.parse(session.last_seen_at)
  if (!Number.isFinite(lastSeen) || Date.now() - lastSeen > SESSION_TTL) {
    await db.from('admin_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', session.id)
    return false
  }
  const { error: updateError } = await db.from('admin_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', session.id).is('revoked_at', null)
  return !updateError
}

export async function hasAdminSession() { return verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value) }
export async function requireAdminSession() { if (!(await hasAdminSession())) throw new Error('UNAUTHORIZED') }
export const adminCookieOptions = { httpOnly: true, secure: true, sameSite: 'strict' as const, path: '/', maxAge: 30 * 24 * 60 * 60 }
