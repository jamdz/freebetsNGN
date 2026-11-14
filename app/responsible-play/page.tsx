import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
import { getPublicRules } from '@/lib/server/public-rules'
import { getSeoPage, getSiteSettings } from '@/lib/server/site-content'

const money = (amount: number) => `₦${new Intl.NumberFormat('en-NG').format(amount)}`

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoPage('responsible-play')
  return { title: seo?.title ?? 'Responsible Play', description: seo?.description, robots: seo?.noindex ? { index: false, follow: false } : { index: true, follow: true } }
}

export default async function ResponsiblePlayPage() {
  const [rules, settings] = await Promise.all([getPublicRules(), getSiteSettings()])
  const { minAirtimeNaira, minCashNaira } = rules.withdrawalMinimums

  return <LegalPage slug="responsible-play" title="Responsible Play" supplementalContent={(minAirtimeNaira !== null || minCashNaira !== null) && <section className="flex flex-col gap-3 border-t pt-5"><h2 className="font-display text-xl font-bold text-foreground">Reward withdrawal minimums</h2>{minAirtimeNaira !== null && <p>Minimum airtime redemption: {money(minAirtimeNaira)}.</p>}{minCashNaira !== null && <p>Minimum bank withdrawal: {money(minCashNaira)}.</p>}</section>}><p>{settings.siteName} is a prediction game with no stakes, deposits, or betting. Keep it light and enjoyable.</p><h2>Healthy habits</h2><p>Set a time limit, take breaks, keep predictions in perspective, and never let the game interrupt sleep, work, school, or relationships. Do not chase losses because there are no losses to chase.</p><h2>Need support?</h2><p>If playing starts to feel difficult to control, stop and talk to someone you trust. Contact a qualified mental-health professional or a local support service in your area for confidential help.</p></LegalPage>
}
