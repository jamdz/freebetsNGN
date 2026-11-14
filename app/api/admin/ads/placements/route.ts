import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi, writeAudit } from '@/lib/admin-api'
import { readAdSettings, AD_PAGES, AD_SIZES } from '@/lib/server/ads'
import type { AdPage } from '@/lib/ad-settings'

const slotSchema = z.object({ position: z.enum(['top', 'inline', 'bottom', 'sidebar']), network: z.enum(['A-ADS', 'Adsterra']), size: z.enum(AD_SIZES as [typeof AD_SIZES[number], ...typeof AD_SIZES]) }).superRefine((slot, context) => {
  if (slot.size === 'native' && slot.network !== 'Adsterra') context.addIssue({ code: 'custom', message: 'Native slots require Adsterra', path: ['network'] })
})
const pageSchema = z.object({ page: z.enum(AD_PAGES as [AdPage, ...AdPage[]]), enabled: z.boolean(), slots: z.array(slotSchema).max(5) })
const inputSchema = z.object({ placements: z.array(pageSchema).length(AD_PAGES.length) }).superRefine(({ placements }, context) => {
  const pages = placements.map(({ page }) => page)
  if (new Set(pages).size !== AD_PAGES.length || AD_PAGES.some((page) => !pages.includes(page as AdPage))) context.addIssue({ code: 'custom', message: 'Provide one placement entry for each supported page', path: ['placements'] })
})

export async function GET() {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  try {
    const { placements } = await readAdSettings()
    await writeAudit(auth.supabase, 'view_ads_settings', 'ads', 'placements')
    return NextResponse.json({ placements }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to load ad placements' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdminApi()
  if ('response' in auth) return auth.response
  const parsed = inputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid ad placements', issues: parsed.error.flatten() }, { status: 400 })
  const db = auth.supabase
  const rows = parsed.data.placements.map(({ page, enabled, slots }) => ({ page_key: page, enabled, slots, updated_at: new Date().toISOString() }))
  const { error } = await db.from('ad_placements').upsert(rows, { onConflict: 'page_key' })
  if (error) return NextResponse.json({ error: 'Unable to save ad placements' }, { status: 500 })
  await writeAudit(auth.supabase, 'save_ads_placements', 'ads', 'placements', { details: { pages: rows.length } })
  return NextResponse.json({ ok: true })
}
