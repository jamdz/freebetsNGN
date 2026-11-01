import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { AuthProvider } from '@/components/auth-provider'
import './globals.css'
import { AdConsentBanner } from '@/components/ads/consent-banner'
import { GlobalAdScripts } from '@/components/ads/AdSlot'
import { getSiteSettings } from '@/lib/server/site-content'

export async function generateMetadata(): Promise<Metadata> { const settings=await getSiteSettings(); return { title:`${settings.siteName} — ${settings.tagline}`, description:settings.seo.description, metadataBase:new URL(settings.seo.canonicalDomain), openGraph:{title:settings.siteName,description:settings.seo.description,siteName:settings.siteName,type:'website'}, twitter:{card:'summary_large_image',title:settings.siteName,description:settings.seo.description} } }
export const viewport: Viewport = { themeColor: '#22c55e', userScalable: false }
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { const settings=await getSiteSettings(); return <html lang="en"><body><AuthProvider>{children}<GlobalAdScripts/><AdConsentBanner/>{settings.analytics?.enabled&&settings.analytics.measurementId&&<Script id="site-analytics" src={`https://www.googletagmanager.com/gtag/js?id=${settings.analytics.measurementId}`} strategy="afterInteractive"/>}</AuthProvider></body></html> }
