import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
export async function GET(){const db=createAdminClient();const {data,error}=await db.from('integration_settings').select('public_config').eq('key','offerwall_adgem').maybeSingle();if(error)return NextResponse.json({error:'Unable to load offers'},{status:500});const config:any=data?.public_config??{};return NextResponse.json({enabled:Boolean(config.embedUrlTemplate),embedUrlTemplate:config.embedUrlTemplate??null,holdDays:config.holdDays??7})}
