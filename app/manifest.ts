import type { MetadataRoute } from 'next'
import { getSiteSettings } from '@/lib/server/site-content'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSiteSettings()
  const themeColor = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(settings.primary) ? settings.primary : '#22c55e'
  return {
    name: settings.siteName,
    short_name: settings.siteName.slice(0, 12),
    description: "Nigeria's free football prediction league.",
    start_url: '/',
    display: 'standalone',
    background_color: '#101a14',
    theme_color: themeColor,
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  }
}
