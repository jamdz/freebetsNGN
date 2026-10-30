import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { queueNotification } from '@/lib/notifications'

const bodySchema = z.object({ event_id: z.string().uuid() }).strict()
const mask = (value: string | null) => value ? `${value.slice(0, 3)}***` : '***'
const countdown = (target: string) => { const seconds = Math.max(0, Math.ceil((new Date(target).getTime() - Date.now()) / 1000)); const days = Math.floor(seconds / 86400); const hours = Math.floor((seconds % 86400) / 3600); const minutes = Math.floor((seconds % 3600) / 60); return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m` }

export async function GET() {
  const client = await createClient(); const { data: { user } } = await client.auth.getUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createAdminClient(); const now = new Date().toISOString(); const { data: event, error } = await db.from('spin_events').select('id,name,status,starts_at,ends_at,spins_per_user,eligibility,is_active,cap_naira,awarded_naira').eq('is_active', true).in('status', ['scheduled', 'live']).order('starts_at', { ascending: false }).limit(1).maybeSingle(); if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!event) return NextResponse.json({ event: null, recent_winners: [], history: [], can_spin: false, reason: 'Not active' })
  const [{ data: userSpins, count }, { data: winners }, qualification] = await Promise.all([db.from('spin_results').select('id,event_id,outcome,amount_naira,segment_index,created_at', { count: 'exact' }).eq('event_id', event.id).eq('user_id', user.id).order('created_at', { ascending: false }), db.from('spin_results').select('id,amount_naira,created_at,user:profiles!spin_results_user_id_fkey(nickname)').eq('event_id', event.id).eq('outcome', 'win').order('created_at', { ascending: false }).limit(10), event.eligibility === 'qualified' ? db.rpc('is_user_qualified', { p_user_id: user.id }) : Promise.resolve({ data: true, error: null })])
  if (qualification.error) return NextResponse.json({ error: qualification.error.message }, { status: 500 })
  const ended = new Date(event.ends_at).getTime() <= Date.now(); const started = new Date(event.starts_at).getTime() <= Date.now(); const qualified = Boolean(qualification.data); let reason = 'Ready to spin'; let canSpin = true
  if (!started) { canSpin = false; reason = `Starts in ${countdown(event.starts_at)}` } else if (ended || event.status === 'ended') { canSpin = false; reason = 'The event has ended' } else if (event.status !== 'live') { canSpin = false; reason = 'Not active' } else if ((event.awarded_naira ?? 0) >= (event.cap_naira ?? 0)) { canSpin = false; reason = 'Prize cap reached' } else if (event.eligibility === 'qualified' && !qualified) { canSpin = false; reason = 'Not eligible: complete qualification' } else if ((count ?? 0) >= event.spins_per_user) { canSpin = false; reason = 'Already spun' }
  return NextResponse.json({ event: { id: event.id, name: event.name, status: event.status, starts_at: event.starts_at, ends_at: event.ends_at, spins_per_user: event.spins_per_user, eligibility: event.eligibility, spins_used: count ?? 0 }, can_spin: canSpin, reason, recent_winners: (winners ?? []).map((row: any) => ({ nickname: mask(row.user?.nickname ?? row.user?.[0]?.nickname), amount_naira: row.amount_naira, created_at: row.created_at })), history: userSpins ?? [] })
}

export async function POST(request: Request) {
  const client = await createClient(); const { data: { user } } = await client.auth.getUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const parsed = bodySchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
  const db = createAdminClient(); const { data: event } = await db.from('spin_events').select('fixed_prizes').eq('id', parsed.data.event_id).maybeSingle(); const { data, error } = await db.rpc('spin_user', { p_event_id: parsed.data.event_id, p_user_id: user.id }); if (error || !data) return NextResponse.json({ error: error?.message ?? 'Unable to spin' }, { status: 409 }); const result: any = Array.isArray(data) ? data[0] : data; const amount = Number(result.amount_naira ?? result.awarded_naira ?? 0); const outcome = result.outcome === 'win' ? 'win' : 'try-again'; const tryAgainSegments = [1, 3, 5, 7]; const prizeSegments = [0, 2, 4, 6]; const prizes: number[] = event?.fixed_prizes ?? []; const exact = prizes.findIndex((prize) => Number(prize) === amount); const segmentIndex = outcome === 'win' ? (exact >= 0 ? prizeSegments[exact] : prizeSegments.reduce((best, index) => Math.abs((prizes[prizeSegments.indexOf(index)] ?? 0) - amount) < Math.abs((prizes[prizeSegments.indexOf(best)] ?? 0) - amount) ? index : best, prizeSegments[0])) : tryAgainSegments[Math.floor(Math.random() * tryAgainSegments.length)]
  if (outcome === 'win') await queueNotification('spin_win', user.id, { event_id: parsed.data.event_id, amount_naira: amount })
  return NextResponse.json({ outcome, amountNaira: outcome === 'win' ? amount : undefined, segmentIndex })
}
