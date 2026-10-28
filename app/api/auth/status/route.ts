import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  const supabase = await createClient()
  const { data: { user } } = bearer ? await createAdminClient().auth.getUser(bearer) : await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id,nickname,email,phone,email_verified,phone_verified,status,deactivated_at,streak_count,last_visit_date,boosters_bonus').eq('id', user.id).maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Profile unavailable' }, { status: 403 })
  if (profile.status === 'banned' || profile.status === 'suspended') return NextResponse.json({ error: 'This account is unavailable.' }, { status: 403 })
  if (profile.status === 'deactivated') {
    const deactivatedAt = profile.deactivated_at ? new Date(profile.deactivated_at).getTime() : 0
    if (!deactivatedAt || Date.now() - deactivatedAt > 30 * 24 * 60 * 60 * 1000) return NextResponse.json({ error: 'This account cannot be restored.' }, { status: 403 })
    await admin.from('profiles').update({ status: 'active', deactivated_at: null }).eq('id', user.id)
    profile.status = 'active'
  }
  return NextResponse.json({ user: { ...profile, id: user.id, email: user.email } })
}
