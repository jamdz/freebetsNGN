import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'

export const ADMIN_COOKIE = 'freebet_admin_session'
const SESSION_TTL = 2 * 60 * 60 * 1000
const attempts = new Map<string, { failures: number; lockedUntil: number }>()

function secret() { return process.env.ADMIN_SESSION_SECRET || 'development-admin-secret-change-me' }
function sign(value: string) { return createHmac('sha256', secret()).update(value).digest('base64url') }
function validSignature(value: string, signature: string) { const expected = sign(value); return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature)) }

export function adminPath() { const configured = process.env.ADMIN_PATH?.trim() || 'ops-x7k2p'; return `/${configured.replace(/^\/+|\/+$/g, '')}` }
export function isAdminPath(pathname: string) { const configured = adminPath(); return pathname.toLowerCase().startsWith(configured.toLowerCase()) }
export function isLoginLocked(key: string) { const item = attempts.get(key); return Boolean(item && item.lockedUntil > Date.now()) }
export function recordLoginAttempt(key: string, success: boolean) { if (success) { attempts.delete(key); return } const item = attempts.get(key) || { failures: 0, lockedUntil: 0 }; item.failures += 1; if (item.failures >= 5) item.lockedUntil = Date.now() + 15 * 60 * 1000; attempts.set(key, item) }
export async function verifyAdminCredentials(email: string, password: string) { const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase(); const passwordHash = process.env.ADMIN_PASSWORD_HASH; return Boolean(expectedEmail && passwordHash && email.trim().toLowerCase() === expectedEmail && await bcrypt.compare(password, passwordHash)) }
export function createAdminSession(email: string) { const value = `${email.trim().toLowerCase()}.${Date.now()}.${Math.random().toString(36).slice(2)}`; return `${value}.${sign(value)}` }
export function verifyAdminSession(value?: string | null) { if (!value) return false; const parts = value.split('.'); if (parts.length < 4) return false; const timestamp = Number(parts[parts.length - 3]); const signature = parts[parts.length - 1]; const signed = parts.slice(0, -1).join('.'); return Number.isFinite(timestamp) && Date.now() - timestamp < SESSION_TTL && validSignature(signed, signature) }
export async function hasAdminSession() { return verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value) }
export async function requireAdminSession() { if (!(await hasAdminSession())) throw new Error('UNAUTHORIZED') }
export const adminCookieOptions = { httpOnly: true, secure: true, sameSite: 'strict' as const, path: '/', maxAge: SESSION_TTL / 1000 }
