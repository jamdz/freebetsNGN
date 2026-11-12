import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getIntegration } from '@/lib/server/integrations'
import { verifyAccount } from '@/lib/providers/bank'
const schema=z.object({bank_name:z.string().trim().min(1).max(100),account_number:z.string().regex(/^\d{10}$/)})
export async function POST(request:Request){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});const body=schema.safeParse(await request.json().catch(()=>null));if(!body.success)return NextResponse.json({error:'Enter a valid bank and 10-digit account number.'},{status:400});try { const integration=await getIntegration('bank_transfer'); if (!integration.isActive) return NextResponse.json({error:'Bank integration is inactive'},{status:503}); const result=await verifyAccount(body.data.bank_name,body.data.account_number); return NextResponse.json({verified:true,account_name:result.accountName}) } catch(error) { return NextResponse.json({error:'Account verification is temporarily unavailable'},{status:503}) }}
