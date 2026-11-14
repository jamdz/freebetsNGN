import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
import { getSeoPage, getSiteSettings } from '@/lib/server/site-content'
export async function generateMetadata():Promise<Metadata>{const seo=await getSeoPage('privacy');return {title:seo?.title??'Privacy Policy',description:seo?.description,robots:seo?.noindex?{index:false,follow:false}:{index:true,follow:true}}}
export default async function PrivacyPage(){const {siteName}=await getSiteSettings();return <LegalPage slug="privacy" title="Privacy Policy"><p>We collect the information needed to provide your account, predictions, rewards, safety controls, and support.</p><h2>How we use information</h2><p>We use account and prediction data to operate {siteName}, prevent abuse, and communicate important service updates.</p><h2>Your choices</h2><p>You may contact support to ask about your data or account.</p></LegalPage>}
