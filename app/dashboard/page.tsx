'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/freebet/app-shell'
export default function DashboardPage(){ const router=useRouter(); useEffect(()=>{if(!sessionStorage.getItem('freebet-user'))router.replace('/login')},[router]); return <AppShell><div className="rounded-3xl border border-border bg-card p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Your dashboard</p><h1 className="mt-2 font-display text-4xl font-black">Matchday starts here.</h1><p className="mt-3 text-muted-foreground">Your fixtures and leaderboard will appear here after you verify your number.</p></div></AppShell> }
