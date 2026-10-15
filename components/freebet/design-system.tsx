'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton as ShadcnSkeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Dialog as ShadcnDialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs as ShadcnTabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trophy, Minus, Plus, CircleHelp } from 'lucide-react'

export function StatTile({ label, value, detail, icon: Icon = Trophy }: { label: string; value: ReactNode; detail?: string; icon?: typeof Trophy }) {
  return <Card className="border-white/8 bg-card/80"><CardContent className="flex items-center gap-3 p-4"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary"><Icon data-icon="inline-start" /></span><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="font-display text-xl font-bold tracking-tight">{value}</p>{detail && <p className="text-[11px] text-muted-foreground">{detail}</p>}</div></CardContent></Card>
}

export function TeamBadge({ initials, color, name, size = 'default' }: { initials: string; color: string; name?: string; size?: 'sm' | 'default' }) {
  return <span className="inline-flex items-center gap-2"> <span aria-label={name} className={cn('flex shrink-0 items-center justify-center rounded-full border border-white/15 font-display font-bold text-foreground', size === 'sm' ? 'size-7 text-[9px]' : 'size-10 text-[11px]')} style={{ backgroundColor: `${color}33`, borderColor: `${color}99` }}>{initials}</span>{name && <span className="truncate text-sm font-medium">{name}</span>}</span>
}

export function ScoreBox({ homeScore = 0, awayScore = 0, editable = false }: { homeScore?: number; awayScore?: number; editable?: boolean }) {
  return <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-background/50 p-1"><button aria-label="Decrease home score" className="flex size-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" disabled={!editable}><Minus data-icon="inline-start" /></button><span className="min-w-8 text-center font-display text-lg font-bold">{homeScore}</span><span className="text-muted-foreground">:</span><span className="min-w-8 text-center font-display text-lg font-bold">{awayScore}</span><button aria-label="Increase away score" className="flex size-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" disabled={!editable}><Plus data-icon="inline-start" /></button></div>
}

export function RankBadge({ rank }: { rank: number }) { return <span className={cn('inline-flex size-8 items-center justify-center rounded-full font-display text-sm font-bold', rank === 1 && 'bg-amber-300 text-amber-950', rank === 2 && 'bg-slate-300 text-slate-800', rank === 3 && 'bg-orange-400 text-orange-950', rank > 3 && 'bg-muted text-muted-foreground')}>{rank}</span> }
export function CountdownTimer({ label = 'Next kick-off', value = '02:18:44' }: { label?: string; value?: string }) { return <div className="rounded-xl border border-primary/20 bg-primary/8 px-3 py-2"><p className="text-[10px] uppercase tracking-widest text-primary">{label}</p><p className="font-display text-lg font-bold tabular-nums">{value}</p></div> }
export function ProgressBar({ value, label }: { value: number; label?: string }) { return <div className="flex flex-col gap-1.5">{label && <div className="flex justify-between text-xs text-muted-foreground"><span>{label}</span><span>{value}%</span></div>}<Progress value={value} /></div> }
export function EmptyState({ title = 'Nothing here yet', description = 'Check back soon for fresh matchday action.' }: { title?: string; description?: string }) { return <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-8 text-center"><CircleHelp className="text-muted-foreground" /><p className="font-semibold">{title}</p><p className="max-w-xs text-sm text-muted-foreground">{description}</p></div> }
export function Skeleton({ className }: { className?: string }) { return <ShadcnSkeleton className={className} /> }
export function Toast({ children }: { children: ReactNode }) { return <div role="status" className="rounded-xl border border-primary/30 bg-card px-4 py-3 text-sm shadow-lg">{children}</div> }
export function Dialog({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode }) { return <ShadcnDialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle>{description && <DialogDescription>{description}</DialogDescription>}</DialogHeader>{children}</DialogContent></ShadcnDialog> }
export function Tabs({ children, defaultValue }: { children: ReactNode; defaultValue: string }) { return <ShadcnTabs defaultValue={defaultValue}>{children}</ShadcnTabs> }
export { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, TabsContent, TabsList, TabsTrigger }
