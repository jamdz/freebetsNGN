import type { MetadataRoute } from 'next'
import { getSiteSettings } from '@/lib/server/site-content'
export default async function robots(): Promise<MetadataRoute.Robots> { const settings=await getSiteSettings(); return { rules:[{userAgent:'*',allow:'/',disallow:['/admin','/api','/login','/signup','/rewards','/profile','/predictions','/spin','/leaderboard']}], sitemap:`${settings.seo.canonicalDomain}/sitemap.xml` } }
