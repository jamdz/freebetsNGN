'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import { QUALIFICATION_RULES } from '@/lib/config'
import { lagosDate } from '@/lib/dates'
import { Button } from '@/components/ui/button'

type Day = { label: string; predictions: number; fixtures: number; state: 'done' | 'progress' | 'missed' | 'not-enough' | 'upcoming' }
type QualificationData = { activity?: Array<{ activity_date: string; predictions_count: number }>; qualification?: { active_days?: number; qualified?: boolean } | null; startsAt?: string; endsAt?: string }

export function QualificationTracker({ compact = false, data }: { compact?: boolean; data?: QualificationData }) {
  const [open, setOpen] = useState(false)
  const source = data?.activity ?? []
  const start = data?.startsAt ? new Date(data.startsAt) : new Date()
  const days: Day[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start); date.setDate(date.getDate() + index)
    const key = lagosDate(date)
    const record = source.find((item) => item.activity_date === key)
    const predictions = record?.predictions_count ?? 0
    const state = predictions >= QUALIFICATION_RULES.minPredictionsPerActiveDay ? 'done' : date.getTime() > Date.now() ? 'upcoming' : predictions > 0 ? 'progress' : 'not-enough'
    return { label: new Intl.DateTimeFormat('en-NG', { weekday: 'short' }).format(date), predictions, fixtures: 0, state }
  })
  const completed = data?.qualification?.active_days ?? days.filter((day) => day.state === 'done').length
  const missing = Math.max(0, QUALIFICATION_RULES.activeDaysRequired - completed)
  const status = data?.qualification?.qualified ? 'Qualified' : completed >= QUALIFICATION_RULES.activeDaysRequired ? 'On track' : 'At risk'
  return <section className={`rounded-2xl border border-border bg-card ${compact ? 'p-3' : 'p-4'}`} aria-label="Weekly qualification progress"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">Weekly qualification</p><h2 className="mt-1 font-display text-lg font-black">Days completed: {completed} of {QUALIFICATION_RULES.activeDaysRequired}</h2></div><Button variant="ghost" size="icon" aria-label="How qualification works" onClick={() => setOpen(true)}><Info /></Button></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, completed / QUALIFICATION_RULES.activeDaysRequired * 100)}%` }} /></div><p className="mt-2 text-sm text-muted-foreground"><strong className="text-foreground">{status}.</strong> {missing > 0 ? `You need ${missing} more active day${missing === 1 ? '' : 's'} with ${QUALIFICATION_RULES.minPredictionsPerActiveDay}+ predictions this week.` : 'You meet this week’s activity requirement.'}</p>{!compact && <div className="mt-4 grid grid-cols-7 gap-1.5">{days.map((day) => <div key={day.label} className="min-w-0 text-center"><p className="text-[10px] font-bold text-muted-foreground">{day.label}</p><div className={`mt-1 rounded-xl border p-2 ${day.state === 'done' ? 'border-emerald-400/40 bg-emerald-400/10' : day.state === 'progress' ? 'border-primary/40 bg-primary/10' : 'border-border bg-background'}`}><p className="font-display text-sm font-black">{day.predictions}/{QUALIFICATION_RULES.minPredictionsPerActiveDay}</p><p className="mt-1 truncate text-[9px] text-muted-foreground">{day.state === 'done' ? 'Done' : day.state === 'progress' ? 'In progress' : day.state === 'not-enough' ? 'Not enough' : 'Upcoming'}</p></div></div>)}</div>}{open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><h2 className="font-display text-xl font-black">How qualification works</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Make at least {QUALIFICATION_RULES.minPredictionsPerActiveDay} predictions on {QUALIFICATION_RULES.activeDaysRequired} different days from Monday to Sunday.</p><Button className="mt-5 w-full" onClick={() => setOpen(false)}>Got it</Button></div></div>}</section>
}
