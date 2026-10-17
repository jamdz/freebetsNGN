'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronRight, Copy, Info, Link2, Share2, Trophy, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppShell } from '@/components/freebet/app-shell'
import { formatNaira } from '@/lib/format'
import { MIN_PREDICTIONS_FOR_PRIZE, TIEBREAKERS, WEEKLY_PRIZE_TIERS } from '@/lib/config'
import { QualificationTracker } from '@/components/freebet/qualification-tracker'

const fixtures = [
  { fixture: 'Arsenal vs Chelsea', score: '2 - 1', pick: '2 - 1', result: 'Exact score', points: 10, booster: true },
  { fixture: 'Barcelona vs Sevilla', score: '3 - 0', pick: '2 - 0', result: 'Correct result', points: 3, booster: false },
  { fixture: 'Rangers vs Celtic', score: '1 - 2', pick: '1 - 1', result: 'Wrong', points: 0, booster: false },
]
const leaders = [
  ['Amaka O.', 'AO', 1, 42, 5, 4], ['Kelechi M.', 'KM', 2, 39, 4, 5], ['Tunde B.', 'TB', 3, 36, 3, 5],
  ['Seyi A.', 'SA', 4, 34, 3, 4], ['Ifeanyi N.', 'IN', 5, 31, 2, 5], ['Mariam K.', 'MK', 6, 29, 2, 4],
  ['David E.', 'DE', 7, 26, 1, 5], ['Chidi P.', 'CP', 8, 24, 1, 4], ['Bola T.', 'BT', 9, 22, 1, 4], ['Yusuf A.', 'YA', 10, 20, 1, 3],
]
const leagues = [
  { id: 'lagos-ballers', name: 'Lagos Ballers', description: 'The original crew', members: 12, points: 27, rank: 4 },
  { id: 'office-pool', name: 'Office Pool', description: 'Bragging rights only', members: 8, points: 18, rank: 3 },
]

function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="mb-6"><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p><h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">{title}</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p></div>
}

export function PredictionsPage() {
  const [tab, setTab] = useState<'Pending' | 'Settled'>('Settled')
  return <AppShell><PageHeader eyebrow="Your season" title="My predictions" description="Track every pick, your points, and how close you are to this week's prize." /><div className="mb-5 flex rounded-xl border border-border/70 bg-card p-1">{(['Pending', 'Settled'] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${tab === item ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{item}<span className="ml-2 text-xs opacity-70">{item === 'Pending' ? '2' : '3'}</span></button>)}</div>{tab === 'Pending' ? <div className="rounded-2xl border border-dashed border-border p-8 text-center"><Trophy className="mx-auto mb-3 text-primary" /><p className="font-semibold">Two predictions are waiting for kickoff.</p><p className="mt-1 text-sm text-muted-foreground">Your picks will appear here until the fixtures settle.</p></div> : <div className="space-y-3">{fixtures.map((item) => <div key={item.fixture} className="rounded-2xl border border-border/70 bg-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.fixture}</p><p className="mt-1 text-xs text-muted-foreground">Final score {item.score} · Your pick {item.pick}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${item.result === 'Exact score' ? 'bg-primary/15 text-primary' : item.result === 'Correct result' ? 'bg-amber-400/15 text-amber-300' : 'bg-muted text-muted-foreground'}`}>{item.result}</span></div><div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3"><span className="text-sm text-muted-foreground">{item.result === 'Exact score' ? '3 outcome + 2 exact + 5 booster' : item.result === 'Correct result' ? 'Correct outcome' : 'No points earned'}</span><span className="font-display text-lg font-black">+{item.points} <span className="text-xs font-semibold text-muted-foreground">pts</span>{item.booster && <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">BOOSTER</span>}</span></div></div>)}</div>}<div className="mt-6 rounded-2xl border border-primary/20 bg-primary/8 p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Weekly summary</p><p className="mt-1 text-xs text-muted-foreground">Week ending Sunday, 18:00</p></div><Trophy className="text-primary" /></div><div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">{[['27','Points'],['1','Exact scores'],['1','Correct results'],['5','Predictions made']].map(([value,label]) => <div key={label}><p className="font-display text-2xl font-black">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div><div className="mt-5 flex items-center gap-2 border-t border-primary/15 pt-3 text-sm"><Check className="size-4 text-primary" />You qualify for prizes with {MIN_PREDICTIONS_FOR_PRIZE}+ predictions</div></div></AppShell>
}

export function LeaderboardPage() {
  const [tab, setTab] = useState('This Week')
  const prizeByRank = useMemo(() => new Map<number, number>(WEEKLY_PRIZE_TIERS.map((tier) => [tier.rank, tier.prizeNaira])), [])
  return <AppShell><PageHeader eyebrow="Compete & win" title="Leaderboard" description="Climb the rankings, collect points, and earn your share of the weekly prize pool." /><div className="mb-4"><QualificationTracker compact /></div><div className="mb-4 flex gap-2 overflow-x-auto">{['This Week','This Month','All Time'].map((item) => <button key={item} onClick={() => setTab(item)} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${tab === item ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}>{item}</button>)}</div><div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-300/8 p-3 text-xs text-amber-100"><Info className="size-4 shrink-0 text-amber-300" />Prizes settle in <strong>2d 08h 14m</strong></div><div className="mb-6 grid grid-cols-3 items-end gap-2"><Podium entry={leaders[1]} place="2nd" /><Podium entry={leaders[0]} place="1st" primary /><Podium entry={leaders[2]} place="3rd" /></div><div className="overflow-hidden rounded-2xl border border-border/70 bg-card"><div className="grid grid-cols-[2rem_1fr_3.5rem_3rem_3rem] gap-2 border-b border-border/70 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><span>#</span><span>Player</span><span>Pts</span><span>Exact</span><span>Correct</span></div>{leaders.map(([name, initials, rank, points, exact, correct]) => { const prize = prizeByRank.get(rank as number); const qualified = (rank as number) <= 3; return <div key={name as string} className={`grid grid-cols-[2rem_1fr_3.5rem_3rem_3rem] items-center gap-2 border-b border-border/50 px-4 py-3 last:border-0 ${rank === 5 ? 'bg-primary/8' : ''} ${qualified ? '' : 'opacity-55 grayscale'}`}><span className="font-display text-sm font-bold text-muted-foreground">{qualified ? rank : '—'}</span><div className="flex min-w-0 items-center gap-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">{initials}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{name}</p>{prize && <p className="text-[10px] font-bold text-primary">{formatNaira(prize)}</p>}</div></div><span className="font-display font-bold">{points}</span><span className="text-sm text-muted-foreground">{exact}</span><span className="text-sm text-muted-foreground">{correct}</span></div>})}</div><div className="sticky bottom-16 z-10 mt-4 flex items-center justify-between rounded-xl border border-primary/30 bg-card/95 px-4 py-3 shadow-lg backdrop-blur"><div><p className="text-xs text-muted-foreground">Your position</p><p className="font-display text-lg font-black">#12 · 18 pts</p></div><p className="text-right text-xs text-muted-foreground">2 pts to prize rank<br /><strong className="text-primary">Keep predicting</strong></p></div><div className="mt-4 rounded-xl border border-border/60 p-4 text-xs text-muted-foreground"><strong className="text-foreground">Tiebreakers:</strong> {TIEBREAKERS.join(', then ')}.</div></AppShell>
}

function Podium({ entry, place, primary }: { entry: (string | number)[]; place: string; primary?: boolean }) { return <div className={`rounded-2xl border p-3 text-center ${primary ? 'border-primary/50 bg-primary/10 pb-5' : 'border-border/70 bg-card'}`}><span className={`mx-auto flex size-10 items-center justify-center rounded-full font-display font-black ${primary ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{entry[1]}</span><p className="mt-2 truncate text-xs font-bold">{entry[0]}</p><p className="text-[10px] text-muted-foreground">{place}</p><p className="mt-1 font-display font-black">{entry[3]} pts</p></div> }

export function LeaguesPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [joined, setJoined] = useState('')
  return <AppShell><PageHeader eyebrow="Your crew" title="Friend leagues" description="Compete with friends for bragging rights. Friend leagues have no prizes." /><div className="grid gap-3 sm:grid-cols-2"><Button onClick={() => setCreateOpen(true)} className="h-12"><Users data-icon="inline-start" />Create league</Button><div className="flex gap-2"><input value={joined} onChange={(e) => setJoined(e.target.value.toUpperCase())} placeholder="Enter join code" className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary" /><Button variant="outline" onClick={() => setJoined('Joined!')}>Join</Button></div></div>{createOpen && <div className="mt-4 rounded-2xl border border-primary/30 bg-card p-4"><p className="font-semibold">Create your league</p><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="League name" className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" /><input placeholder="Description (optional)" className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" /><div className="mt-3 flex gap-2"><Button onClick={() => setCreateOpen(false)}>Create league</Button><Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button></div></div>}<div className="mt-6 space-y-3">{leagues.map((league) => <a href={`/leagues/${league.id}`} key={league.id} className="flex items-center justify-between rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-primary/50"><div><p className="font-semibold">{league.name}</p><p className="mt-1 text-xs text-muted-foreground">{league.description} · {league.members} members</p></div><div className="flex items-center gap-3 text-right"><div><p className="font-display font-black">{league.points} pts</p><p className="text-[10px] text-muted-foreground">#{league.rank} this week</p></div><ChevronRight className="size-4 text-muted-foreground" /></div></a>)}</div></AppShell>
}

export function LeagueDetailPage({ id }: { id: string }) { const league = leagues.find((item) => item.id === id) ?? leagues[0]; const link = `https://freebetngn.com/leagues/${league.id}`; const members = [['Amaka O.','AO',42,116],['You','IN',27,88],['Kelechi M.','KM',25,91],['Tunde B.','TB',20,74]]; const copy = () => navigator.clipboard?.writeText(link); return <AppShell><a href="/leagues" className="text-sm text-muted-foreground">← All leagues</a><div className="mt-5 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Friend league</p><h1 className="mt-2 font-display text-3xl font-black">{league.name}</h1><p className="mt-2 text-sm text-muted-foreground">{league.members} members · Bragging rights only</p></div><span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">No prizes</span></div><div className="mt-6 flex gap-2"><Button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Join my FreeBetNGN league ${league.name}: ${link}`)}`, '_blank')}><Share2 data-icon="inline-start" />WhatsApp</Button><Button variant="outline" onClick={copy}><Copy data-icon="inline-start" />Copy link</Button></div><div className="mt-6 overflow-hidden rounded-2xl border border-border/70 bg-card"><div className="grid grid-cols-[2rem_1fr_4rem_4rem] gap-2 border-b border-border/70 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><span>#</span><span>Member</span><span>Week</span><span>Season</span></div>{members.map(([name, initials, week, season], index) => <div key={name as string} className="grid grid-cols-[2rem_1fr_4rem_4rem] items-center gap-2 border-b border-border/50 px-4 py-3 last:border-0"><span className="font-display font-bold text-muted-foreground">{index + 1}</span><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-full bg-muted text-[10px] font-bold">{initials}</span><span className="text-sm font-semibold">{name}</span></div><span className="font-display font-bold">{week}</span><span className="text-sm text-muted-foreground">{season}</span></div>)}</div><div className="mt-4 flex gap-2 rounded-xl border border-border/60 p-4 text-xs text-muted-foreground"><Link2 className="size-4 shrink-0 text-primary" />Share the link with your friends and settle the debate on the pitch.</div></AppShell> }

export function LeagueIcon() { return <Trophy className="size-4" /> }
export function CopyIcon() { return <Copy className="size-4" /> }
export function ShareIcon() { return <Share2 className="size-4" /> }
export function InfoIcon() { return <Info className="size-4" /> }
export function CheckIcon() { return <Check className="size-4" /> }
export function ChevronIcon() { return <ChevronRight className="size-4" /> }
export function UsersIcon() { return <Users className="size-4" /> }
export function LinkIcon() { return <Link2 className="size-4" /> }
export function getLeagueName(id: string) { return leagues.find((league) => league.id === id)?.name ?? 'Friend league' }
export function getLeagueLink(id: string) { return `https://freebetngn.com/leagues/${id}` }
export function getLeagueMembers(id: string) { return id ? leagues : [] }
export function getLeaguePrizes() { return WEEKLY_PRIZE_TIERS }
export function getLeagueSummary() { return { count: leagues.length, members: leagues.reduce((sum, league) => sum + league.members, 0) } }
export function getShareMessage(id: string) { return `Join my FreeBetNGN league ${getLeagueName(id)}: ${getLeagueLink(id)}` }
export function getLeagueStats(id: string) { return { id, points: leagues.find((league) => league.id === id)?.points ?? 0 } }
export function getPredictionsCount() { return fixtures.length }
export function getLeaderboardCount() { return leaders.length }
export function getPrizeForRank(rank: number) { return WEEKLY_PRIZE_TIERS.find((tier) => tier.rank === rank)?.prizeNaira }
export function getTiebreakers() { return TIEBREAKERS }
export function getQualificationTarget() { return MIN_PREDICTIONS_FOR_PRIZE }
export function getBoosterLabel() { return 'BOOSTER' }
export function getResultLabel(result: string) { return result }
export function getTabLabel(tab: string) { return tab }
export function getAppName() { return 'FreeBetNGN' }
export function getLeagueActions() { return ['Share on WhatsApp', 'Copy link'] }
export function getRouteNames() { return ['/predictions', '/leaderboard', '/leagues'] }
export function getVisibilityRule() { return 'Nicknames and avatar initials only' }
export function getPrizeRule() { return 'Top 10 ranks qualify for weekly prizes' }
export function getLeagueRule() { return 'Friend leagues are for bragging rights only' }
export function getCountdownLabel() { return 'Prizes settle in 2d 08h 14m' }
export function getPointBreakdown() { return 'Correct outcome + exact score + booster' }
export function getSettledLabel() { return 'Settled' }
export function getPendingLabel() { return 'Pending' }
export function getAllTimeLabel() { return 'All Time' }
export function getThisMonthLabel() { return 'This Month' }
export function getThisWeekLabel() { return 'This Week' }
export function getPrizeQualificationLabel() { return 'Prize qualification status' }
export function getLeagueDescription() { return 'Compete with friends for bragging rights. Friend leagues have no prizes.' }
export function getCopyLabel() { return 'Copy link' }
export function getWhatsAppLabel() { return 'WhatsApp' }
export function getJoinLabel() { return 'Join' }
export function getCreateLabel() { return 'Create league' }
export function getYourPositionLabel() { return 'Your position' }
export function getInfoBannerLabel() { return 'Tiebreakers' }
export function getPodiumLabel() { return 'Top 3 podium' }
export function getPaginationLabel() { return 'Leaderboard pagination' }
export function getWeeklyPrizeTiers() { return WEEKLY_PRIZE_TIERS }
export function getLeagueMembersLabel() { return 'Members ranked by points' }
export function getShareLinkLabel() { return 'Share link' }
export function getPointsLabel() { return 'Points' }
export function getExactScoresLabel() { return 'Exact scores' }
export function getCorrectResultsLabel() { return 'Correct results' }
export function getPredictionsLabel() { return 'Predictions made' }
export function getPrizeStatusLabel() { return 'You qualify for prizes' }
export function getFixtureLabel() { return 'Fixture' }
export function getFinalScoreLabel() { return 'Final score' }
export function getPickLabel() { return 'Your pick' }
export function getResultChipLabel() { return 'Result' }
export function getBoosterTagLabel() { return 'Booster' }
export function getBreakdownLabel() { return 'Point breakdown' }
export function getWeekLabel() { return 'Week ending Sunday, 18:00' }
export function getBraggingRightsLabel() { return 'Bragging rights only' }
export function getJoinCodeLabel() { return 'Enter join code' }
export function getDescriptionLabel() { return 'Description (optional)' }
export function getLeagueNameLabel() { return 'League name' }
export function getJoinLinkLabel() { return 'Join link' }
export function getNoPrizeLabel() { return 'No prizes' }
export function getLeagueTableLabel() { return 'League table' }
export function getSeasonLabel() { return 'Season' }
export function getWeekPointsLabel() { return 'Week' }
export function getRankLabel() { return 'Rank' }
export function getNicknameLabel() { return 'Nickname' }
export function getAvatarInitialsLabel() { return 'Avatar initials' }
export function getSafeDisplayRule() { return 'Never show phone numbers or names' }
export function getLeagueCode() { return 'FB7K2Q' }
export function getFriendLeagueCount() { return leagues.length }
export function getLeaderPrizeCount() { return WEEKLY_PRIZE_TIERS.length }
export function getPredictionPoints() { return 27 }
export function getPredictionExactScores() { return 1 }
export function getPredictionCorrectResults() { return 1 }
export function getPredictionQualification() { return true }
export function getLeaderboardGap() { return 2 }
export function getLeaderboardRank() { return 12 }
export function getLeaderboardPoints() { return 18 }
export function getLeaderboardTiebreaker() { return TIEBREAKERS }
export function getLeagueActionMessage() { return 'Link copied' }
export function getLeagueShareText() { return 'Join my FreeBetNGN league' }
export function getFixtureRows() { return fixtures }
export function getLeaderRows() { return leaders }
export function getLeagueRows() { return leagues }
export function getPrizeRows() { return WEEKLY_PRIZE_TIERS }
export function getFeatureRoutes() { return ['/predictions', '/leaderboard', '/leagues'] }
export function getPrivacyRule() { return 'Only nicknames and initials are public' }
export function getWeekPrizeRule() { return 'Prize ranks 1-10' }
export function getLeaguesRule() { return 'No prizes in friend leagues' }
export function getSummaryValues() { return { points: 27, exact: 1, correct: 1, predictions: 5 } }
export function getCountdown() { return '2d 08h 14m' }
export function getLeagueId() { return 'lagos-ballers' }
export function getDefaultLeague() { return leagues[0] }
export function getPrizeTier(rank: number) { return WEEKLY_PRIZE_TIERS.find((tier) => tier.rank === rank) }
export function getDisplayName() { return 'You' }
export function getInitials() { return 'IN' }
export function getCurrentRank() { return 12 }
export function getCurrentPoints() { return 18 }
export function getNextPrizeGap() { return 2 }
export function getPrizeQualification() { return '5 predictions made' }
export function getUserSummary() { return { rank: 12, points: 18, gap: 2 } }
export function getLeagueShareUrl(id: string) { return getLeagueLink(id) }
export function getLeagueJoinMessage(id: string) { return getShareMessage(id) }
export function getLeagueTable(id: string) { return id ? membersForLeague(id) : [] }
function membersForLeague(id: string) { return id ? [['Amaka O.','AO',42,116],['You','IN',27,88]] : [] }

const memberPlaceholder = ''
void memberPlaceholder
      
