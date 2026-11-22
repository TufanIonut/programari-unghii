// Aceleași reguli ca AvailabilityCalculator din backend (C#), pentru versiunea demo.
// Orele sunt în minute de la miezul nopții, în ora locală a dispozitivului.

import type { DayAvailability, SalonSettings } from '../api/scheduling'

export interface Window {
  start: number
  end: number
}

export interface Busy {
  start: number
  blockedUntil: number // sfârșitul lucrării + pauza
}

const pad = (n: number) => String(n).padStart(2, '0')
const toHHMM = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const dayDiff = (a: string, b: string) => {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

export function availabilityForDay(
  date: string,
  settings: SalonSettings,
  windows: Window[],
  busy: Busy[],
  isDayOff: boolean,
  duration: number,
  now: Date,
): DayAvailability {
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const ahead = dayDiff(today, date)

  if (ahead < 0) return { date, status: 'past', slots: [] }
  if (ahead > settings.bookingWindowDays) return { date, status: 'too_far', slots: [] }
  if (isDayOff) return { date, status: 'day_off', slots: [] }
  if (windows.length === 0) return { date, status: 'closed', slots: [] }

  // „doar în avans”: cel mai devreme moment, exprimat în minute față de începutul zilei `date`
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const earliest = nowMin + settings.minNoticeHours * 60 - ahead * 1440

  const lastEnd = Math.max(...windows.map((w) => w.end))
  if (lastEnd - duration < earliest) return { date, status: 'past', slots: [] }

  const pause = settings.breakMinutes
  const candidates = new Set<number>([...windows.map((w) => w.start), Math.ceil(earliest / 10) * 10])
  for (const b of busy) {
    candidates.add(b.blockedUntil)
    candidates.add(b.start - pause - duration)
  }

  const overlaps = (s: number, e: number) => busy.some((b) => s < b.blockedUntil && b.start < e)
  const slots = [...candidates]
    .filter(
      (s) =>
        s >= earliest &&
        windows.some((w) => s >= w.start && s + duration <= w.end) &&
        !overlaps(s, s + duration + pause),
    )
    .sort((a, b) => a - b)
    .map(toHHMM)

  return { date, status: slots.length ? 'available' : 'full', slots }
}
