import { NextResponse } from 'next/server'
import { fixtures } from '@/lib/mock-data'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const fixture = fixtures.find((item) => item.id === body?.fixtureId)
  if (!fixture) return NextResponse.json({ message: 'Fixture not found.' }, { status: 404 })
  if (fixture.status !== 'scheduled') return NextResponse.json({ message: 'This fixture is locked.' }, { status: 409 })
  if (!Number.isInteger(body?.homeScore) || !Number.isInteger(body?.awayScore) || body.homeScore < 0 || body.awayScore < 0) return NextResponse.json({ message: 'Enter a valid scoreline.' }, { status: 400 })
  return NextResponse.json({ message: 'Prediction saved.', prediction: { fixtureId: fixture.id, homeScore: body.homeScore, awayScore: body.awayScore, booster: Boolean(body.booster) } })
}
