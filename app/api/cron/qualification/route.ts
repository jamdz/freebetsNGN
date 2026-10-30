import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processNotificationOutbox } from '@/lib/notifications'

export const runtime = 'nodejs'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createAdminClient()
  const { data: gameweek, error: gameweekError } = await supabase.from('gameweeks').select('id, starts_at, ends_at').lte('starts_at', new Date().toISOString()).gt('ends_at', new Date().toISOString()).order('starts_at', { ascending: false }).limit(1).maybeSingle()
  if (gameweekError) return NextResponse.json({ error: gameweekError.message }, { status: 500 })
  if (!gameweek) { await processNotificationOutbox(); return NextResponse.json({ message: 'No current gameweek', processed: 0 }) }
  const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id').eq('status', 'active')
  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 })
  let processed = 0
  for (const profile of profiles ?? []) {
    const { error } = await supabase.rpc('compute_weekly_qualification', { p_user_id: profile.id, p_gameweek_id: gameweek.id })
    if (error) return NextResponse.json({ error: error.message, processed }, { status: 500 })
    processed += 1
  }
  await processNotificationOutbox()
  return NextResponse.json({ gameweekId: gameweek.id, processed })
}
