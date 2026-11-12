import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/components/auth-provider'
import './globals.css'
import { AdConsentBanner } from '@/components/ads/consent-banner'
import { GlobalAdScripts } from '@/components/ads/AdSlot'
import { getSiteSettings } from '@/lib/server/site-content'
import { ConsentAnalytics } from '@/components/consent-analytics'

export async function generateMetadata(): Promise<Metadata> { const settings=await getSiteSettings(); const domain=(()=>{try{return new URL(settings.seo.canonicalDomain)}catch{return new URL('https://freebetngn.com')}})(); const ogImage=(settings as any).ogImageUrl; return { title:`${settings.siteName} — ${settings.tagline}`, description:settings.seo.description, robots:{index:false,follow:false}, metadataBase:domain, openGraph:{title:settings.siteName,description:settings.seo.description,siteName:settings.siteName,type:'website',images:ogImage?[{url:ogImage}]:undefined}, twitter:{card:'summary_large_image',title:settings.siteName,description:settings.seo.description,images:ogImage?[ogImage]:undefined},icons:(settings as any).faviconUrl?{icon:(settings as any).faviconUrl}:undefined } }
export const viewport: Viewport = { themeColor: '#22c55e', userScalable: false }
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { const settings=await getSiteSettings(); return <html lang="en"><body style={{'--primary':settings.primary,'--accent':settings.accent} as React.CSSProperties}><AuthProvider>{children}<GlobalAdScripts/><AdConsentBanner/><ConsentAnalytics enabled={settings.analytics?.enabled??settings.gaEnabled} measurementId={settings.analytics?.measurementId??settings.gaMeasurementId} customScripts={settings.analytics?.customScripts??''} customScriptsEnabled={settings.analytics?.customScriptsEnabled??false}/></AuthProvider></body></html> }
