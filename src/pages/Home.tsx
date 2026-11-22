import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import { schedulingApi, type Appointment, type DayAvailability } from '../api/scheduling'
import { useAuth } from '../auth/context'
import { Calendar, LegendItem, type DayInfo } from '../components/Calendar'
import { addMonths, formatDuration, formatLong, monthRange, parseISO, todayISO } from '../lib/dates'

const MAX_MONTHS_AHEAD = 3

function slotsHint(n: number) {
  return n === 1 ? '1 loc liber' : `${n} locuri libere`
}

export function Home() {
  const { user } = useAuth()
  const today = parseISO(todayISO())

  const [view, setView] = useState({ year: today.year, month: today.month })
  const [days, setDays] = useState<Record<string, DayAvailability>>({})
  const [duration, setDuration] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

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

  useEffect(() => {
    loadMonth(view.year, view.month)
  }, [view, loadMonth])

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

  const selectDay = (iso: string) => {
    setSelectedDay(iso)
    setSelectedTime(days[iso]?.slots[0] ?? null)
    setBookError(null)
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
    }
  }

  const slots = useMemo(() => (selectedDay ? (days[selectedDay]?.slots ?? []) : []), [days, selectedDay])

  return (
    <>
      <section className="booking-intro">
        <span className="eyebrow">Programări online</span>
        <h1>Alege ziua pentru unghiile tale</h1>
        <p className="muted">
          Zilele în roz au ore libere. Îți arătăm doar orele la care lucrarea ta încape în program
          {duration ? ` (durează aproximativ ${formatDuration(duration)})` : ''}.
        </p>
      </section>

      <section id="calendar" className="booking-layout">
        <div className="card calendar-card">
          {loadError && <div className="alert">{loadError}</div>}
          <Calendar
            year={view.year}
            month={view.month}
            getDay={getDay}
            selected={selectedDay}
            onSelect={selectDay}
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

        <aside className="card slot-panel" aria-live="polite">
          {booked ? (
            <div className="booking-success">
              <span className="success-mark" aria-hidden="true">✓</span>
              <h2>Te-am programat!</h2>
              <p>
                <strong>{formatLong(booked.date)}</strong>, de la <strong>{booked.start}</strong> la {booked.end}.
              </p>
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
              {duration && <p className="muted">Lucrarea durează aproximativ {formatDuration(duration)}.</p>}

              {slots.length === 0 ? (
                <p className="muted">Ziua asta s-a ocupat între timp. Alege altă zi.</p>
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
    </>
  )
}
