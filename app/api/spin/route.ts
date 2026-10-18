import { creditMockBalance, getQualification, getSpinState, setSpinUsed } from '@/lib/mock-store'

const outcomes = [{ outcome: 'win' as const, amountNaira: 500, segmentIndex: 0 }, { outcome: 'try-again' as const, segmentIndex: 1 }, { outcome: 'win' as const, amountNaira: 100, segmentIndex: 2 }, { outcome: 'try-again' as const, segmentIndex: 3 }, { outcome: 'win' as const, amountNaira: 250, segmentIndex: 4 }, { outcome: 'try-again' as const, segmentIndex: 5 }, { outcome: 'win' as const, amountNaira: 1000, segmentIndex: 6 }, { outcome: 'try-again' as const, segmentIndex: 7 }]

export async function POST() {
  const { used } = getSpinState()
  if (used) return Response.json({ error: 'Already spun' }, { status: 409 })
  const qualification = getQualification('demo-user')
  const activeDays = qualification.days.filter((day) => day.fixtures >= 4 && day.predictions >= 4).length
  if (activeDays < 6) return Response.json({ error: 'Not eligible: complete qualification' }, { status: 403 })
  const outcome = outcomes[2]
  setSpinUsed(true)
  if (outcome.outcome === 'win') creditMockBalance(outcome.amountNaira)
  return Response.json(outcome)
}
