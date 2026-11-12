import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIntegration } from '@/lib/server/integrations'
import { z } from 'zod'
const postbackSchema=z.object({user_id:z.string().uuid(),payout_usd:z.coerce.number().positive(),status:z.string().optional(),transaction_id:z.string().optional(),signature:z.string().optional()})
function safePostbackLogPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { payload_type: typeof payload }
  const value = payload as Record<string, unknown>
  return {
    user_id: typeof value.user_id === 'string' ? value.user_id : undefined,
    payout_usd: Number.isFinite(Number(value.payout_usd)) ? Number(value.payout_usd) : undefined,
    status: typeof value.status === 'string' ? value.status.slice(0, 40) : undefined,
    transaction_id: typeof value.transaction_id === 'string' ? value.transaction_id.slice(0, 120) : undefined,
  }
}
async function logAttempt(provider:string,payload:unknown,signatureOk:boolean,responseStatus:number){try{await createAdminClient().from('integration_logs').insert({provider,event_type:'offer_postback',payload:safePostbackLogPayload(payload),signature_ok:signatureOk,response_status:responseStatus})}catch{console.error('[postback] log failed')}}
export async function POST(request:Request,{params}:{params:Promise<{provider:string}>}){const provider=(await params).provider;const payload=await request.json().catch(()=>null);const db=createAdminClient();const {data:settings}=await db.from('integration_settings').select('public_config').eq('key',`offerwall_${provider}`).maybeSingle();const config:any=settings?.public_config??{};const parsed=postbackSchema.safeParse(payload);if(provider==='adgem'&&request.headers.get('x-v0-postback-test')==='true'){if(process.env.NODE_ENV==='production'||!parsed.success)return NextResponse.json({error:'Unauthorized'},{status:401});try{const integration=await getIntegration('offerwall_adgem');const secret=integration.secrets.postbackSecret;const signature=request.headers.get('x-adgem-signature')??'';const expected=typeof secret==='string'&&secret?createHmac('sha256',secret).update(JSON.stringify(payload)).digest('hex'):'';const receivedBuffer=Buffer.from(signature);const expectedBuffer=Buffer.from(expected);const valid=Boolean(integration.isActive&&config.appId&&expected&&receivedBuffer.length===expectedBuffer.length&&timingSafeEqual(receivedBuffer,expectedBuffer));await logAttempt(provider,payload,valid,valid?200:401);if(!valid)return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.json({ok:true,test:true,creditsIssued:false})}catch{return NextResponse.json({error:'Unauthorized'},{status:401})}}const signatureParam=String((payload as any)?.signature??request.headers.get('x-adgem-signature')??'');/* TODO: Implement the provider's documented signature algorithm before enabling production credits. */const signatureVerified=false;await logAttempt(provider,payload,signatureVerified,401);if(!parsed.success||!signatureParam||!config.appId)return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.json({error:'Unauthorized'},{status:401})}
export async function GET(request:Request,context:{params:Promise<{provider:string}>}){return POST(request,context)}
