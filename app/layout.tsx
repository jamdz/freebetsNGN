import type { Metadata } from 'next'
import { AuthProvider } from '@/components/auth-provider'
import './globals.css'
import { AdConsentBanner } from '@/components/ads/consent-banner'
import { GlobalAdScripts } from '@/components/ads/AdSlot'
import { siteSettings } from '@/lib/site-settings'

export const metadata: Metadata = { title: `${siteSettings.siteName} — ${siteSettings.tagline}`, description: siteSettings.seo.description, metadataBase: new URL(siteSettings.seo.canonicalDomain), openGraph: { title: siteSettings.siteName, description: siteSettings.seo.description, siteName: siteSettings.siteName, type: 'website' }, twitter: { card: 'summary_large_image', title: siteSettings.siteName, description: siteSettings.seo.description } }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><AuthProvider>{children}<GlobalAdScripts /><AdConsentBanner /></AuthProvider></body></html> }
