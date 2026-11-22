// Datele circulă ca text „AAAA-LL-ZZ”, în ora salonului; nu folosim Date pentru logică,
// ca să nu apară decalaje de o zi din cauza fusului orar al browserului.

export const MONTHS = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
]

export const WEEKDAYS_SHORT = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du']
export const WEEKDAYS_LONG = ['luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică']

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

export function parseISO(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { year: y, month: m - 1, day: d }
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/** 0 = luni … 6 = duminică */
export function weekdayIndex(iso: string): number {
  const { year, month, day } = parseISO(iso)
  return (new Date(Date.UTC(year, month, day)).getUTCDay() + 6) % 7
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  return { from: toISO(year, month, 1), to: toISO(year, month, daysInMonth(year, month)) }
}

/** Celulele lunii, începând cu luni; null pentru golurile de la început. */
export function monthCells(year: number, month: number): (string | null)[] {
  const first = toISO(year, month, 1)
  const blanks: null[] = Array(weekdayIndex(first)).fill(null)
  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => toISO(year, month, i + 1))
  return [...blanks, ...days]
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta
  return { year: Math.floor(total / 12), month: total % 12 }
}

/** „marți, 24 noiembrie” */
export function formatLong(iso: string): string {
  const { month, day } = parseISO(iso)
  return `${WEEKDAYS_LONG[weekdayIndex(iso)]}, ${day} ${MONTHS[month]}`
}

/** Data de azi în ora salonului. */
export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date())
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  const hours = h === 1 ? '1 oră' : `${h} ore`
  return m ? `${hours} și ${m} min` : hours
}
