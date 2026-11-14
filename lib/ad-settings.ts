export type AdNetwork = 'A-ADS' | 'Adsterra'
export type AdSize = '320x100' | '300x250' | '728x90' | 'native'
export type AdPage = 'Home' | 'Fixtures' | 'Predictions' | 'Leaderboard' | 'Rewards' | 'Earn' | 'Referrals' | 'Profile' | 'Spin' | 'Landing' | 'Login' | 'Signup' | 'Terms' | 'Privacy' | 'PrizeRules' | 'ResponsiblePlay'
export const PUBLIC_FORM_AD_LIMITS = { pages: ['Login', 'Signup'] as const, maxSlots: 1, position: 'bottom' as const, globalScripts: false, reason: 'Ads above or beside a sign-in form reduce sign-ups and can look like phishing.' }
export function isValidPublicFormPlacement(page: AdPage, slots: AdPlacementSlot[]) {
  return !PUBLIC_FORM_AD_LIMITS.pages.includes(page as typeof PUBLIC_FORM_AD_LIMITS.pages[number]) || (slots.length <= PUBLIC_FORM_AD_LIMITS.maxSlots && slots.every((slot) => slot.position === PUBLIC_FORM_AD_LIMITS.position))
}
export type AdPosition = 'top' | 'inline' | 'bottom' | 'sidebar'
export type AdPlacementSlot = { position: AdPosition; network: AdNetwork; size: AdSize }
export type AdSettings = {
  previewMode: boolean
  networks: {
    aads: { active: boolean; units: Record<AdSize, string>; unitActive: Record<AdSize, boolean> }
    adcash: { enabled: boolean; input: string; format: 'autotag' | 'pop' | null; zoneId: string; allowedPages: AdPage[] }
    adsterra: {
      active: boolean
      banner: Record<AdSize, string>
      bannerActive: Record<AdSize, boolean>
      native: string
      nativeActive: boolean
      socialBar: string
      socialBarActive: boolean
      popunder: string
      popunderActive: boolean
      smartlink: string
      smartlinkActive: boolean
    }
  }
  offerwall: { active: boolean; provider: string; appId: string; embedUrl: string; rewardShare: number; holdDays: number; fxRate: number }
  placements: Record<AdPage, { enabled: boolean; slots: AdPlacementSlot[] }>
  popunder: { enabled: boolean; frequencyMinutes: number; pages: AdPage[] }
}

const blockedPath = (pathname: string) => /\/(?:join|verify|forgot-password|reset-password|console-internal|admin)(?:\/|$)/i.test(pathname) || /^\/auth(?:\/|$)/i.test(pathname)

export const adPageFromPath = (pathname: string): AdPage | null => {
  if (blockedPath(pathname)) return null
  const publicPages: Record<string, AdPage> = { '/': 'Landing', '/login': 'Login', '/signup': 'Signup', '/terms': 'Terms', '/privacy': 'Privacy', '/prize-rules': 'PrizeRules', '/responsible-play': 'ResponsiblePlay' }
  if (publicPages[pathname.toLowerCase()]) return publicPages[pathname.toLowerCase()]
  if (pathname.includes('/fixtures')) return 'Fixtures'
  if (pathname.includes('/leaderboard')) return 'Leaderboard'
  if (pathname.includes('/predictions')) return 'Predictions'
  if (pathname.includes('/home') || pathname === '/') return 'Home'
  if (pathname.includes('/earn')) return 'Earn'
  if (pathname.includes('/referral')) return 'Referrals'
  if (pathname.includes('/rewards')) return 'Rewards'
  if (pathname.includes('/profile')) return 'Profile'
  if (pathname.includes('/spin')) return 'Spin'
  return null
}
