export type AdNetwork = 'A-ADS' | 'Adsterra'
export type AdSize = '320x100' | '300x250' | '728x90'
export type AdPage = 'Home' | 'Fixtures' | 'Predictions' | 'Leaderboard' | 'Rewards' | 'Earn' | 'Referrals' | 'Profile' | 'Spin'
export type AdPosition = 'top' | 'inline' | 'bottom' | 'sidebar'
export type AdPlacementSlot = { position: AdPosition; network: AdNetwork; size: AdSize }
export type AdSettings = {
  previewMode: boolean
  networks: {
    aads: { active: boolean; units: Record<AdSize, string>; unitActive: Record<AdSize, boolean> }
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

const blockedPath = (pathname: string) => /\/(?:login|signup|join|verify|forgot-password|console-internal|admin)(?:\/|$)/i.test(pathname)

export const adPageFromPath = (pathname: string): AdPage | null => {
  if (blockedPath(pathname)) return null
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
