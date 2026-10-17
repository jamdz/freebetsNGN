'use client'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

type Credentials = { id?: string; email?: string; nickname?: string; phone?: string; password?: string; rewardBalanceNaira?: number; referralCode?: string }
type AuthContextValue = { user: Credentials | null; ready: boolean; signUp: (data: Credentials) => void; signIn: (data: Credentials) => boolean; signOut: () => void; verifyOtp: (otp: string) => boolean; resetPassword: (phone: string, password: string) => boolean }
const AuthContext = createContext<AuthContextValue | null>(null)
const USER_KEY = 'freebet-user'
const USERS_KEY = 'freebet-users'
const read = <T,>(key: string, fallback: T): T => { try { return JSON.parse(sessionStorage.getItem(key) || JSON.stringify(fallback)) } catch { return fallback } }
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Credentials | null>(null)
  const [ready, setReady] = useState(false)
  const router = useRouter(); const pathname = usePathname()
  useEffect(() => { setUser(read<Credentials | null>(USER_KEY, null)); setReady(true) }, [])
  useEffect(() => { if (!ready) return; const publicRoutes = ['/', '/login', '/signup', '/verify', '/forgot-password', '/terms', '/privacy', '/prize-rules', '/responsible-play']; const isPublic = publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`)); if (!user && !isPublic) router.replace('/login'); if (user && ['/login','/signup'].includes(pathname)) router.replace('/home') }, [pathname, ready, user, router])
  const save = (next: Credentials | null) => { setUser(next); if (next) sessionStorage.setItem(USER_KEY, JSON.stringify(next)); else sessionStorage.removeItem(USER_KEY) }
  const signUp = (data: Credentials) => { const next = { ...data, id: `u_${Date.now()}`, rewardBalanceNaira: 1250 }; const users = read<Credentials[]>(USERS_KEY, []); sessionStorage.setItem(USERS_KEY, JSON.stringify([...users, next])); save(next); router.push('/verify') }
  const signIn = (data: Credentials) => { const identifier = (data.nickname || '').trim().toLowerCase(); const found = read<Credentials[]>(USERS_KEY, []).find((item) => (item.nickname || '').toLowerCase() === identifier || item.phone === data.nickname); if (!found || found.password !== data.password) return false; save(found); router.push('/home'); return true }
  const signOut = () => { save(null); router.replace('/login') }
  const verifyOtp = (otp: string) => { if (otp !== '123456') return false; router.push('/home'); return true }
  const resetPassword = (phone: string, password: string) => { const users = read<Credentials[]>(USERS_KEY, []); const index = users.findIndex((item) => item.phone === phone); if (index < 0) return false; users[index] = { ...users[index], password }; sessionStorage.setItem(USERS_KEY, JSON.stringify(users)); return true }
  const value = useMemo(() => ({ user, ready, signUp, signIn, signOut, verifyOtp, resetPassword }), [user, ready])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used within AuthProvider'); return context }
