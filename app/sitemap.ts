import type { MetadataRoute } from 'next'
import { siteSettings } from '@/lib/site-settings'
export default function sitemap(): MetadataRoute.Sitemap { const base = siteSettings.seo.canonicalDomain; return ['/', '/terms', '/privacy', '/prize-rules', '/responsible-play', '/login', '/signup'].map((path) => ({ url: `${base}${path}`, lastModified: new Date(siteSettings.legal.lastUpdated) })) }
