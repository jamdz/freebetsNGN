export const BOOSTERS_PER_WEEK = 1
export const OFFER_HOLD_DAYS = 7
export const REFERRAL_BONUS_NAIRA = 50
export const GENERAL_REFERRAL_RULES = { rewardNaira: 50, activeDaysRequired: 24, windowDays: 28, minPredictions: 10, minPredictionsPerActiveDay: 1 } as const
export const REFERRAL_REQUIRED_PREDICTIONS = 10
export const TIEBREAKERS = [
  'more exact scores',
  'more correct outcomes',
  'earlier first prediction of the week',
] as const

export const TIME_ZONE = 'Africa/Lagos'
export const NAV_ITEMS = ['Home', 'Fixtures', 'Leaderboard', 'Rewards', 'Profile'] as const
