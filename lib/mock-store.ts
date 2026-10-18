export type MockUser = {
  id: string
  nickname: string
  email?: string
  phone: string
  password: string
  rewardBalanceNaira: number
  pendingWithdrawal: boolean
}

const users: MockUser[] = []
let rewardBalanceNaira = 1250
let pendingWithdrawal = false
let pendingWithdrawalMethods: Partial<Record<'airtime' | 'bank', boolean>> = {}
let spinUsed = false

export function findMockUser(identifier: string, password?: string) {
  const normalized = identifier.trim().toLowerCase()
  return users.find((user) => (user.nickname.toLowerCase() === normalized || user.phone === identifier.trim() || user.email?.toLowerCase() === normalized) && (!password || user.password === password))
}

export function createMockUser(input: Omit<MockUser, 'id' | 'rewardBalanceNaira' | 'pendingWithdrawal'>) {
  const user = { ...input, id: `u_${Date.now()}`, rewardBalanceNaira: 1250, pendingWithdrawal: false }
  users.push(user)
  return user
}

export function getMockWithdrawalState() { return { rewardBalanceNaira, pendingWithdrawal } }
export function setMockWithdrawalPending(value: boolean) { pendingWithdrawal = value }
export function getMockWithdrawalMethodState(method: 'airtime' | 'bank') { return Boolean(pendingWithdrawalMethods[method]) }
export function setMockWithdrawalMethodPending(method: 'airtime' | 'bank', value: boolean) { pendingWithdrawalMethods[method] = value }
export function debitMockBalance(amount: number) { rewardBalanceNaira -= amount }
export function getSpinState() { return { used: spinUsed } }
export function setSpinUsed(value: boolean) { spinUsed = value }
export function creditMockBalance(amount: number) { rewardBalanceNaira += amount }

export function getReferralMockData() { return { general: { code: 'TUNDE86', link: 'https://freebetngn.com/join/TUNDE86' }, promo: { code: 'PREDICT24', link: 'https://freebetngn.com/campaign/PREDICT24', name: 'October Predictor Drive', registered: 684, target: 1000, reward: 100 }, logs: [{ friend: 'Ada***42', program: 'General', date: 'Oct 12, 2026', activeDays: 11, activeTarget: 24, predictions: 7, reward: 50, status: 'In progress' }, { friend: 'Chi***08', program: 'Promotion', date: 'Oct 8, 2026', activeDays: 0, activeTarget: 1, predictions: 10, reward: 100, status: 'Pending' }, { friend: 'Em***19', program: 'General', date: 'Sep 28, 2026', activeDays: 24, activeTarget: 24, predictions: 12, reward: 50, status: 'Credited' }] } }

export function getQualification(userId: string, gameweek = 'current') {
  return { userId, gameweek, days: [{ day: 'Mon', predictions: 4, fixtures: 6 }, { day: 'Tue', predictions: 5, fixtures: 5 }, { day: 'Wed', predictions: 2, fixtures: 6 }, { day: 'Thu', predictions: 0, fixtures: 3 }, { day: 'Fri', predictions: 4, fixtures: 4 }, { day: 'Sat', predictions: 4, fixtures: 8 }, { day: 'Sun', predictions: 4, fixtures: 4 }] }
}
