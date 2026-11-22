// Server simulat pentru versiunea demo (GitHub Pages, fără backend).
// Răspunde la aceleași rute ca API-ul .NET, cu aceleași reguli pentru orele libere,
// și păstrează datele în localStorage — rămân doar pe dispozitivul pe care rulează demo-ul.

import type { AuthResponse, User } from '../api/client'
import type { AdminAppointment, Appointment, DayOff, SalonSettings } from '../api/scheduling'
import { addDaysISO, availabilityForDay, type Busy } from './availability'

interface StoredUser extends User {
  password: string
}

interface StoredAppointment {
  id: string
  clientId: string
  date: string
  start: string // HH:mm
  end: string
  blockedUntil: string // HH:mm, include pauza
  status: 'booked' | 'cancelled'
}

interface DemoDb {
  version: number
  users: StoredUser[]
  appointments: StoredAppointment[]
  daysOff: DayOff[]
  settings: SalonSettings
  sessionUserId: string | null
}

const KEY = 'programari-demo-db'
const VERSION = 1
export const DEMO_ADMIN_EMAIL = 'admin@demo.ro'

// ---------------------------------------------------------------- stocare

let memoryDb: DemoDb | null = null

function load(): DemoDb {
  if (memoryDb) return memoryDb
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DemoDb
      if (parsed.version === VERSION) return (memoryDb = parsed)
    }
  } catch {
    /* stocare indisponibilă (mod privat) → lucrăm doar în memorie */
  }
  return (memoryDb = seed())
}

function save(db: DemoDb) {
  memoryDb = db
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* ignorăm: demo-ul merge și fără persistență */
  }
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const todayISO = () => toISO(new Date())

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const toHHMM = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`

/** Date de început: câteva cliente programate în zilele următoare, ca să arate realist. */
function seed(): DemoDb {
  const settings: SalonSettings = {
    workStart: '08:00',
    workEnd: '16:00',
    workDays: [1, 2, 3, 4, 5],
    breakMinutes: 10,
    minNoticeHours: 12,
    bookingWindowDays: 60,
    defaultDurationMinutes: 120,
  }

  const clients: StoredUser[] = [
    { id: uid(), email: 'ioana@exemplu.ro', firstName: 'Ioana', lastName: 'Popescu', role: 'client', password: uid() },
    { id: uid(), email: 'elena@exemplu.ro', firstName: 'Elena', lastName: 'Marin', role: 'client', password: uid() },
    { id: uid(), email: 'andreea@exemplu.ro', firstName: 'Andreea', lastName: 'Stan', role: 'client', password: uid() },
  ]
  const admin: StoredUser = {
    id: uid(), email: DEMO_ADMIN_EMAIL, firstName: 'Admin', lastName: 'Salon', role: 'admin', password: uid(),
  }

  const db: DemoDb = { version: VERSION, users: [admin, ...clients], appointments: [], daysOff: [], settings, sessionUserId: null }

  // umplem câteva zile lucrătoare din următoarele 3 săptămâni
  const pattern = [2, 1, 3, 0, 2, 1, 4, 2, 0, 3, 1, 2, 3]
  let day = addDaysISO(todayISO(), 2)
  for (let i = 0; i < pattern.length; i++, day = addDaysISO(day, 1)) {
    const wd = isoWeekday(day)
    if (!settings.workDays.includes(wd)) continue
    let start = toMin(settings.workStart)
    for (let k = 0; k < Math.min(pattern[i], 3); k++) {
      const end = start + settings.defaultDurationMinutes
      db.appointments.push({
        id: uid(),
        clientId: clients[(i + k) % clients.length].id,
        date: day,
        start: toHHMM(start),
        end: toHHMM(end),
        blockedUntil: toHHMM(end + settings.breakMinutes),
        status: 'booked',
      })
      start = end + settings.breakMinutes
    }
  }

  // o zi liberă marcată de proprietară, în săptămâna următoare
  let off = addDaysISO(todayISO(), 9)
  while (!settings.workDays.includes(isoWeekday(off))) off = addDaysISO(off, 1)
  db.daysOff.push({ date: off, note: 'Concediu' })

  save(db)
  return db
}

function isoWeekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const wd = new Date(y, m - 1, d).getDay()
  return wd === 0 ? 7 : wd
}

// ---------------------------------------------------------------- răspunsuri

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  })

const problem = (status: number, detail: string) => json(status, { status, detail })

const publicUser = (u: StoredUser): User => ({
  id: u.id,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  role: u.role,
})

function session(db: DemoDb, user: StoredUser): AuthResponse {
  db.sessionUserId = user.id
  save(db)
  return {
    accessToken: `demo.${user.id}`,
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    user: publicUser(user),
  }
}

function currentUser(db: DemoDb, headers: Headers): StoredUser | null {
  const auth = headers.get('Authorization') ?? ''
  const id = auth.startsWith('Bearer demo.') ? auth.slice('Bearer demo.'.length) : null
  return db.users.find((u) => u.id === id) ?? null
}

function busyFor(db: DemoDb, date: string): Busy[] {
  return db.appointments
    .filter((a) => a.status === 'booked' && a.date === date)
    .map((a) => ({ start: toMin(a.start), blockedUntil: toMin(a.blockedUntil) }))
}

function dayAvailability(db: DemoDb, date: string) {
  const isOff = db.daysOff.some((d) => d.date === date)
  return availabilityForDay(date, db.settings, busyFor(db, date), isOff, db.settings.defaultDurationMinutes, new Date())
}

// ---------------------------------------------------------------- rute

export async function demoFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  // mică întârziere, ca stările de încărcare să se vadă ca pe un server real
  await new Promise((r) => setTimeout(r, 150))

  const url = new URL(typeof input === 'string' ? input : input.toString(), window.location.origin)
  const path = url.pathname.replace(/^.*?\/api\//, '/api/')
  const method = (init.method ?? 'GET').toUpperCase()
  const body = init.body ? JSON.parse(String(init.body)) : {}
  const headers = new Headers(init.headers)
  const db = load()
  const user = currentUser(db, headers)
  const q = url.searchParams

  // ---- autentificare
  if (method === 'POST' && path === '/api/auth/register') {
    const email = String(body.email ?? '').trim().toLowerCase()
    if (db.users.some((u) => u.email === email)) return problem(409, 'Există deja un cont cu acest e-mail.')
    const u: StoredUser = {
      id: uid(), email, firstName: String(body.firstName).trim(), lastName: String(body.lastName).trim(),
      role: 'client', password: String(body.password),
    }
    db.users.push(u)
    return json(200, session(db, u))
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const email = String(body.email ?? '').trim().toLowerCase()
    const u = db.users.find((x) => x.email === email && x.password === body.password && x.role === 'client')
    return u ? json(200, session(db, u)) : problem(401, 'E-mail sau parolă greșită.')
  }

  if (method === 'POST' && path === '/api/auth/demo-admin') {
    const admin = db.users.find((u) => u.role === 'admin')!
    return json(200, session(db, admin))
  }

  if (method === 'POST' && path === '/api/auth/refresh') {
    const u = db.users.find((x) => x.id === db.sessionUserId)
    return u ? json(200, session(db, u)) : problem(401, 'Sesiunea a expirat.')
  }

  if (method === 'POST' && path === '/api/auth/logout') {
    db.sessionUserId = null
    save(db)
    return json(204)
  }

  if (method === 'GET' && path === '/api/auth/me') {
    return user ? json(200, publicUser(user)) : problem(401, 'Sesiunea a expirat.')
  }

  // ---- calendar public
  if (method === 'GET' && path === '/api/availability') {
    const from = q.get('from')!
    const to = q.get('to')!
    const days = []
    for (let d = from; d <= to; d = addDaysISO(d, 1)) days.push(dayAvailability(db, d))
    return json(200, { durationMinutes: db.settings.defaultDurationMinutes, days })
  }

  // ---- programările clientei
  if (path.startsWith('/api/appointments')) {
    if (!user) return problem(401, 'Sesiunea a expirat.')
    if (user.role !== 'client') return problem(403, 'Doar clientele pot face programări.')

    if (method === 'POST' && path === '/api/appointments') {
      const { date, time } = body as { date: string; time: string }
      if (!dayAvailability(db, date).slots.includes(time))
        return problem(409, 'Ora aleasă nu mai e disponibilă. Alege alt interval.')
      const start = toMin(time)
      const end = start + db.settings.defaultDurationMinutes
      const a: StoredAppointment = {
        id: uid(), clientId: user.id, date, start: time, end: toHHMM(end),
        blockedUntil: toHHMM(end + db.settings.breakMinutes), status: 'booked',
      }
      db.appointments.push(a)
      save(db)
      return json(201, toDto(a))
    }

    if (method === 'GET' && path === '/api/appointments/mine') {
      const today = todayISO()
      const mine = db.appointments
        .filter((a) => a.clientId === user.id && a.status === 'booked' && a.date >= today)
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
      return json(200, mine.map(toDto))
    }

    const cancel = path.match(/^\/api\/appointments\/([^/]+)$/)
    if (method === 'DELETE' && cancel) {
      const a = db.appointments.find((x) => x.id === cancel[1] && x.clientId === user.id && x.status === 'booked')
      if (!a) return problem(404, 'Programarea nu există.')
      const [y, m, d] = a.date.split('-').map(Number)
      const startAt = new Date(y, m - 1, d, Math.floor(toMin(a.start) / 60), toMin(a.start) % 60)
      if (startAt.getTime() - Date.now() < db.settings.minNoticeHours * 3_600_000)
        return problem(409, 'Programarea e prea aproape ca să o anulezi online. Sună-ne, te rugăm.')
      a.status = 'cancelled'
      save(db)
      return json(204)
    }
  }

  // ---- administrare
  if (path.startsWith('/api/admin')) {
    if (!user) return problem(401, 'Sesiunea a expirat.')
    if (user.role !== 'admin') return problem(403, 'Acces interzis.')

    if (path === '/api/admin/ping') return json(200, { message: 'Salut, administratoare!' })

    if (path === '/api/admin/settings') {
      if (method === 'PUT') {
        const s = body as SalonSettings
        if (s.workStart >= s.workEnd) return problem(400, 'Ora de început trebuie să fie înaintea celei de final.')
        db.settings = { ...s, workDays: [...new Set(s.workDays)].sort() }
        save(db)
      }
      return json(200, db.settings)
    }

    if (method === 'GET' && path === '/api/admin/days-off') {
      const from = q.get('from')!
      const to = q.get('to')!
      return json(200, db.daysOff.filter((d) => d.date >= from && d.date <= to))
    }

    const dayOff = path.match(/^\/api\/admin\/days-off\/(\d{4}-\d{2}-\d{2})$/)
    if (dayOff) {
      db.daysOff = db.daysOff.filter((d) => d.date !== dayOff[1])
      if (method === 'PUT') db.daysOff.push({ date: dayOff[1], note: body?.note ?? null })
      save(db)
      return json(204)
    }

    if (method === 'GET' && path === '/api/admin/appointments') {
      const date = q.get('date')!
      const list: AdminAppointment[] = db.appointments
        .filter((a) => a.status === 'booked' && a.date === date)
        .sort((a, b) => a.start.localeCompare(b.start))
        .map((a) => {
          const c = db.users.find((u) => u.id === a.clientId)
          return { id: a.id, start: a.start, end: a.end, clientName: c ? `${c.firstName} ${c.lastName}` : '—', email: c?.email ?? '' }
        })
      return json(200, list)
    }
  }

  return problem(404, 'Pagina nu există.')
}

function toDto(a: StoredAppointment): Appointment {
  return { id: a.id, date: a.date, start: a.start, end: a.end, status: a.status }
}

/** Șterge datele demo de pe dispozitiv (buton în bannerul demo). */
export function resetDemo() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nimic de șters */
  }
  memoryDb = null
}
