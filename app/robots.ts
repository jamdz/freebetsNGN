import type { MetadataRoute } from 'next'
import { siteSettings } from '@/lib/site-settings'
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/profile', '/console-internal'] }, sitemap: `${siteSettings.seo.canonicalDomain}/sitemap.xml` } }
