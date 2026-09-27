// Fechas "locales" del usuario como strings ISO (YYYY-MM-DD), igual que daily_activity.local_date.

export function localDateISO(timeZone: string, date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function parse(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

export function addDaysISO(iso: string, days: number): string {
  const d = parse(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 0 = lunes … 6 = domingo */
export function weekdayIndex(iso: string): number {
  return (parse(iso).getUTCDay() + 6) % 7
}

export function mondayOf(iso: string): string {
  return addDaysISO(iso, -weekdayIndex(iso))
}

export function isoRange(startIso: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDaysISO(startIso, i))
}

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es', { ...options, timeZone: 'UTC' })
const longFmt = fmt({ weekday: 'long', day: 'numeric', month: 'long' })
const shortFmt = fmt({ weekday: 'short', day: 'numeric', month: 'short' })
const narrowWeekday = fmt({ weekday: 'narrow' })

/** "lunes, 21 de septiembre" */
export const formatLong = (iso: string) => longFmt.format(parse(iso))
/** "lun, 21 sept" */
export const formatShort = (iso: string) => shortFmt.format(parse(iso))
/** "L" */
export const formatWeekdayNarrow = (iso: string) => narrowWeekday.format(parse(iso)).toUpperCase()
export const dayOfMonth = (iso: string) => parse(iso).getUTCDate()
