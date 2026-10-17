export type MockUser = {
  id: string
  nickname: string
  phone: string
  password: string
  rewardBalanceNaira: number
  pendingWithdrawal: boolean
}

const users: MockUser[] = []
let rewardBalanceNaira = 1250
let pendingWithdrawal = false

export function findMockUser(identifier: string, password?: string) {
  const normalized = identifier.trim().toLowerCase()
  return users.find((user) => (user.nickname.toLowerCase() === normalized || user.phone === identifier.trim()) && (!password || user.password === password))
}

export function createMockUser(input: Omit<MockUser, 'id' | 'rewardBalanceNaira' | 'pendingWithdrawal'>) {
  const user = { ...input, id: `u_${Date.now()}`, rewardBalanceNaira: 1250, pendingWithdrawal: false }
  users.push(user)
  return user
}

export function getMockWithdrawalState() { return { rewardBalanceNaira, pendingWithdrawal } }
export function setMockWithdrawalPending(value: boolean) { pendingWithdrawal = value }
export function debitMockBalance(amount: number) { rewardBalanceNaira -= amount }
