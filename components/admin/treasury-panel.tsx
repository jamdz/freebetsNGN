'use client'

import { useEffect, useState } from 'react'
import { formatNaira } from '@/lib/format'

export function TreasuryPanel() {
  const [settings, setSettings] = useState<any>(null)
  useEffect(() => { fetch('/api/admin/settings').then((response) => response.ok ? response.json() : null).then((body) => setSettings(body?.settings ?? null)).catch(() => undefined) }, [])
  return <section className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Admin console</p><h1 className="mt-1 text-2xl font-bold">Treasury and revenue</h1><p className="text-sm text-muted-foreground">Honest visibility into the features currently connected.</p></div><div className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Treasury tracking is not connected</h2><p className="mt-2 text-sm text-muted-foreground">Treasury and revenue tracking arrives with the money features update. No revenue is being recorded yet.</p></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">Weekly prize budget</p><p className="mt-2 text-xl font-bold">{settings ? formatNaira(Number(settings.weekly_budget_naira ?? 0)) : 'Loading…'}</p></div><div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">Prizes paused</p><p className="mt-2 text-xl font-bold">{settings ? (settings.prizes_paused ? 'Yes' : 'No') : 'Loading…'}</p></div></div></section>
}
