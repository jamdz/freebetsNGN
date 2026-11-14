import { AdminLoginForm } from '@/components/admin/admin-login-form'
import { getSiteSettings } from '@/lib/server/site-content'

export default async function AdminLoginPage() {
  const settings = await getSiteSettings()
  return <AdminLoginForm siteName={settings.siteName} logoUrl={settings.logoUrl} tagline={settings.tagline} />
}
