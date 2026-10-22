import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addLagosDays, lagosDate } from '@/lib/dates'

function failure(message: string, error?: { message?: string }, status = 500) {
  if (error) console.error(`[visit] ${message}:`, error.message ?? error)
  return NextResponse.json({ error: message, ...(process.env.NODE_ENV === 'development' && error?.message ? { detail: error.message } : {}) }, { status })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin.from('profiles').select('status,last_visit_date,streak_count,boosters_bonus').eq('id', user.id).single()
  if (profileError) return failure('Unable to load account', profileError)
  if (!profile || profile.status !== 'active') return NextResponse.json({ error: 'Account unavailable' }, { status: 403 })
  const { data: config, error: configError } = await admin.from('app_config').select('streak_days,boosters').eq('id', true).single()
  if (configError) return failure('Unable to load streak configuration', configError)
  if (!config) return failure('Settings row missing in app_config')
  const today = lagosDate(new Date())
  if (profile.last_visit_date === today) return NextResponse.json({ recorded: false, streak: profile.streak_count })
  const yesterday = addLagosDays(today, -1)
  const streak = profile.last_visit_date === yesterday ? profile.streak_count + 1 : 1
  const streakDays = config.streak_days ?? 7
  const bonus = streakDays > 0 && streak % streakDays === 0 ? Number(config.boosters?.bonusPerStreak ?? 1) : 0
  const { error: activityError } = await admin.from('daily_activity').upsert({ user_id: user.id, activity_date: today, logged_in: true }, { onConflict: 'user_id,activity_date' })
  if (activityError) return failure('Unable to record visit', activityError)
  const { error } = await admin.from('profiles').update({ last_visit_date: today, streak_count: streak, boosters_bonus: profile.boosters_bonus + bonus }).eq('id', user.id)
  if (error) return failure('Unable to update streak', error)
  return NextResponse.json({ recorded: true, streak, bonus })
}
