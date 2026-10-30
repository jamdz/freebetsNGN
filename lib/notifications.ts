import { createAdminClient } from '@/lib/supabase/admin'
export const NOTIFICATION_EVENTS=['withdrawal_airtime_sent','withdrawal_airtime_rejected','withdrawal_bank_paid','withdrawal_bank_rejected','account_suspended','account_banned','account_reactivated','spin_win','prize_won','referral_credit'] as const
export type NotificationEvent=typeof NOTIFICATION_EVENTS[number]
export async function queueNotification(event:NotificationEvent,userId:string,payload:Record<string,unknown>){try{if(!NOTIFICATION_EVENTS.includes(event))return;const {error}=await createAdminClient().from('notification_outbox').insert({event,user_id:userId,payload,channel:'email'});if(error)console.error('[notifications] queue failed',{event,userId,message:error.message})}catch(error){console.error('[notifications] queue exception',{event,userId,error})}}
export async function processNotificationOutbox(){return}
