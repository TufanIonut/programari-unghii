// Server simulat pentru versiunea demo (GitHub Pages, fără backend).
// Răspunde la aceleași rute ca API-ul .NET, cu aceleași reguli pentru orele libere,
// și păstrează datele în localStorage — rămân doar pe dispozitivul pe care rulează demo-ul.

import type { AuthResponse, User } from '../api/client'
import type { AdminAppointment, Appointment, DayOff, OpenSlot, SalonSettings } from '../api/scheduling'
import type { ClientProfile, Pricing, WorkEstimate } from '../api/profile'
import { estimateWork } from '../lib/profileOptions'
import { DEMO_LOYALTY_CODES } from './loyaltyCodes'
import { addDaysISO, availabilityForDay, type Busy, type Window } from './availability'

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
  serviceName?: string
  price?: number
  details?: string
}

interface DemoDb {
  version: number
  users: StoredUser[]
  appointments: StoredAppointment[]
  daysOff: DayOff[]
  slots: OpenSlot[]
  settings: SalonSettings
  pricing: Pricing
  profiles: Record<string, ClientProfile & { updatedAt: string }>
  loyalty?: DemoLoyalty
  sessionUserId: string | null
}

interface DemoLoyalty {
  settings: { stampsRequired: number; reward: string }
  cards: Record<string, { code: string; stamps: number; completed: number }>
  visits: { userId: string; day: string; completedCard: boolean }[]
}


const KEY = 'programari-demo-db'
const VERSION = 3 // crește la schimbări de structură → datele demo vechi se regenerează
export const DEMO_ADMIN_EMAIL = 'admin@demo.ro'

// ---------------------------------------------------------------- stocare

let memoryDb: DemoDb | null = null

function load(): DemoDb {
  if (memoryDb) return memoryDb
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DemoDb
      if (parsed.version === VERSION) return (memoryDb = withLoyalty(parsed))
    }
  } catch {
    /* stocare indisponibilă (mod privat) → lucrăm doar în memorie */
  }
  return (memoryDb = withLoyalty(seed()))
}

function withLoyalty(db: DemoDb): DemoDb {
  if (db.loyalty) return db
  const cards: DemoLoyalty['cards'] = {}
  const visits: DemoLoyalty['visits'] = []
  for (const demo of DEMO_LOYALTY_CODES) {
    const u = db.users.find((x) => x.firstName === demo.name && x.role === 'client')
    if (!u) continue
    cards[u.id] = { code: demo.code.replace('-', ''), stamps: demo.stamps, completed: 0 }
    for (let i = demo.stamps; i > 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i * 21)
      visits.push({ userId: u.id, day: toISO(d), completedCard: false })
    }
  }
  db.loyalty = { settings: { stampsRequired: 5, reward: '20% reducere' }, cards, visits }
  return db
}

// ---------------------------------------------------------------- card de fidelitate

const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function newLoyaltyCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (b) => CODE_ALPHABET[b & 31]).join('')
}

const formatCode = (c: string) => `${c.slice(0, 5)}-${c.slice(5)}`

/** Ca pe server: acceptă „PU-CARD:…”, litere mici, cratime, O în loc de 0, I/L în loc de 1. */
function codeFromScan(input: string | undefined): string | null {
  if (!input) return null
  const raw = input.slice(input.lastIndexOf(':') + 1).trim().toUpperCase()
  let out = ''
  for (const ch of raw) {
    const c = ch === 'O' ? '0' : ch === 'I' || ch === 'L' ? '1' : ch
    if (c === '-' || c === ' ') continue
    if (!CODE_ALPHABET.includes(c)) return null
    out += c
  }
  return out.length === 10 ? out : null
}

function loyaltyCard(db: DemoDb, userId: string) {
  const l = db.loyalty!
  if (!l.cards[userId]) {
    l.cards[userId] = { code: newLoyaltyCode(), stamps: 0, completed: 0 }
    save(db)
  }
  const c = l.cards[userId]
  const code = formatCode(c.code)
  return {
    code,
    qrText: 'PU-CARD:' + code,
    stamps: c.stamps,
    required: l.settings.stampsRequired,
    reward: l.settings.reward,
    completed: c.completed,
    visits: l.visits.filter((v) => v.userId === userId).map((v) => v.day).sort().reverse().slice(0, 20),
  }
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

  const pricing: Pricing = {
    services: [
      { code: 'semipermanent', name: 'Ojă semipermanentă', minutes: 90, price: 120 },
      { code: 'gel', name: 'Construcție gel', minutes: 150, price: 180 },
      { code: 'intretinere', name: 'Întreținere gel', minutes: 120, price: 150 },
      { code: 'manichiura', name: 'Manichiură clasică', minutes: 45, price: 60 },
    ],
    extras: [
      { code: 'indepartare', name: 'Îndepărtare material vechi', minutes: 20, price: 30 },
      { code: 'lungime_lunga', name: 'Lungime lungă', minutes: 15, price: 20 },
      { code: 'lungime_xl', name: 'Lungime foarte lungă', minutes: 30, price: 40 },
      { code: 'culoare', name: 'Culoare în plus (de fiecare)', minutes: 5, price: 5 },
      { code: 'model', name: 'Model / nail art (de fiecare)', minutes: 10, price: 15 },
    ],
  }

  const db: DemoDb = {
    version: VERSION, users: [admin, ...clients], appointments: [], daysOff: [], slots: [],
    settings, pricing, profiles: {}, sessionUserId: null,
  }

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
        serviceName: 'Ojă semipermanentă',
        price: 120,
        details: 'Ojă semipermanentă',
      })
      start = end + settings.breakMinutes
    }
  }

  // intervale deschise: programul standard în zilele lucrătoare din următoarele 60 de zile,
  // plus o sâmbătă cu program scurt, ca exemplu
  for (let i = 0, d = todayISO(); i <= 60; i++, d = addDaysISO(d, 1)) {
    if (settings.workDays.includes(isoWeekday(d))) db.slots.push({ id: uid(), date: d, start: settings.workStart, end: settings.workEnd })
  }
  let saturday = addDaysISO(todayISO(), 3)
  while (isoWeekday(saturday) !== 6) saturday = addDaysISO(saturday, 1)
  db.slots.push({ id: uid(), date: saturday, start: '09:00', end: '13:00' })

  // o zi liberă marcată de proprietară, în săptămâna următoare
  let off = addDaysISO(todayISO(), 9)
  while (!settings.workDays.includes(isoWeekday(off))) off = addDaysISO(off, 1)
  db.daysOff.push({ date: off, note: 'Concediu' })
  db.slots = db.slots.filter((x) => x.date !== off)

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

const problem = (status: number, detail: string, title?: string) => json(status, { status, detail, title })

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

function windowsFor(db: DemoDb, date: string): Window[] {
  return db.slots.filter((x) => x.date === date).map((x) => ({ start: toMin(x.start), end: toMin(x.end) }))
}

/** Lucrarea clientei, din fișă (null fără fișă). */
function workFor(db: DemoDb, userId: string | undefined): WorkEstimate | null {
  const profile = userId ? db.profiles[userId] : undefined
  return profile ? estimateWork(profile, db.pricing) : null
}

function dayAvailability(db: DemoDb, date: string, duration = db.settings.defaultDurationMinutes) {
  const isOff = db.daysOff.some((d) => d.date === date)
  return availabilityForDay(date, db.settings, windowsFor(db, date), busyFor(db, date), isOff, duration, new Date())
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
    const duration = (user?.role === 'client' && workFor(db, user.id)?.minutes) || db.settings.defaultDurationMinutes
    const days = []
    for (let d = from; d <= to; d = addDaysISO(d, 1)) days.push(dayAvailability(db, d, duration))
    return json(200, { durationMinutes: duration, days })
  }

  // ---- cardul de fidelitate al clientei
  if (method === 'GET' && path === '/api/loyalty') {
    if (!user) return problem(401, 'Sesiunea a expirat.')
    if (user.role !== 'client') return problem(403, 'Doar clientele au card de fidelitate.')
    return json(200, loyaltyCard(db, user.id))
  }

  // ---- prețuri (publice)
  if (method === 'GET' && path === '/api/pricing') return json(200, db.pricing)

  // ---- fișa clientei
  if (path === '/api/profile') {
    if (!user) return problem(401, 'Sesiunea a expirat.')
    if (user.role !== 'client') return problem(403, 'Doar clientele au fișă.')

    if (method === 'GET') {
      const profile = db.profiles[user.id]
      return profile ? json(200, { profile, estimate: workFor(db, user.id) }) : problem(404, 'Nu ai încă fișă.')
    }

    if (method === 'PUT') {
      if (!body.consent) return problem(400, 'Ca să salvăm fișa, avem nevoie de acordul tău pentru prelucrarea datelor.')
      if (!db.pricing.services.some((x) => x.code === body.service)) return problem(400, 'Alege lucrarea pe care o vrei.')
      const profile: ClientProfile & { updatedAt: string } = {
        age: body.age ?? null,
        growth: body.growth,
        nailBed: body.nailBed,
        cuticles: body.cuticles,
        existingMaterial: body.existingMaterial,
        service: body.service,
        length: body.length,
        wantsDesign: Boolean(body.wantsDesign),
        colors: body.wantsDesign ? Number(body.colors) || 1 : 1,
        models: body.wantsDesign ? (body.models ?? []).map((m: string) => m.trim()).filter(Boolean) : [],
        notes: body.notes?.trim() || null,
        preferredDays: body.preferredDays ?? [],
        preferredFrom: body.preferredFrom || null,
        preferredTo: body.preferredTo || null,
        updatedAt: new Date().toISOString(),
      }
      db.profiles[user.id] = profile
      save(db)
      return json(200, { profile, estimate: workFor(db, user.id) })
    }
  }

  // ---- programările clientei
  if (path.startsWith('/api/appointments')) {
    if (!user) return problem(401, 'Sesiunea a expirat.')
    if (user.role !== 'client') return problem(403, 'Doar clientele pot face programări.')

    if (method === 'POST' && path === '/api/appointments') {
      const { date, time } = body as { date: string; time: string }
      const work = workFor(db, user.id)
      if (!work) return problem(409, 'Completează întâi fișa, ca să știm cât durează lucrarea ta.', 'profile_required')
      if (!dayAvailability(db, date, work.minutes).slots.includes(time))
        return problem(409, 'Ora aleasă nu mai e disponibilă. Alege alt interval.')
      const start = toMin(time)
      const end = start + work.minutes
      const a: StoredAppointment = {
        id: uid(), clientId: user.id, date, start: time, end: toHHMM(end),
        blockedUntil: toHHMM(end + db.settings.breakMinutes), status: 'booked',
        serviceName: work.serviceName, price: work.price, details: work.summary,
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

    // ---- intervale deschise
    if (method === 'GET' && path === '/api/admin/slots') {
      const from = q.get('from')!
      const to = q.get('to')!
      return json(200, db.slots.filter((x) => x.date >= from && x.date <= to).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)))
    }

    if (method === 'POST' && path === '/api/admin/slots') {
      const { date, start, end } = body as { date: string; start: string; end: string }
      if (start >= end) return problem(400, 'Ora de început trebuie să fie înaintea celei de final.')
      if (date < todayISO()) return problem(400, 'Nu poți deschide intervale în zile care au trecut.')
      const overlap = db.slots.some((x) => x.date === date && start < x.end && x.start < end)
      if (overlap) return problem(409, 'Intervalul se suprapune cu unul existent în aceeași zi.')
      const slot: OpenSlot = { id: uid(), date, start, end }
      db.slots.push(slot)
      save(db)
      return json(201, slot)
    }

    if (method === 'POST' && path === '/api/admin/slots/apply-standard') {
      const { to } = body as { from: string; to: string }
      const from = body.from < todayISO() ? todayISO() : (body.from as string)
      let filled = 0
      for (let d = from; d <= to; d = addDaysISO(d, 1)) {
        const skip = !db.settings.workDays.includes(isoWeekday(d)) || db.daysOff.some((x) => x.date === d) || db.slots.some((x) => x.date === d)
        if (skip) continue
        db.slots.push({ id: uid(), date: d, start: db.settings.workStart, end: db.settings.workEnd })
        filled++
      }
      save(db)
      return json(200, { daysFilled: filled })
    }

    const slotId = path.match(/^\/api\/admin\/slots\/([^/]+)$/)
    if (method === 'DELETE' && slotId) {
      const slot = db.slots.find((x) => x.id === slotId[1])
      if (!slot) return problem(404, 'Intervalul nu există.')
      const booked = db.appointments.some((a) => a.status === 'booked' && a.date === slot.date && a.start < slot.end && slot.start < a.end)
      if (booked) return problem(409, 'În acest interval sunt programări. Anulează-le sau mută-le înainte să închizi intervalul.')
      db.slots = db.slots.filter((x) => x.id !== slot.id)
      save(db)
      return json(204)
    }

    if (method === 'POST' && path === '/api/admin/loyalty/scan') {
      const l = db.loyalty!
      const code = codeFromScan(body?.code)
      const ownerId = code ? Object.keys(l.cards).find((id) => l.cards[id].code === code) : undefined
      const owner = db.users.find((u) => u.id === ownerId && u.role === 'client')
      if (!owner) return problem(404, 'Nu am găsit niciun card cu acest cod. Verifică și încearcă din nou.')

      const card = l.cards[owner.id]
      const today = todayISO()
      const already = l.visits.some((v) => v.userId === owner.id && v.day === today)
      let completedNow = false
      if (!already) {
        card.stamps += 1
        if (card.stamps >= l.settings.stampsRequired) {
          card.stamps = 0
          card.completed += 1
          completedNow = true
        }
        l.visits.push({ userId: owner.id, day: today, completedCard: completedNow })
        save(db)
      }
      return json(200, {
        status: already ? 'already_today' : 'stamped',
        clientId: owner.id,
        clientName: `${owner.firstName} ${owner.lastName}`,
        stamps: card.stamps,
        required: l.settings.stampsRequired,
        reward: l.settings.reward,
        completed: card.completed,
        completedNow,
      })
    }

    if (path === '/api/admin/loyalty/settings') {
      const l = db.loyalty!
      if (method === 'PUT') {
        const n = Number(body?.stampsRequired)
        const reward = String(body?.reward ?? '').trim()
        if (!Number.isInteger(n) || n < 2 || n > 20) return problem(400, 'Cardul trebuie să aibă între 2 și 20 de vizite.')
        if (!reward) return problem(400, 'Scrie ce primește clienta.')
        l.settings = { stampsRequired: n, reward: reward.slice(0, 80) }
        save(db)
      }
      return json(200, l.settings)
    }

    if (method === 'PUT' && path === '/api/admin/pricing') {
      const p = body as Pricing
      const merge = (list: Pricing['services'], updates: Pricing['services']) =>
        list.map((i) => {
          const u = updates.find((x) => x.code === i.code)
          return u ? { ...i, minutes: u.minutes, price: u.price } : i
        })
      db.pricing = { services: merge(db.pricing.services, p.services), extras: merge(db.pricing.extras, p.extras) }
      save(db)
      return json(200, db.pricing)
    }

    const client = path.match(/^\/api\/admin\/clients\/([^/]+)$/)
    if (method === 'GET' && client) {
      const u = db.users.find((x) => x.id === client[1] && x.role === 'client')
      if (!u) return problem(404, 'Clienta nu există.')
      return json(200, { user: publicUser(u), profile: db.profiles[u.id] ?? null, estimate: workFor(db, u.id) })
    }

    if (method === 'GET' && path === '/api/admin/appointments') {
      const date = q.get('date')!
      const list: AdminAppointment[] = db.appointments
        .filter((a) => a.status === 'booked' && a.date === date)
        .sort((a, b) => a.start.localeCompare(b.start))
        .map((a) => {
          const c = db.users.find((u) => u.id === a.clientId)
          return {
            id: a.id, clientId: a.clientId, start: a.start, end: a.end,
            clientName: c ? `${c.firstName} ${c.lastName}` : '—', email: c?.email ?? '',
            serviceName: a.serviceName ?? null, price: a.price ?? null, details: a.details ?? null,
          }
        })
      return json(200, list)
    }
  }

  return problem(404, 'Pagina nu există.')
}

function toDto(a: StoredAppointment): Appointment {
  return { id: a.id, date: a.date, start: a.start, end: a.end, status: a.status, serviceName: a.serviceName, price: a.price }
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
