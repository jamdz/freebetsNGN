import { TIME_ZONE } from './config'

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('en-NG')

export function formatNaira(value: number) { return naira.format(value) }
export function formatPoints(value: number) { return `${number.format(value)} pts` }
export function formatKickoff(value: string | Date) {
  return new Intl.DateTimeFormat('en-NG', { timeZone: TIME_ZONE, weekday: 'short', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}
