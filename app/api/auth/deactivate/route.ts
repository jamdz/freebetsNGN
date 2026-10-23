import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ status: 'deactivated', deactivated_at: new Date().toISOString() }).eq('id', user.id)
  if (error) return NextResponse.json({ error: 'Unable to deactivate account' }, { status: 500 })
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
