import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
import { getSeoPage } from '@/lib/server/site-content'
export async function generateMetadata():Promise<Metadata>{const seo=await getSeoPage('prize-rules');return {title:seo?.title??'Prize Rules',description:seo?.description,robots:seo?.noindex?{index:false,follow:false}:{index:true,follow:true}}}
export default function PrizeRulesPage(){return <LegalPage slug="prize-rules" title="Prize Rules"><p>FreeBetNGN prizes are free promotional rewards. No purchase, deposit, or stake is required.</p><h2>Qualification</h2><p>Players must meet the published prediction and account requirements for the relevant gameweek.</p><h2>Responsible promotion</h2><p>Prizes are subject to verification, eligibility, and the published terms.</p></LegalPage>}
