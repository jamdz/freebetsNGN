'use client'

import { Fragment, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Check, ChevronRight, CircleDollarSign, ClipboardList, Database, Globe2, LayoutDashboard, ListChecks, Mail, Menu, Settings, ShieldCheck, Sparkles, Trophy, UserRound, Users, Wallet, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OverviewPanel } from '@/components/admin/overview-panel'
import { FixturesPanel } from '@/components/admin/fixtures-panel'
import { SettlementPanel } from '@/components/admin/settlement-panel'
import { PrizesPanel } from '@/components/admin/prizes-panel'
import { UsersPanel } from '@/components/admin/users-panel'
import { TreasuryPanel } from '@/components/admin/treasury-panel'
import { SettingsPanel } from '@/components/admin/settings-panel'
import { SpinPanel } from '@/components/admin/spin-panel'
import { ReferralsPanel } from '@/components/admin/referrals-panel'
import { WithdrawalsPanel } from '@/components/admin/withdrawals-panel'
import { ApiConfigurationPanel } from '@/components/admin/api-configuration-panel'
import { SiteSettingsPanel } from '@/components/admin/site-settings-panel'
import { AdsOffersPanel } from '@/components/admin/ads-offers-panel'
import { CommunicationsPanel } from '@/components/admin/communications-panel'
import { AuditLogPanel } from '@/components/admin/audit-log-panel'
import { SecurityPanel } from '@/components/admin/security-panel'
import { BrandMark } from '@/components/site-brand'

type Section = 'Overview' | 'Audit log' | 'Fixtures' | 'Settlement' | 'Prizes' | 'Spin the Wheel' | 'Referrals' | 'Withdrawals' | 'API Configuration' | 'Treasury' | 'Users' | 'Site settings' | 'Ads and Offers' | 'Email and SMS' | 'Settings' | 'Security'
const navItems: { name: Section; icon: typeof LayoutDashboard }[] = [{ name: 'Overview', icon: LayoutDashboard }, { name: 'Audit log', icon: ClipboardList }, { name: 'Fixtures', icon: ListChecks }, { name: 'Settlement', icon: Check }, { name: 'Prizes', icon: Trophy }, { name: 'Spin the Wheel', icon: Sparkles }, { name: 'Referrals', icon: Users }, { name: 'Withdrawals', icon: Wallet }, { name: 'API Configuration', icon: Database }, { name: 'Treasury', icon: CircleDollarSign }, { name: 'Users', icon: UserRound }, { name: 'Site settings', icon: Globe2 }, { name: 'Ads and Offers', icon: BarChart3 }, { name: 'Email and SMS', icon: Mail }, { name: 'Settings', icon: Settings }, { name: 'Security', icon: ShieldCheck }]

export default function AdminPage() {
  const router = useRouter(); const [active, setActive] = useState<Section>('Overview'); const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => { fetch('/api/admin/session').then((response) => { if (!response.ok) router.replace(`${window.location.pathname}/login`) }).catch(() => router.replace(`${window.location.pathname}/login`)) }, [router])
  const previewAudit = () => undefined
  const panel = active === 'Overview' ? <OverviewPanel onViewAudit={() => setActive('Audit log')} /> : active === 'Audit log' ? <AuditLogPanel /> : active === 'Fixtures' ? <FixturesPanel /> : active === 'Settlement' ? <SettlementPanel /> : active === 'Prizes' ? <PrizesPanel /> : active === 'Spin the Wheel' ? <SpinPanel audit={previewAudit} /> : active === 'Referrals' ? <ReferralsPanel audit={previewAudit} /> : active === 'Withdrawals' ? <WithdrawalsPanel audit={previewAudit} /> : active === 'API Configuration' ? <ApiConfigurationPanel audit={previewAudit} /> : active === 'Treasury' ? <TreasuryPanel /> : active === 'Users' ? <UsersPanel /> : active === 'Site settings' ? <SiteSettingsPanel audit={previewAudit} /> : active === 'Ads and Offers' ? <AdsOffersPanel audit={previewAudit} /> : active === 'Email and SMS' ? <CommunicationsPanel audit={previewAudit} /> : active === 'Settings' ? <SettingsPanel /> : <SecurityPanel />
  const navigation = <><div className="mb-6"><BrandMark size="md" showName/></div><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Operations</p><div className="flex flex-col gap-1">{navItems.map(({ name, icon: Icon }) => <Fragment key={name}>{name === 'Security' && <p className="mb-2 mt-5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Platform</p>}<button onClick={() => { setActive(name); setMobileOpen(false) }} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${active === name ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon className="size-4" />{name}<ChevronRight className="ml-auto size-3" /></button></Fragment>)}</div><div className="my-6 h-px bg-border" /><button className="flex items-center gap-3 px-3 text-sm text-muted-foreground" onClick={() => router.push('/home')}><X className="size-4" />Exit admin</button><button onClick={async () => { await fetch('/api/admin/logout', { method: 'POST' }); router.replace(`${window.location.pathname}/login`) }} className="mt-3 px-3 text-left text-sm text-muted-foreground">Log out</button></>
  return <div className="min-h-screen bg-background text-foreground"><Button variant="outline" size="icon" className="fixed right-4 top-4 z-30 lg:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu"><Menu className="size-4" /></Button><aside className={`fixed inset-y-0 left-0 z-20 w-64 border-r bg-card p-5 transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}><nav>{navigation}</nav></aside><main className="min-h-screen p-5 lg:ml-64 lg:p-8"><div id={active.toLowerCase().replaceAll(' ', '-')}>{panel}</div></main></div>
}
