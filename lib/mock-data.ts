import type { Competition, Fixture, LeaderboardEntry, League, Prediction, Team, User, WalletEntry } from './types'

export const competitions: Competition[] = [
  { id: 'prem', name: 'Premier League', shortName: 'EPL', color: '#38BDF8' },
  { id: 'laliga', name: 'La Liga', shortName: 'LAL', color: '#FB923C' },
  { id: 'ucl', name: 'Champions League', shortName: 'UCL', color: '#818CF8' },
  { id: 'npfl', name: 'NPFL', shortName: 'NPFL', color: '#34D399' },
]

const team = (id: string, name: string, initials: string, color: string): Team => ({ id, name, shortName: name, initials, color })
const teams = [
  team('ars', 'Arsenal', 'ARS', '#EF4444'), team('che', 'Chelsea', 'CHE', '#3B82F6'), team('liv', 'Liverpool', 'LIV', '#DC2626'), team('mci', 'Man City', 'MCI', '#38BDF8'),
  team('bar', 'Barcelona', 'BAR', '#A855F7'), team('rma', 'Real Madrid', 'RMA', '#F8FAFC'), team('atm', 'Atlético', 'ATM', '#EF4444'), team('sev', 'Sevilla', 'SEV', '#F97316'),
  team('psg', 'PSG', 'PSG', '#2563EB'), team('bay', 'Bayern', 'BAY', '#DC2626'), team('int', 'Inter', 'INT', '#1D4ED8'), team('mil', 'AC Milan', 'MIL', '#EF4444'),
  team('rivers', 'Rivers United', 'RIV', '#14B8A6'), team('enugu', 'Enugu Rangers', 'RAN', '#22C55E'), team('plateau', 'Plateau Utd', 'PLT', '#F59E0B'), team('sunshine', 'Sunshine Stars', 'SUN', '#F97316'),
]
const kickoff = (day: number, hour: number) => new Date(2026, 9, day, hour, 30).toISOString()
export const fixtures: Fixture[] = [
  ['f1','prem',0,1,18],['f2','prem',2,3,20],['f3','prem',1,3,13],['f4','prem',0,2,16],['f5','prem',3,0,19],['f6','prem',2,1,15],
  ['f7','laliga',4,5,17],['f8','laliga',6,7,20],['f9','laliga',5,6,15],['f10','laliga',7,4,18],['f11','laliga',4,6,20],['f12','laliga',5,7,16],
  ['f13','ucl',8,9,19],['f14','ucl',10,11,19],['f15','ucl',9,10,20],['f16','ucl',11,8,20],['f17','ucl',8,10,18],['f18','ucl',9,11,18],
  ['f19','npfl',12,13,16],['f20','npfl',14,15,16],['f21','npfl',13,14,17],['f22','npfl',15,12,17],['f23','npfl',12,14,18],['f24','npfl',13,15,18],
].map(([id, competitionId, home, away, hour], index) => ({ id: String(id), competitionId: String(competitionId), homeTeam: teams[Number(home)], awayTeam: teams[Number(away)], kickoff: kickoff(17 + Math.floor(index / 4), Number(hour)), status: 'scheduled' as const }))

export const sampleUser: User = { id: 'u1', displayName: 'Tunde A.', initials: 'TA', phoneNumber: '0803 123 4567', points: 248, weeklyPoints: 86, rewardBalanceNaira: 1250, rank: 12, streak: 4, predictionsCount: 18 }
export const leaderboard: LeaderboardEntry[] = Array.from({ length: 20 }, (_, index) => ({ rank: index + 1, userId: `u${index + 1}`, displayName: ['Chuka P.', 'Adaeze K.', 'Bello M.', 'Seyi O.', 'Ifeoma N.'][index % 5], initials: ['CP','AK','BM','SO','IN'][index % 5], points: 142 - index * 4, exactScores: Math.max(0, 8 - Math.floor(index / 3)), correctOutcomes: 20 - index, firstPredictionAt: kickoff(17, 8), prizeNaira: index < 5 ? [5000, 3000, 2000, 1000, 500][index] : undefined }))
export const samplePredictions: Prediction[] = fixtures.slice(0, 6).map((fixture, index) => ({ id: `p${index + 1}`, userId: sampleUser.id, fixtureId: fixture.id, homeScore: index % 3, awayScore: (index + 1) % 3, points: index % 2 ? 3 : 5, isBooster: index === 1, submittedAt: kickoff(16, 10) }))
export const leagues: League[] = [{ id: 'friends', name: 'Weekend Ballers', memberCount: 24, rank: 3, points: 86 }, { id: 'campus', name: 'UNILAG Predictors', memberCount: 102, rank: 18, points: 86 }]
export const walletEntries: WalletEntry[] = [{ id: 'w1', type: 'credit', amountNaira: 1000, description: 'Weekly leaderboard prize', createdAt: kickoff(10, 12) }, { id: 'w2', type: 'credit', amountNaira: 250, description: 'Welcome reward', createdAt: kickoff(3, 9) }]
