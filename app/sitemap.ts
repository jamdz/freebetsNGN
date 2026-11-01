import type { MetadataRoute } from 'next'
import { getSiteSettings } from '@/lib/server/site-content'
export default async function sitemap(): Promise<MetadataRoute.Sitemap> { const settings=await getSiteSettings(); const pages=['','terms','privacy','prize-rules','responsible-play']; return pages.map(path=>({url:`${settings.seo.canonicalDomain}/${path}`,lastModified:new Date()})) }
