'use client'

import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

const lagosDate = (value: string) => new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

type Fixture = { id: string; kickoff_at: string; status: string; home_goals: number | null; away_goals: number | null; home_name: string; away_name: string; competition_name: string; prediction_count: number; exact: number; correct: number; wrong: number; total_points: number }
type Scores = { home: string; away: string }
type Preview = { predictions: number; exact: number; correct: number; wrong: number; boosted: number; total_points: number; result: string }

export function SettlementPanel() {
  const [rows, setRows] = useState<Fixture[]>([])
  const [scores, setScores] = useState<Record<string, Scores>>({})
  const [previews, setPreviews] = useState<Record<string, { scores: Scores; result: Preview }>>({})
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/settlement')
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Unable to load settlement queue')
      setRows(body.fixtures ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load settlement queue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const updateScore = (id: string, key: keyof Scores, value: string) => setScores((current) => ({ ...current, [id]: { home: current[id]?.home ?? '', away: current[id]?.away ?? '', [key]: value } }))
  const getScore = (id: string) => scores[id] ?? { home: '', away: '' }
  const validScore = (value: string) => /^(?:0|[1-9]|[12][0-9]|30)$/.test(value)
  const scoreReady = (id: string) => validScore(getScore(id).home) && validScore(getScore(id).away)
  const samePreview = (id: string) => { const score = getScore(id); const preview = previews[id]; return Boolean(preview && preview.scores.home === score.home && preview.scores.away === score.away) }

  const requestSettlement = async (id: string, dryRun: boolean) => {
    const score = getScore(id)
    if (!scoreReady(id)) { setActionError('Enter integer scores from 0 to 30 for both teams.'); return }
    setBusy(id)
    setActionError('')
    try {
      const response = await fetch(`/api/admin/fixtures/${id}/settle`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ home_goals: Number(score.home), away_goals: Number(score.away), dry_run: dryRun }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Settlement failed')
      if (dryRun) { setPreviews((current) => ({ ...current, [id]: { scores: score, result: body.result } })); setPreviewId(id) } else { setConfirmId(null); setConfirmText(''); setToast('Settlement confirmed.'); setPreviews((current) => { const next = { ...current }; delete next[id]; return next }); await load() }
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Settlement failed') } finally { setBusy(null) }
  }

  if (loading) return <section className="space-y-4"><h2 className="font-display text-2xl font-bold">Settlement</h2><div className="h-24 animate-pulse rounded-xl border bg-muted/30" /><div className="h-24 animate-pulse rounded-xl border bg-muted/30" /></section>
  if (error) return <section className="space-y-4"><h2 className="font-display text-2xl font-bold">Settlement</h2><p role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">{error}</p><Button onClick={() => void load()}>Retry</Button></section>

  return <section className="space-y-4"><div className="flex items-center justify-between"><h2 className="font-display text-2xl font-bold">Settlement</h2>{toast && <p role="status" className="text-sm text-emerald-600">{toast}</p>}</div>{rows.length === 0 ? <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">No fixtures are waiting for results</p> : rows.map((row) => { const score = getScore(row.id); const canSettle = row.status !== 'finished'; return <article className="space-y-3 rounded-xl border p-4" key={row.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{row.home_name} vs {row.away_name}</p><p className="text-sm text-muted-foreground">{row.competition_name} · {lagosDate(row.kickoff_at)} · {row.prediction_count} predictions</p></div><span className="rounded-full border px-2 py-1 text-xs capitalize">{row.status}</span></div>{canSettle ? <div className="flex flex-wrap items-center gap-2"><input aria-label={`${row.home_name} goals`} className="h-9 w-20 rounded border bg-background px-2" inputMode="numeric" type="number" min="0" max="30" step="1" value={score.home} onChange={(event) => updateScore(row.id, 'home', event.target.value)} placeholder="Home"/><span>–</span><input aria-label={`${row.away_name} goals`} className="h-9 w-20 rounded border bg-background px-2" inputMode="numeric" type="number" min="0" max="30" step="1" value={score.away} onChange={(event) => updateScore(row.id, 'away', event.target.value)} placeholder="Away"/><Button disabled={busy === row.id || !scoreReady(row.id)} onClick={() => void requestSettlement(row.id, true)}>Preview settlement</Button><Button variant="outline" disabled={busy === row.id || !samePreview(row.id)} onClick={() => { setActionError(''); setConfirmId(row.id) }}>Confirm settlement</Button></div> : <div className="flex flex-wrap items-center gap-4 text-sm"><strong>Final: {row.home_goals} – {row.away_goals}</strong><span>Exact {row.exact}</span><span>Correct {row.correct}</span><span>Wrong {row.wrong}</span><span>Total points {row.total_points}</span></div>}</article> })}<Dialog open={previewId !== null} onOpenChange={(open) => !open && setPreviewId(null)}><DialogContent><DialogHeader><DialogTitle>Settlement preview</DialogTitle></DialogHeader>{previewId && previews[previewId] && <div className="space-y-2 text-sm"><p>Result: <strong>{previews[previewId].result.result}</strong></p><p>Predictions: {previews[previewId].result.predictions}</p><p>Exact: {previews[previewId].result.exact}</p><p>Correct: {previews[previewId].result.correct}</p><p>Wrong: {previews[previewId].result.wrong}</p><p>Boosted: {previews[previewId].result.boosted}</p><p>Total points: {previews[previewId].result.total_points}</p></div>}<DialogFooter><Button onClick={() => setPreviewId(null)}>Close</Button></DialogFooter></DialogContent></Dialog><AlertDialog open={confirmId !== null} onOpenChange={(open: boolean) => { if (!open) { setConfirmId(null); setConfirmText('') } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm settlement</AlertDialogTitle><AlertDialogDescription>Type SETTLE to permanently settle this fixture. {actionError}</AlertDialogDescription></AlertDialogHeader><input aria-label="Settlement confirmation" className="h-9 rounded border bg-background px-3" value={confirmText} onChange={(event: ChangeEvent<HTMLInputElement>) => setConfirmText(event.target.value)} placeholder="SETTLE"/><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={confirmText !== 'SETTLE' || !confirmId || busy === confirmId} onClick={(event) => { event.preventDefault(); if (confirmId) void requestSettlement(confirmId, false) }}>Settle</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>{actionError && !confirmId && <p role="alert" className="text-sm text-destructive">{actionError}</p>}</section>
}
