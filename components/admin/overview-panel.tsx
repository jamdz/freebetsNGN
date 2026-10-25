'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatNaira } from '@/lib/format'

export function OverviewPanel() {
  const [data, setData] = useState<any>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); setError(''); try { const response = await fetch('/api/admin/overview'); if (!response.ok) throw new Error('Unable to load overview'); setData(await response.json()) } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load overview') } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  const cards = data ? [['Total users', data.total_users.toLocaleString()], ['Active today', data.active_today.toLocaleString()], ['Predictions today', data.predictions_today.toLocaleString()], ['Fixtures awaiting results', data.fixtures_awaiting_results.toLocaleString()], ['Weekly prize pool', formatNaira(data.weekly_prize_pool)], ['Pending withdrawals', 'Not connected yet']] : []
  return <section className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Admin console</p><h1 className="mt-1 text-2xl font-bold">Overview</h1><p className="text-sm text-muted-foreground">Live operational metrics from the database.</p></div>{error && <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{error} <Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button></div>}<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{loading ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl border bg-muted/40" />) : cards.map(([label, value]) => <div key={label} className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div><div className="flex flex-wrap gap-2"><Link href="#fixtures"><Button>Fixtures</Button></Link><Link href="#settlement"><Button variant="outline">Settlement</Button></Link><Link href="#prizes"><Button variant="outline">Prizes</Button></Link></div></section>
}
