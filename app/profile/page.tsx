'use client'
import { AppShell } from '@/components/freebet/app-shell'
import { useAuth } from '@/components/auth-provider'
import { QualificationTracker } from '@/components/freebet/qualification-tracker'
export default function ProfilePage() { const { user, signOut } = useAuth(); return <AppShell><section className="rounded-3xl border border-border bg-card p-6"><p className="text-sm font-medium text-primary">Your account</p><h1 className="mt-1 font-display text-3xl font-black">Profile</h1><p className="mt-3 text-muted-foreground">{user?.nickname || 'Player'} · {user?.phone || 'No phone number'}</p><div className="mt-6"><QualificationTracker compact /></div><button onClick={signOut} className="mt-6 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground">Log out</button></section></AppShell> }
