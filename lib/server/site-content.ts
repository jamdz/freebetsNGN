import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULTS, type SiteSettings } from '@/lib/site-settings'

const readSettings = unstable_cache(async () => { const { data } = await createAdminClient().from('site_settings').select('published').eq('id', true).maybeSingle(); return { ...DEFAULTS, ...(data?.published ?? {}), seo: { ...DEFAULTS.seo, ...(data?.published?.seo ?? {}) }, legal: { ...DEFAULTS.legal, ...(data?.published?.legal ?? {}) }, social: { ...DEFAULTS.social, ...(data?.published?.social ?? {}) } } as SiteSettings }, ['site-settings'], { revalidate: 300, tags: ['site-settings'] })
export const getSiteSettings = readSettings
export async function getSeoPage(pageKey: string) { const { data } = await createAdminClient().from('seo_pages').select('page_key,title,description,noindex').eq('page_key', pageKey).maybeSingle(); return data }
export async function getLegalPage(slug: string) { const { data } = await createAdminClient().from('legal_pages').select('slug,title,published_content,effective_date,show_draft_banner').eq('slug', slug).maybeSingle(); return data }
