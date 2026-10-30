import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
const schema=z.object({bank_name:z.string().trim().min(1).max(100),account_number:z.string().regex(/^\d{10}$/)})
export async function POST(request:Request){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});const body=schema.safeParse(await request.json().catch(()=>null));if(!body.success)return NextResponse.json({error:'Enter a valid bank and 10-digit account number.'},{status:400});if(process.env.NODE_ENV==='production')return NextResponse.json({error:'Account verification is not available yet'},{status:503});return NextResponse.json({verified:false,mock:true,account_name:'Mock account name (development only)'})}
