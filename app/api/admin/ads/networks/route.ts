import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi, writeAudit } from '@/lib/admin-api'
import { readAdSettings } from '@/lib/server/ads'
import { createAdminClient } from '@/lib/supabase/admin'
import { saveIntegration } from '@/lib/server/integrations'
import type { AdPage } from '@/lib/ad-settings'
import { AD_PAGES, safeCreative, safeScriptUrl } from '@/lib/server/ads'
import { isHttpsUrl } from '@/lib/server/ads'
import { isAadsUnitId, parseAdSnippet } from '@/lib/server/ad-snippets'

const sizeRecord = <T extends z.ZodTypeAny>(value: T) => z.object({ '320x100': value, '300x250': value, '728x90': value })
const creative = z.string().max(8192).refine((value) => !value || Boolean(safeCreative(value)), 'Use a single HTTPS script/iframe tag or an HTTPS URL')
const bannerSnippet = z.string().max(8192).refine((value) => !value || parseAdSnippet(value).ok, 'Paste a supported ad snippet')
const aadsUnit = z.string().max(8192).refine((value) => !value || isAadsUnitId(value) || parseAdSnippet(value).ok, 'Use a 3–12 digit A-ADS unit ID or a supported ad snippet')
const scriptUrl = z.string().max(2048).refine((value) => !value || Boolean(safeScriptUrl(value)), 'Use an HTTPS .js script URL or full script tag')
const schema = z.object({
  previewMode: z.boolean(),
  networks: z.object({
    aads: z.object({ active: z.boolean(), units: sizeRecord(aadsUnit), unitActive: sizeRecord(z.boolean()) }),
    adsterra: z.object({ active: z.boolean(), banner: sizeRecord(bannerSnippet), bannerActive: sizeRecord(z.boolean()), native: creative, nativeActive: z.boolean(), socialBar: scriptUrl, socialBarActive: z.boolean(), popunder: scriptUrl, popunderActive: z.boolean(), smartlink: z.string().max(2048).refine((value) => !value || (Boolean(safeCreative(value)?.kind === 'url')), 'Use an HTTPS smartlink URL'), smartlinkActive: z.boolean() }),
  }),
  offerwall: z.object({ active: z.boolean(), provider: z.string().trim().min(1).max(80), appId: z.string().trim().max(200), embedUrl: z.string().trim().max(2048).refine((value) => !value || (value.includes('{userId}') && isHttpsUrl(value.replaceAll('{userId}', 'test-user'))), 'Use an HTTPS embed template containing {userId}'), rewardShare: z.number().min(0).max(100), holdDays: z.number().int().min(0).max(365), fxRate: z.number().positive().max(1_000_000) }),
  popunder: z.object({ enabled: z.boolean(), frequencyMinutes: z.number().int().min(1).max(1440), pages: z.array(z.enum(AD_PAGES as [AdPage, ...AdPage[]])).max(AD_PAGES.length) }),
  postbackSecret: z.string().max(500).optional(),
})

export async function GET() {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  try {
    const [settings, secretResult] = await Promise.all([
      readAdSettings(),
      createAdminClient().from('integration_settings').select('secret_ciphertext').eq('key', 'offerwall_adgem').maybeSingle(),
    ])
    if (secretResult.error) throw secretResult.error
    await writeAudit(auth.supabase, 'view_ads_settings', 'ads', 'networks')
    return NextResponse.json({ ...settings, postbackSecretConfigured: Boolean(secretResult.data?.secret_ciphertext) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to load ad settings' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid ad settings', issues: parsed.error.flatten() }, { status: 400 })
  const input = parsed.data
  if (input.postbackSecret?.trim() && !process.env.INTEGRATION_ENCRYPTION_KEY) return NextResponse.json({ error: 'The integration encryption key is required before saving a postback secret.' }, { status: 503 })
  const db = auth.supabase
  try {
    const aadsConfig = { units: input.networks.aads.units, unitActive: input.networks.aads.unitActive }
    const adsterraConfig = { ...input.networks.adsterra, socialBar: safeScriptUrl(input.networks.adsterra.socialBar), popunder: safeScriptUrl(input.networks.adsterra.popunder), previewMode: input.previewMode, popunderSettings: input.popunder }
    const { error: networkError } = await db.from('ad_networks').upsert([
      { id: 'aads', enabled: input.networks.aads.active, config: aadsConfig, updated_at: new Date().toISOString() },
      { id: 'adsterra', enabled: input.networks.adsterra.active, config: adsterraConfig, updated_at: new Date().toISOString() },
    ], { onConflict: 'id' })
    if (networkError) throw networkError
    const { error: integrationError } = await db.from('integration_settings').select('key').eq('key', 'offerwall_adgem').maybeSingle()
    if (integrationError) throw integrationError
    const publicConfig = { provider: input.offerwall.provider, appId: input.offerwall.appId, embedUrlTemplate: input.offerwall.embedUrl, rewardShare: input.offerwall.rewardShare, holdDays: input.offerwall.holdDays, fxRate: input.offerwall.fxRate }
    if (input.postbackSecret?.trim()) {
      await saveIntegration('offerwall_adgem', { publicConfig, secrets: { postbackSecret: input.postbackSecret.trim() }, isActive: input.offerwall.active }, process.env.ADMIN_EMAIL ?? 'admin')
    } else {
      const { data: existing, error } = await db.from('integration_settings').select('secret_ciphertext').eq('key', 'offerwall_adgem').maybeSingle()
      if (error) throw error
      const { error: saveError } = await db.from('integration_settings').upsert({ key: 'offerwall_adgem', public_config: publicConfig, secret_ciphertext: existing?.secret_ciphertext ?? null, is_active: input.offerwall.active, updated_by: process.env.ADMIN_EMAIL ?? 'admin', updated_at: new Date().toISOString() }, { onConflict: 'key' })
      if (saveError) throw saveError
    }
    await writeAudit(auth.supabase, 'save_ads_networks', 'ads', 'networks', { details: { admin_email: process.env.ADMIN_EMAIL ?? 'admin' } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message.includes('INTEGRATION_ENCRYPTION_KEY') ? 'The integration encryption key is required before saving a postback secret.' : 'Unable to save ad settings' }, { status: 500 })
  }
}
