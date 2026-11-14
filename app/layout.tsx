import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/components/auth-provider'
import './globals.css'
import { AdConsentBanner } from '@/components/ads/consent-banner'
import { getSiteSettings } from '@/lib/server/site-content'
import { ConsentAnalytics } from '@/components/consent-analytics'
import { PwaRegistration } from '@/components/pwa-registration'
import { SiteBrandProvider } from '@/components/site-brand'
import { DEFAULTS } from '@/lib/site-settings'

export async function generateMetadata(): Promise<Metadata> { const settings=await getSiteSettings(); const domain=(()=>{try{return new URL(process.env.NEXT_PUBLIC_SITE_URL || settings.seo.canonicalDomain)}catch{return new URL('https://example.invalid')}})(); const defaultTemplate=DEFAULTS.seo.titleTemplate.replace(DEFAULTS.siteName,settings.siteName); const isDefaultTemplate=settings.seo.titleTemplate===defaultTemplate||settings.seo.titleTemplate===`%s — ${DEFAULTS.siteName}`; const titleTemplate=isDefaultTemplate?`%s | ${settings.siteName}`:settings.seo.titleTemplate; return { title:{default:`${settings.siteName} — ${settings.tagline}`,template:titleTemplate}, description:settings.seo.description, robots:{index:false,follow:false}, metadataBase:domain, openGraph:{title:settings.siteName,description:settings.seo.description,siteName:settings.siteName,type:'website',images:settings.ogImageUrl?[{url:settings.ogImageUrl}]:undefined}, twitter:{card:'summary_large_image',title:settings.siteName,description:settings.seo.description,images:settings.ogImageUrl?[settings.ogImageUrl]:undefined},icons:settings.faviconUrl?{icon:settings.faviconUrl,apple:settings.faviconUrl}:undefined } }
export const viewport: Viewport = { themeColor: '#22c55e', userScalable: true }
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { const settings=await getSiteSettings(); return <html lang="en"><body style={{'--primary':settings.primary,'--accent':settings.accent} as React.CSSProperties}><SiteBrandProvider value={{siteName:settings.siteName,tagline:settings.tagline,logoUrl:settings.logoUrl}}><AuthProvider>{children}<PwaRegistration/><AdConsentBanner/><ConsentAnalytics enabled={settings.analytics?.enabled??settings.gaEnabled} measurementId={settings.analytics?.measurementId??settings.gaMeasurementId} customScripts={settings.analytics?.customScripts??''} customScriptsEnabled={settings.analytics?.customScriptsEnabled??false}/></AuthProvider></SiteBrandProvider></body></html> }
