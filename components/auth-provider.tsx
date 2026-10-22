'use client'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { lagosDate } from '@/lib/dates'

type Credentials = { id?: string; email?: string; nickname?: string; phone?: string; password?: string; rewardBalanceNaira?: number; referralCode?: string; emailVerified?: boolean; phoneVerified?: boolean; status?: string; streakCount?: number }
type AuthContextValue = { user: Credentials | null; ready: boolean; signUp: (data: Credentials) => Promise<void>; signIn: (data: Credentials) => Promise<boolean>; signOut: () => Promise<void>; verifyOtp: (otp: string) => Promise<boolean>; verifyEmail: () => Promise<void>; resetPassword: (phone: string, password: string) => Promise<boolean> }
const AuthContext = createContext<AuthContextValue | null>(null)
const publicRoutes = ['/', '/login', '/signup', '/verify', '/forgot-password', '/terms', '/privacy', '/prize-rules', '/responsible-play']

async function loadStatus() {
  const response = await fetch('/api/auth/status', { cache: 'no-store' })
  if (!response.ok) return null
  const { user } = await response.json()
  return { ...user, emailVerified: user.email_verified, phoneVerified: user.phone_verified, streakCount: user.streak_count }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Credentials | null>(null)
  const [ready, setReady] = useState(false)
  const router = useRouter(); const pathname = usePathname(); const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const getSupabase = () => { if (!supabaseRef.current) supabaseRef.current = createClient(); return supabaseRef.current }
  const refreshUser = async () => { const next = await loadStatus(); setUser(next); return next }
  useEffect(() => { let mounted = true; getSupabase().auth.getSession().then(async ({ data }) => { if (mounted && data.session) await refreshUser(); if (mounted) setReady(true) }); const { data: subscription } = getSupabase().auth.onAuthStateChange(async (event, session) => { if (!mounted) return; if (session) await refreshUser(); else setUser(null); setReady(true) }); return () => { mounted = false; subscription.subscription.unsubscribe() } }, [])
  useEffect(() => { if (!ready) return; const isPublic = publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`)); const isAdminRoute = /^\/freebetngn\/folder\/admin(?:\/|$)/i.test(pathname); if (!user && !isPublic && !isAdminRoute) router.replace('/login'); if (user && ['/login','/signup'].includes(pathname)) router.replace('/home') }, [pathname, ready, user, router])
  const recordVisit = () => { const key = `freebet-visit-${lagosDate(new Date())}`; if (sessionStorage.getItem(key)) return; void fetch('/api/visit', { method: 'POST' }).then((response) => { if (response.ok) sessionStorage.setItem(key, '1') }) }
  const signUp = async (data: Credentials) => { const { error } = await getSupabase().auth.signUp({ email: data.email!, password: data.password!, options: { emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`, data: { nickname: data.nickname, phone: data.phone, referralCode: data.referralCode || null } } }); if (error) throw new Error(error.message.includes('rate') ? 'Too many attempts. Please try again later.' : 'Unable to create account. Check your details and try again.'); router.push('/verify') }
  const signIn = async (data: Credentials) => { const resolve = await fetch('/api/auth/resolve-identifier', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: data.nickname }) }); if (!resolve.ok) return false; const details = await resolve.json(); if (details.status === 'banned' || details.status === 'suspended') return false; const { error } = await getSupabase().auth.signInWithPassword({ email: details.email, password: data.password! }); if (error) return false; const next = await refreshUser(); if (!next) { await getSupabase().auth.signOut(); return false } recordVisit(); router.push('/home'); return true }
  const signOut = async () => { await getSupabase().auth.signOut(); setUser(null); router.replace('/login') }
  const verifyOtp = async (otp: string) => { if (otp !== '123456') return false; const response = await fetch('/api/auth/verify-phone', { method: 'POST' }); if (!response.ok) return false; await refreshUser(); router.push('/home'); return true }
  const verifyEmail = async () => { await refreshUser() }
  const resetPassword = async () => false
  const value = useMemo(() => ({ user, ready, signUp, signIn, signOut, verifyOtp, verifyEmail, resetPassword }), [user, ready])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used within AuthProvider'); return context }
