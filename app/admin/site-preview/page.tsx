import { redirect } from 'next/navigation'
import { LandingPage } from '@/components/landing-page'
import { hasAdminSession } from '@/lib/admin-auth'
import { serviceClient } from '@/lib/admin-api'
import { DEFAULTS } from '@/lib/site-settings'
import { getPublicRules } from '@/lib/server/public-rules'
export const dynamic='force-dynamic'
export default async function SitePreviewPage(){if(!(await hasAdminSession()))redirect('/');const {data}=await serviceClient().from('site_settings').select('draft').eq('id',true).maybeSingle();const settings={...DEFAULTS,...(data?.draft??{}),seo:{...DEFAULTS.seo,...(data?.draft?.seo??{})},legal:{...DEFAULTS.legal,...(data?.draft?.legal??{})},social:{...DEFAULTS.social,...(data?.draft?.social??{})},landing:{...DEFAULTS.landing,...(data?.draft?.landing??{})},analytics:{...DEFAULTS.analytics,...(data?.draft?.analytics??{})}} as unknown as import('@/lib/site-settings').SiteSettings;const rules=await getPublicRules();return <><div className="fixed right-4 top-4 z-50 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-black">Admin draft preview</div><LandingPage settings={settings} rules={rules}/></>}
