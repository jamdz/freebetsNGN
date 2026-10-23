'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { AppShell } from '@/components/freebet/app-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/components/auth-provider'

const fetcher = (url: string) => fetch(url).then(async (response) => { if (!response.ok) throw new Error('Unable to load profile'); return response.json() })
const monthKey = (value: string) => value.slice(0, 7)

export default function ProfilePage() {
  const { signOut } = useAuth()
  const { data, error, isLoading, mutate } = useSWR('/api/read-model?resource=profile', fetcher)
  const [month, setMonth] = useState('all')
  const [deactivating, setDeactivating] = useState(false)
  const points = (data?.points ?? []).filter((row: any) => month === 'all' || monthKey(row.gameweeks?.starts_at ?? '') === month)
  const prizes = (data?.prizes ?? []).filter((row: any) => month === 'all' || monthKey(row.awarded_at ?? row.gameweeks?.starts_at ?? '') === month)
  const total = points.reduce((sum: number, row: any) => sum + Number(row.points ?? 0), 0)
  const months = useMemo(() => [...new Set((data?.points ?? []).map((row: any) => monthKey(row.gameweeks?.starts_at ?? '')).filter(Boolean))], [data])
  async function deactivate() { setDeactivating(true); const response = await fetch('/api/auth/deactivate', { method: 'POST' }); if (response.ok) await signOut(); setDeactivating(false) }
  if (isLoading) return <AppShell><div className="mx-auto max-w-6xl animate-pulse space-y-5"><div className="h-10 w-64 rounded bg-muted" /><div className="h-72 rounded-3xl bg-muted" /><div className="h-72 rounded-3xl bg-muted" /></div></AppShell>
  if (error) return <AppShell><div className="mx-auto max-w-6xl rounded-3xl border border-destructive/30 p-8 text-center"><p className="font-bold">Unable to load your profile</p><Button className="mt-4" onClick={() => mutate()}>Retry</Button></div></AppShell>
  const profile = data?.profile
  return <AppShell><main className="mx-auto max-w-6xl space-y-5 pb-10"><header><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Your account</p><h1 className="mt-2 font-display text-3xl font-black">Profile & history</h1></header><Card><CardHeader><CardTitle>Account</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Nickname</p><p className="font-semibold">{profile?.nickname ?? '—'}</p></div><div><p className="text-xs text-muted-foreground">Phone</p><p>{profile?.phone ?? '—'} <Badge variant="outline">{profile?.phone_verified ? 'Verified' : 'Unverified'}</Badge></p></div><div><p className="text-xs text-muted-foreground">Email</p><p>{profile?.email ?? '—'} <Badge variant="outline">{profile?.email_verified ? 'Verified' : 'Unverified'}</Badge></p></div><div><p className="text-xs text-muted-foreground">Referral code</p><p className="font-semibold">{profile?.referral_code ?? '—'}</p></div></CardContent></Card><Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Weekly points history</CardTitle><select value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border bg-background px-2 py-1 text-sm"><option value="all">All time</option>{months.map((value: any) => <option key={value} value={value}>{value}</option>)}</select></CardHeader><CardContent><p className="mb-4 text-2xl font-black">{total} points</p>{points.length ? <div className="space-y-2">{points.map((row: any) => <div key={row.gameweek_id} className="flex justify-between border-t py-3 text-sm"><span>{row.gameweeks?.starts_at?.slice(0, 10) ?? 'Gameweek'}</span><strong>{row.points} pts</strong></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">No points history yet.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Prize wins</CardTitle></CardHeader><CardContent>{prizes.length ? prizes.map((row: any) => <div key={row.id} className="flex justify-between border-t py-3 text-sm"><span>Rank #{row.rank} · {row.awarded_at?.slice(0, 10)}</span><strong>₦{Number(row.amount ?? 0).toLocaleString()}</strong></div>) : <p className="py-8 text-center text-sm text-muted-foreground">No prize wins yet.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Qualification history</CardTitle></CardHeader><CardContent>{data?.qualification?.length ? data.qualification.map((row: any) => <div key={row.gameweek_id} className="flex justify-between border-t py-3 text-sm"><span>{row.gameweeks?.starts_at?.slice(0, 10) ?? 'Gameweek'} · {row.active_days ?? 0} active days</span><Badge variant={row.qualified ? 'secondary' : 'outline'}>{row.qualified ? 'Qualified' : 'Not qualified'}</Badge></div>) : <p className="py-8 text-center text-sm text-muted-foreground">No qualification history yet.</p>}</CardContent></Card><Card className="border-destructive/30"><CardHeader><CardTitle>Danger zone</CardTitle></CardHeader><CardContent><Button variant="destructive" disabled={deactivating} onClick={deactivate}>{deactivating ? 'Deactivating…' : 'Deactivate account'}</Button></CardContent></Card></main></AppShell>
}
