import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const [profile, leaderboard, qualification, prizes] = await Promise.all([
    supabase.from('profiles').select('nickname, phone, phone_verified, email, email_verified, referral_code, created_at, reward_balance_naira, status').eq('id', user.id).maybeSingle(),
    supabase.from('weekly_leaderboard').select('gameweek_id, points, exact_scores, correct_results, predictions_count, qualified, rank, first_prediction_at, gameweeks(starts_at, ends_at)').eq('user_id', user.id).order('gameweek_id', { ascending: false }),
    supabase.from('weekly_qualification').select('gameweek_id, active_days, qualified, gameweeks(starts_at, ends_at)').eq('user_id', user.id).order('gameweek_id', { ascending: false }),
    supabase.from('prize_awards').select('id, gameweek_id, rank, amount, status, awarded_at, gameweeks(starts_at, ends_at)').eq('user_id', user.id).order('awarded_at', { ascending: false }),
  ])
  const failed = [profile, leaderboard, qualification, prizes].find((result) => result.error)
  if (failed?.error) {
    console.error('[profile] load failed', { message: failed.error.message, code: failed.error.code, details: failed.error.details })
    return NextResponse.json({ error: 'Unable to load profile data' }, { status: 500 })
  }
  return NextResponse.json({ profile: { ...profile.data, email: profile.data?.email ?? user.email, email_verified: profile.data?.email_verified ?? Boolean(user.email_confirmed_at) }, weeks: leaderboard.data ?? [], qualification: qualification.data ?? [], prizes: prizes.data ?? [] })
}
