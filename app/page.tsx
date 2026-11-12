import type { Metadata } from 'next'
import { LandingPage } from '@/components/landing-page'
import { getSiteSettings,getSeoPage } from '@/lib/server/site-content'
export async function generateMetadata():Promise<Metadata>{const [settings,seo]=await Promise.all([getSiteSettings(),getSeoPage('home')]);return {title:seo?.title??settings.siteName,description:seo?.description??settings.seo.description,robots:seo?.noindex?{index:false,follow:false}:{index:true,follow:true}}}
export default async function Page(){const settings=await getSiteSettings();return <LandingPage settings={settings}/>}
