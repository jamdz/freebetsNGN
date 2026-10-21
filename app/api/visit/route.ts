import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('status,last_visit_date,streak_count').eq('id', user.id).single()
  if (!profile || profile.status !== 'active') return NextResponse.json({ error: 'Account unavailable' }, { status: 403 })
  const { data: config } = await admin.from('app_config').select('streak_days,boosters').eq('id', true).single()
  const today = new Date().toISOString().slice(0, 10)
  if (profile.last_visit_date === today) return NextResponse.json({ recorded: false, streak: profile.streak_count })
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const streak = profile.last_visit_date === yesterday ? profile.streak_count + 1 : 1
  const streakDays = config?.streak_days ?? 7
  const bonus = streakDays > 0 && streak % streakDays === 0 ? Number(config?.boosters?.bonusPerStreak ?? 1) : 0
  const { error: activityError } = await admin.from('daily_activity').upsert({ user_id: user.id, activity_date: today, logged_in: true }, { onConflict: 'user_id,activity_date' })
  if (activityError) return NextResponse.json({ error: 'Unable to record visit' }, { status: 500 })
  const { error } = await admin.from('profiles').update({ last_visit_date: today, streak_count: streak, boosters_bonus: ((profile as { boosters_bonus?: number }).boosters_bonus ?? 0) + bonus }).eq('id', user.id)
  if (error) return NextResponse.json({ error: 'Unable to update streak' }, { status: 500 })
  return NextResponse.json({ recorded: true, streak, bonus })
}
