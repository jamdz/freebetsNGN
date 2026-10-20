import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({ fixtureId: z.string().uuid(), outcome: z.enum(['home','draw','away']), homeGoals: z.number().int().min(0).max(20), awayGoals: z.number().int().min(0).max(20), booster: z.boolean().default(false) })
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid prediction' }, { status: 400 })
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const admin = createAdminClient(); const { data: fixture } = await admin.from('fixtures').select('id,kickoff_at,status').eq('id', parsed.data.fixtureId).maybeSingle()
  if (!fixture || fixture.status !== 'scheduled' || Date.now() >= new Date(fixture.kickoff_at).getTime()) return NextResponse.json({ error: 'Predictions are closed for this fixture' }, { status: 409 })
  if ((parsed.data.outcome === 'home' && parsed.data.homeGoals <= parsed.data.awayGoals) || (parsed.data.outcome === 'away' && parsed.data.awayGoals <= parsed.data.homeGoals) || (parsed.data.outcome === 'draw' && parsed.data.homeGoals !== parsed.data.awayGoals)) return NextResponse.json({ error: 'Outcome and scores do not match' }, { status: 400 })
  const { data: gameweek } = await admin.from('gameweeks').select('id').gt('ends_at', fixture.kickoff_at).lt('starts_at', fixture.kickoff_at).maybeSingle()
  if (!gameweek) return NextResponse.json({ error: 'No active gameweek' }, { status: 409 })
  if (parsed.data.booster) { const { count } = await admin.from('predictions').select('fixture_id', { count: 'exact', head: true }).eq('user_id', user.id).eq('gameweek_id', gameweek.id).eq('booster', true); if ((count ?? 0) >= 1) return NextResponse.json({ error: 'Only one booster is allowed per gameweek' }, { status: 409 }) }
  const { data, error } = await admin.from('predictions').upsert({ user_id: user.id, fixture_id: parsed.data.fixtureId, gameweek_id: gameweek.id, outcome: parsed.data.outcome, home_goals: parsed.data.homeGoals, away_goals: parsed.data.awayGoals, booster: parsed.data.booster, updated_at: new Date().toISOString() }, { onConflict: 'user_id,fixture_id' }).select('fixture_id,outcome,home_goals,away_goals,booster').single()
  if (error) return NextResponse.json({ error: 'Unable to save prediction' }, { status: 500 })
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date())
  await admin.rpc('record_prediction_activity', { p_user_id: user.id, p_activity_date: today })
  return NextResponse.json({ prediction: data })
}
