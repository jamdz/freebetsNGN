let rewardBalanceNaira = 1250
let pendingWithdrawal = false
let pendingWithdrawalMethods: Partial<Record<'airtime' | 'bank', boolean>> = {}
let spinUsed = false

export function getMockWithdrawalState() { return { rewardBalanceNaira, pendingWithdrawal } }
export function setMockWithdrawalPending(value: boolean) { pendingWithdrawal = value }
export function getMockWithdrawalMethodState(method: 'airtime' | 'bank') { return Boolean(pendingWithdrawalMethods[method]) }
export function setMockWithdrawalMethodPending(method: 'airtime' | 'bank', value: boolean) { pendingWithdrawalMethods[method] = value }
export function debitMockBalance(amount: number) { rewardBalanceNaira -= amount }
export function getSpinState() { return { used: spinUsed } }
export function setSpinUsed(value: boolean) { spinUsed = value }
export function creditMockBalance(amount: number) { rewardBalanceNaira += amount }

export function getQualification(userId: string, gameweek = 'current') {
  return { userId, gameweek, days: [{ day: 'Mon', predictions: 4, fixtures: 6 }, { day: 'Tue', predictions: 5, fixtures: 5 }, { day: 'Wed', predictions: 2, fixtures: 6 }, { day: 'Thu', predictions: 0, fixtures: 3 }, { day: 'Fri', predictions: 4, fixtures: 4 }, { day: 'Sat', predictions: 4, fixtures: 8 }, { day: 'Sun', predictions: 4, fixtures: 4 }] }
}
