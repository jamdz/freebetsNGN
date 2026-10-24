import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({
  fixtureId: z.string().uuid(), outcome: z.enum(['home', 'draw', 'away']),
  homeGoals: z.number().int().min(0).max(20).optional(),
  awayGoals: z.number().int().min(0).max(20).optional(), booster: z.boolean(),
}).strict().refine((value) => (value.homeGoals === undefined) === (value.awayGoals === undefined), { message: 'homeGoals and awayGoals must be provided together' }).refine((value) => value.homeGoals === undefined || (value.outcome === 'home' ? value.homeGoals > value.awayGoals! : value.outcome === 'away' ? value.homeGoals < value.awayGoals! : value.homeGoals === value.awayGoals), { message: 'Score does not match your chosen result', path: ['outcome'] })

const response = (error: string, status: number, issues?: z.ZodIssue[]) => NextResponse.json({ error, ...(process.env.NODE_ENV === 'development' && issues ? { issues } : {}) }, { status })

export async function POST(request: Request) {
  let input: unknown
  try { input = await request.json() } catch { return response('Invalid request', 400) }
  const parsed = bodySchema.safeParse(input)
  if (!parsed.success) {
    const scoreMismatch = parsed.error.issues.some((issue) => issue.message === 'Score does not match your chosen result')
    return response(scoreMismatch ? 'Score does not match your chosen result' : 'Invalid request', 400, parsed.error.issues)
  }
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) return response('Not signed in', 401)
  const admin = createAdminClient()
  const { data: fixture } = await admin.from('fixtures').select('id,kickoff_at,status').eq('id', parsed.data.fixtureId).maybeSingle()
  if (!fixture) return response('Fixture not found', 404)
  if (fixture.status !== 'scheduled' || Date.now() >= new Date(fixture.kickoff_at).getTime()) return response('Predictions are closed for this match', 409)
  const { data: gameweek } = await admin.from('gameweeks').select('id').lte('starts_at', fixture.kickoff_at).gt('ends_at', fixture.kickoff_at).maybeSingle()
  if (!gameweek) return response('Invalid request', 400)
  if (parsed.data.booster) {
    const [{ data: config }, { data: profile }] = await Promise.all([
      admin.from('app_config').select('boosters').eq('id', true).maybeSingle(),
      admin.from('profiles').select('boosters_bonus').eq('id', user.id).maybeSingle(),
    ])
    const perWeek = Math.max(0, Number(config?.boosters?.perWeek ?? 0) + Number(profile?.boosters_bonus ?? 0))
    const { count } = await admin.from('predictions').select('fixture_id', { count: 'exact', head: true }).eq('user_id', user.id).eq('gameweek_id', gameweek.id).eq('booster', true).neq('result', 'void').neq('fixture_id', fixture.id)
    if ((count ?? 0) >= perWeek) return response('Booster already used this week', 409)
  }
  const { data, error } = await admin.from('predictions').upsert({ user_id: user.id, fixture_id: fixture.id, gameweek_id: gameweek.id, outcome: parsed.data.outcome, home_goals: parsed.data.homeGoals ?? null, away_goals: parsed.data.awayGoals ?? null, booster: parsed.data.booster, updated_at: new Date().toISOString() }, { onConflict: 'user_id,fixture_id' }).select('fixture_id,outcome,home_goals,away_goals,booster,points_awarded,result').single()
  if (error) return response('Invalid request', 400)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date())
  await admin.rpc('record_prediction_activity', { p_user_id: user.id, p_activity_date: today })
  return NextResponse.json({ prediction: data })
}
