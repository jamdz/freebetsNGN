export function getLagosDateRange(year: number, month?: number) {
  const start = `${year}-${String(month ?? 1).padStart(2, '0')}-01T00:00:00+01:00`
  const endMonth = month ? month === 12 ? 1 : month + 1 : 1
  const endYear = month === 12 ? year + 1 : month ? year : year + 1
  return { start, end: `${endYear}-${String(endMonth).padStart(2, '0')}-01T00:00:00+01:00` }
}

export function parseLagosYearMonth(searchParams: URLSearchParams) {
  const yearValue = Number(searchParams.get('year'))
  const monthValue = Number(searchParams.get('month'))
  const year = Number.isInteger(yearValue) && yearValue >= 2000 && yearValue <= 2200 ? yearValue : null
  const month = year && Number.isInteger(monthValue) && monthValue >= 1 && monthValue <= 12 ? monthValue : null
  return { year, month }
}
