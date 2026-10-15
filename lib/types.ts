export type FixtureStatus = 'scheduled' | 'live' | 'finished' | 'postponed'
export type WalletEntryType = 'credit' | 'debit'
export type WithdrawalStatus = 'pending' | 'paid' | 'rejected'

export type Competition = { id: string; name: string; shortName: string; color: string }
export type Team = { id: string; name: string; shortName: string; initials: string; color: string }
export type Fixture = {
  id: string; competitionId: string; homeTeam: Team; awayTeam: Team; kickoff: string
  status: FixtureStatus; homeScore?: number; awayScore?: number
}
export type Prediction = {
  id: string; userId: string; fixtureId: string; homeScore: number; awayScore: number
  points: number; isBooster: boolean; submittedAt: string
}
export type LeaderboardEntry = {
  rank: number; userId: string; displayName: string; initials: string; points: number
  exactScores: number; correctOutcomes: number; firstPredictionAt: string; prizeNaira?: number
}
export type League = { id: string; name: string; memberCount: number; rank: number; points: number }
export type WalletEntry = {
  id: string; type: WalletEntryType; amountNaira: number; description: string; createdAt: string
}
export type Withdrawal = {
  id: string; amountNaira: number; phoneNumber: string; status: WithdrawalStatus; createdAt: string
}
export type User = {
  id: string; displayName: string; initials: string; phoneNumber: string; points: number
  weeklyPoints: number; rewardBalanceNaira: number; rank: number; streak: number; predictionsCount: number
}
