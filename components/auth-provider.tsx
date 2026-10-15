'use client'
import { createContext, useContext, useState } from 'react'
import { useRouter } from 'next/navigation'

type Credentials = { nickname?: string; phone?: string; password?: string; referralCode?: string }
type AuthContextValue = { user: Credentials | null; signUp: (data: Credentials) => void; signIn: (data: Credentials) => void; signOut: () => void; verifyOtp: (otp: string) => boolean }
const AuthContext = createContext<AuthContextValue | null>(null)
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Credentials | null>(null)
  const router = useRouter()
  const signUp = (data: Credentials) => { setUser(data); sessionStorage.setItem('freebet-user', JSON.stringify(data)); router.push('/verify') }
  const signIn = (data: Credentials) => { setUser(data); sessionStorage.setItem('freebet-user', JSON.stringify(data)); router.push('/dashboard') }
  const signOut = () => { setUser(null); sessionStorage.removeItem('freebet-user'); router.push('/login') }
  const verifyOtp = (otp: string) => { if (otp === '123456') { router.push('/dashboard'); return true } return false }
  return <AuthContext.Provider value={{ user, signUp, signIn, signOut, verifyOtp }}>{children}</AuthContext.Provider>
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used within AuthProvider'); return context }
