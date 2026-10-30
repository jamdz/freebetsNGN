import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
const schema=z.object({bank_name:z.string().trim().min(1).max(100),account_number:z.string().regex(/^\d{10}$/),account_name:z.string().trim().min(1).max(150)})
export async function POST(request:Request){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});const body=schema.safeParse(await request.json().catch(()=>null));if(!body.success)return NextResponse.json({error:'Bank name, account number and account name are required.'},{status:400});const {data,error}=await supabase.rpc('save_bank_account',{p_user_id:user.id,p_bank_name:body.data.bank_name,p_account_number:body.data.account_number,p_account_name:body.data.account_name});if(error)return NextResponse.json({error:error.message},{status:409});return NextResponse.json({bank_account:data})}
