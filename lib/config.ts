export const POINTS_CORRECT_OUTCOME = 3
export const POINTS_EXACT_SCORE_BONUS = 2
export const BOOSTER_MULTIPLIER = 2
export const BOOSTERS_PER_WEEK = 1
export const STREAK_BOOSTER_DAYS = 3
export const MIN_PREDICTIONS_FOR_PRIZE = 5
export const WEEKLY_PRIZE_TIERS = [
  { rank: 1, prizeNaira: 5000 },
  { rank: 2, prizeNaira: 3000 },
  { rank: 3, prizeNaira: 2000 },
  { rank: 4, prizeNaira: 1000 },
  { rank: 5, prizeNaira: 500 },
] as const
export const MIN_AIRTIME_WITHDRAWAL_NAIRA = 100
export const OFFER_HOLD_DAYS = 7
export const REFERRAL_BONUS_NAIRA = 50
export const REFERRAL_REQUIRED_PREDICTIONS = 10

export const TIEBREAKERS = [
  'more exact scores',
  'more correct outcomes',
  'earlier first prediction of the week',
] as const

export const TIME_ZONE = 'Africa/Lagos'
export const APP_NAME = 'FreeBetNGN'
export const NAV_ITEMS = ['Home', 'Fixtures', 'Leaderboard', 'Rewards', 'Profile'] as const
export const LEAGUE_NAMES = ['Premier League', 'La Liga', 'Champions League', 'NPFL'] as const
