import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { loyaltyApi, type LoyaltyCard } from '../api/loyalty'
import { profileApi, type Pricing, type WorkEstimate } from '../api/profile'
import { schedulingApi, type Appointment, type DayAvailability } from '../api/scheduling'
import { useAuth } from '../auth/context'
import { Calendar, LegendItem, type DayInfo } from '../components/Calendar'
import { StampDots } from '../components/LoyaltyCard'
import { visitsLeftText } from '../lib/loyalty'
import { MONTHS, addDaysISO, addMonths, formatDuration, formatLong, formatShort, monthRange, parseISO, todayISO } from '../lib/dates'

const MAX_MONTHS_AHEAD = 3
/** Titlul: cuvintele între _ sunt cursive. */
const HEADLINE = 'Unghii _care_ vorbesc.'

const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

function slotsHint(n: number) {
  return n === 1 ? '1 loc liber' : `${n} locuri libere`
}

/** Titlul apare cuvânt cu cuvânt (animație doar CSS). */
function RevealTitle({ text }: { text: string }) {
  const plain = text.replaceAll('_', '')
  return (
    <h1 aria-label={plain}>
      {text.split(' ').map((word, i) => {
        const italic = word.startsWith('_')
        const clean = word.replaceAll('_', '')
        return (
          <span key={i} aria-hidden="true">
            <span className="reveal-word" style={{ '--i': i } as CSSProperties}>
              {italic ? <em>{clean}</em> : clean}
            </span>{' '}
          </span>
        )
      })}
    </h1>
  )
}

export function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const today = parseISO(todayISO())

  // fișa clientei: undefined = încă nu știm, null = nu are fișă (clientă nouă)
  const [work, setWork] = useState<WorkEstimate | null | undefined>(undefined)
  const isClient = user?.role === 'client'

  const [card, setCard] = useState<LoyaltyCard | null>(null)

  useEffect(() => {
    if (!isClient) {
      setWork(undefined)
      setCard(null)
      return
    }
    loyaltyApi.card().then(setCard).catch(() => setCard(null))
    profileApi
      .get()
      .then((r) => setWork(r?.estimate ?? null))
      .catch(() => setWork(undefined))
  }, [isClient])

  const [view, setView] = useState({ year: today.year, month: today.month })
  const [days, setDays] = useState<Record<string, DayAvailability>>({})
  const [duration, setDuration] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [nextSlot, setNextSlot] = useState<{ date: string; time: string } | null | undefined>(undefined)
  const [pricing, setPricing] = useState<Pricing | null>(null)

  useEffect(() => {
    profileApi.pricing().then(setPricing).catch(() => setPricing(null))
  }, [])

  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [booking, setBooking] = useState(false)
  const [bookError, setBookError] = useState<string | null>(null)
  const [booked, setBooked] = useState<Appointment | null>(null)

  const loadMonth = useCallback(async (year: number, month: number) => {
    const { from, to } = monthRange(year, month)
    setLoading(true)
    setLoadError(null)
    try {
      const data = await schedulingApi.availability(from, to)
      setDuration(data.durationMinutes)
      setDays(Object.fromEntries(data.days.map((d) => [d.date, d])))
    } catch {
      setLoadError('Nu am putut încărca calendarul. Reîncarcă pagina.')
    } finally {
      setLoading(false)
    }
  }, [])

  /** Primul loc liber din următoarele ~6 săptămâni — pentru chip-ul din hero și bara de jos. */
  const loadNextSlot = useCallback(async () => {
    try {
      const start = todayISO()
      const data = await schedulingApi.availability(start, addDaysISO(start, 45))
      const first = data.days.find((d) => d.status === 'available' && d.slots.length > 0)
      setNextSlot(first ? { date: first.date, time: first.slots[0] } : null)
    } catch {
      setNextSlot(null)
    }
  }, [])

  useEffect(() => {
    loadMonth(view.year, view.month)
  }, [view, loadMonth])

  useEffect(() => {
    loadNextSlot()
  }, [loadNextSlot])

  // revenire din fișă cu ziua aleasă înainte
  const returnedDay = (location.state as { day?: string } | null)?.day
  useEffect(() => {
    if (!returnedDay || work === undefined) return
    const { year, month } = parseISO(returnedDay)
    setView({ year, month })
    setSelectedDay(returnedDay)
    setSelectedTime(null)
    navigate('.', { replace: true, state: null })
  }, [returnedDay, work, navigate])

  // după ce se încarcă luna, alegem automat prima oră a zilei selectate
  useEffect(() => {
    if (selectedDay && !selectedTime && days[selectedDay]?.slots.length) setSelectedTime(days[selectedDay].slots[0])
  }, [days, selectedDay, selectedTime])

  const monthsAhead = (view.year - today.year) * 12 + (view.month - today.month)
  const goMonth = (delta: number) => setView((v) => addMonths(v.year, v.month, delta))

  const getDay = useCallback(
    (iso: string): DayInfo => {
      const d = days[iso]
      if (!d) return { variant: 'past', disabled: true }
      switch (d.status) {
        case 'available':
          return { variant: 'available', hint: slotsHint(d.slots.length) }
        case 'full':
          return { variant: 'full', hint: 'Complet', disabled: true }
        case 'day_off':
          return { variant: 'off', hint: 'Liber', disabled: true }
        case 'closed':
          return { variant: 'closed', disabled: true }
        default:
          return { variant: 'past', disabled: true }
      }
    },
    [days],
  )

  const selectDay = (iso: string, time?: string) => {
    // clientă nouă: întâi fișa (din ea aflăm durata), apoi revine la ziua aleasă
    if (isClient && work === null) {
      navigate('/fisa', { state: { day: iso } })
      return
    }
    setSelectedDay(iso)
    setSelectedTime(time ?? days[iso]?.slots[0] ?? null)
    setBookError(null)
    setBooked(null)
  }

  const openNextSlot = () => {
    if (!nextSlot) return
    const { year, month } = parseISO(nextSlot.date)
    setView({ year, month })
    selectDay(nextSlot.date, nextSlot.time)
    document.getElementById('calendar')?.scrollIntoView({ behavior: 'smooth' })
  }

  const closeSheet = () => {
    setSelectedDay(null)
    setBooked(null)
  }

  const confirm = async () => {
    if (!selectedDay || !selectedTime) return
    setBooking(true)
    setBookError(null)
    try {
      const appointment = await schedulingApi.book(selectedDay, selectedTime)
      setBooked(appointment)
      setSelectedDay(null)
      setSelectedTime(null)
    } catch (err) {
      setBookError(err instanceof ApiError ? err.message : 'Nu am putut face programarea. Mai încearcă o dată.')
    } finally {
      setBooking(false)
      loadMonth(view.year, view.month)
      loadNextSlot()
    }
  }

  const slots = useMemo(() => (selectedDay ? (days[selectedDay]?.slots ?? []) : []), [days, selectedDay])
  const sheetOpen = selectedDay !== null || booked !== null

  return (
    <div className="has-sticky-cta">
      <div className="masthead">
        <span>Programări online</span>
        <span>
          {MONTHS[today.month]} {today.year}
        </span>
      </div>

      <section className="ed-hero">
        <RevealTitle text={HEADLINE} />
        <div>
          <p className="lead">
            Alegi ziua, iar noi îți arătăm doar orele la care lucrarea ta încape în program
            {duration ? ` (cam ${formatDuration(duration)})` : ''}. Plătești la salon, în ziua programării.
          </p>
          <div className="ed-hero-actions">
            <a href="#calendar" className="btn btn-primary">
              Vezi zilele libere
            </a>
            {!user && (
              <Link to="/inregistrare" className="btn btn-secondary">
                Cont nou
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="bento" aria-label="Pe scurt">
        <button
          type="button"
          className="tile tile-plum tile-wide"
          style={{ '--i': 0 } as CSSProperties}
          onClick={nextSlot ? openNextSlot : () => document.getElementById('calendar')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <span className="tile-label">Următorul loc liber</span>
          <span className="tile-big">
            {nextSlot === undefined ? '…' : nextSlot ? `${capitalize(formatShort(nextSlot.date))} · ${nextSlot.time}` : 'Vezi calendarul'}
          </span>
          <span className="tile-foot">
            <span>{nextSlot ? 'Apasă și te programezi' : 'Locurile noi apar în calendar'}</span>
            <span className="tile-arrow" aria-hidden="true">
              →
            </span>
          </span>
        </button>

        {user?.role === 'admin' ? (
          <Link to="/admin" className="tile tile-pink" style={{ '--i': 1 } as CSSProperties}>
            <span className="tile-label">Administrare</span>
            <span className="tile-big">Ziua de azi</span>
            <span className="tile-foot">
              <span>Programări, intervale, prețuri</span>
              <span className="tile-arrow" aria-hidden="true">→</span>
            </span>
          </Link>
        ) : work ? (
          <Link to="/fisa" className="tile tile-pink" style={{ '--i': 1 } as CSSProperties}>
            <span className="tile-label">Lucrarea ta</span>
            <span className="tile-big">{work.price} lei</span>
            <span className="tile-foot">
              <span>
                {work.serviceName} · {formatDuration(work.minutes)}
              </span>
              <span className="tile-arrow" aria-hidden="true">→</span>
            </span>
          </Link>
        ) : (
          <Link to={user ? '/fisa' : '/inregistrare'} className="tile tile-pink" style={{ '--i': 1 } as CSSProperties}>
            <span className="tile-label">Fișa de cunoaștere</span>
            <span className="tile-big">3 pași</span>
            <span className="tile-foot">
              <span>Din ea aflăm durata și prețul</span>
              <span className="tile-arrow" aria-hidden="true">→</span>
            </span>
          </Link>
        )}

        {card ? (
          <Link to="/profil#card" className="tile" style={{ '--i': 2 } as CSSProperties}>
            <span className="tile-label">Cardul tău</span>
            <StampDots stamps={card.stamps} required={card.required} />
            <span className="tile-foot">
              <span>{visitsLeftText(card)}</span>
            </span>
          </Link>
        ) : (
          <Link
            to={user?.role === 'admin' ? '/admin#fidelitate' : user ? '/profil#card' : '/inregistrare'}
            className="tile"
            style={{ '--i': 2 } as CSSProperties}
          >
            <span className="tile-label">Card de fidelitate</span>
            <StampDots stamps={0} required={5} />
            <span className="tile-foot">
              <span>{user?.role === 'admin' ? 'Scanează cardul clientei' : 'Fiecare vizită se bifează cu un cod QR.'}</span>
            </span>
          </Link>
        )}

        {pricing && (
          <div className="tile tile-full" style={{ '--i': 3 } as CSSProperties}>
            <div className="tile-head">
              <span className="tile-label">Prețuri</span>
              <span className="tile-big">
                de la <em>{Math.min(...pricing.services.map((x) => x.price))} lei</em>
              </span>
            </div>
            <ul className="price-list">
              {pricing.services.map((x) => (
                <li key={x.code}>
                  <span>
                    {x.name} <small>· {formatDuration(x.minutes)}</small>
                  </span>
                  <span className="dots" aria-hidden="true" />
                  <strong>{x.price} lei</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {pricing && (
        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">
            {[0, 1].flatMap((k) =>
              [...pricing.services.map((x) => x.name), 'Nail art', 'Pauză de 10 minute între cliente'].map((t) => (
                <span key={`${k}-${t}`}>{t}</span>
              )),
            )}
          </div>
        </div>
      )}

      <header className="section-head">
        <span>01</span>
        <h2>
          Alege <em>ziua</em>
        </h2>
      </header>
      <section id="calendar" className="booking-layout">
        <div className="card calendar-card">
          {loadError && <div className="alert">{loadError}</div>}
          <Calendar
            year={view.year}
            month={view.month}
            getDay={getDay}
            selected={selectedDay}
            onSelect={(iso) => selectDay(iso)}
            canPrev={monthsAhead > 0}
            canNext={monthsAhead < MAX_MONTHS_AHEAD}
            onPrev={() => goMonth(-1)}
            onNext={() => goMonth(1)}
            loading={loading}
            legend={
              <>
                <LegendItem variant="available">Ore libere</LegendItem>
                <LegendItem variant="full">Complet</LegendItem>
                <LegendItem variant="off">Salon închis</LegendItem>
              </>
            }
          />
        </div>

        <div className={`sheet-backdrop${sheetOpen ? ' is-open' : ''}`} onClick={closeSheet} aria-hidden="true" />

        <aside className={`card slot-panel as-sheet${sheetOpen ? ' is-open' : ''}`} aria-live="polite">
          {sheetOpen && (
            <button type="button" className="sheet-close" onClick={closeSheet} aria-label="Închide">
              ✕
            </button>
          )}

          {booked ? (
            <div className="booking-success">
              <span className="success-mark" aria-hidden="true">
                ✓
                {[0, 60, 120, 180, 240, 300].map((a) => (
                  <i key={a} style={{ '--a': `${a}deg` } as CSSProperties} />
                ))}
              </span>
              <h2>Te-am programat!</h2>
              <p>
                <strong>{formatLong(booked.date)}</strong>, de la <strong>{booked.start}</strong> la {booked.end}.
              </p>
              {booked.serviceName && (
                <p className="work-tag">
                  {booked.serviceName}
                  {booked.price != null && ` · ${booked.price} lei`}
                </p>
              )}
              <p className="muted">Plata se face în ziua programării, la salon.</p>
              <Link to="/profil" className="btn btn-secondary">
                Programările mele
              </Link>
            </div>
          ) : !selectedDay ? (
            <div className="slot-empty">
              <h2>Alege o zi</h2>
              <p className="muted">Apasă pe o zi în roz din calendar ca să vezi orele la care te poți programa.</p>
            </div>
          ) : (
            <>
              <h2 className="slot-title">{formatLong(selectedDay)}</h2>
              {work ? (
                <p className="work-tag">
                  {work.serviceName} · {formatDuration(work.minutes)} · {work.price} lei
                </p>
              ) : (
                duration && <p className="muted">Lucrarea durează aproximativ {formatDuration(duration)}.</p>
              )}

              {slots.length === 0 ? (
                <p className="muted">{loading ? 'Se încarcă orele…' : 'Ziua asta s-a ocupat între timp. Alege altă zi.'}</p>
              ) : (
                <div className="slot-list" role="radiogroup" aria-label="Ora de început">
                  {slots.map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={t === selectedTime}
                      className={`slot${t === selectedTime ? ' is-selected' : ''}`}
                      onClick={() => setSelectedTime(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}

              {bookError && (
                <div className="alert" role="alert">
                  {bookError}
                </div>
              )}

              {!user ? (
                <div className="slot-auth">
                  <p className="muted">Ca să rezervi ora, intră în cont sau fă-ți unul în câteva secunde.</p>
                  <Link to="/autentificare" state={{ from: '/' }} className="btn btn-primary btn-block">
                    Intră în cont
                  </Link>
                  <Link to="/inregistrare" className="btn btn-secondary btn-block">
                    Cont nou
                  </Link>
                </div>
              ) : user.role === 'admin' ? (
                <p className="muted">Ești logată ca administratoare. Programările se fac din contul clientei.</p>
              ) : (
                slots.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    onClick={confirm}
                    disabled={!selectedTime || booking}
                    aria-busy={booking}
                  >
                    {booking ? 'Se programează…' : `Programează-mă la ${selectedTime}`}
                  </button>
                )
              )}
            </>
          )}
        </aside>
      </section>

      {/* pe telefon: buton fix jos, la îndemâna degetului mare */}
      {!sheetOpen && (
        <div className="sticky-cta">
          {nextSlot ? (
            <button type="button" className="btn btn-primary" onClick={openNextSlot}>
              <span>Programează-te</span>
              <small>
                primul loc: {formatShort(nextSlot.date)}, {nextSlot.time}
              </small>
            </button>
          ) : (
            <a href="#calendar" className="btn btn-primary">
              Programează-te
            </a>
          )}
        </div>
      )}
    </div>
  )
}
