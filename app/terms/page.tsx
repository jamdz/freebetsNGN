import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
import { getSeoPage } from '@/lib/server/site-content'
export async function generateMetadata():Promise<Metadata>{const seo=await getSeoPage('terms');return {title:seo?.title??'Terms of Service',description:seo?.description,robots:seo?.noindex?{index:false,follow:false}:{index:true,follow:true}}}
export default function TermsPage(){return <LegalPage slug="terms" title="Terms of Service"><p>FreeBetNGN is a free football prediction service. By using it, you agree to use one account, provide accurate information, and follow these terms.</p><h2>Eligibility</h2><p>You must be at least 18 years old and legally able to use this service in Nigeria. No payment or stake is required.</p><h2>Accounts and conduct</h2><p>Keep your account secure. Do not cheat, automate entries, impersonate others, or interfere with the service.</p></LegalPage>}
