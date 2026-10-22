const LAGOS_TIME_ZONE = 'Africa/Lagos'

export function lagosDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LAGOS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function addLagosDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return lagosDate(new Date(Date.UTC(year, month - 1, day + days, 12)))
}
