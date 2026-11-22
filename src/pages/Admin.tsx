import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import {
  schedulingApi,
  type AdminAppointment,
  type DayAvailability,
  type OpenSlot,
  type SalonSettings,
} from '../api/scheduling'
import { Calendar, LegendItem, type DayInfo } from '../components/Calendar'
import { MONTHS, WEEKDAYS_LONG, addMonths, formatLong, monthRange, parseISO, todayISO } from '../lib/dates'

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback)

/** „08:00” → „8”, „08:30” → „8:30” — pentru textul mic din calendar */
const shortTime = (t: string) => {
  const [h, m] = t.split(':')
  return m === '00' ? String(Number(h)) : `${Number(h)}:${m}`
}

const PRESETS = [
  { start: '08:00', end: '16:00' },
  { start: '09:00', end: '13:00' },
  { start: '14:00', end: '20:00' },
]

export function Admin() {
  // crește la fiecare salvare a programului standard, ca să se reîncarce calendarul
  const [version, setVersion] = useState(0)

  return (
    <section>
      <span className="eyebrow">Administrare</span>
      <h1>Panoul salonului</h1>
      <p className="muted">
        Alege o zi și deschide intervalele în care primești cliente. Clientele văd doar orele din aceste intervale.
      </p>

      <ScheduleCalendar version={version} />

      <h2 className="section-title">Program standard și reguli</h2>
      <SettingsForm onSaved={() => setVersion((v) => v + 1)} />
    </section>
  )
}

// ---------------------------------------------------------------- calendar + zi

function ScheduleCalendar({ version }: { version: number }) {
  const today = todayISO()
  const t = parseISO(today)
  const [view, setView] = useState({ year: t.year, month: t.month })
  const [days, setDays] = useState<Record<string, DayAvailability>>({})
  const [daysOff, setDaysOff] = useState<Record<string, string | null>>({})
  const [slots, setSlots] = useState<Record<string, OpenSlot[]>>({})
  const [loading, setLoading] = useState(true)
  const [monthMessage, setMonthMessage] = useState<string | null>(null)
  const [filling, setFilling] = useState(false)

  const [selected, setSelected] = useState<string>(today)
  const [appointments, setAppointments] = useState<AdminAppointment[] | null>(null)
  const [dayError, setDayError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const [newStart, setNewStart] = useState('08:00')
  const [newEnd, setNewEnd] = useState('16:00')

  const loadMonth = useCallback(async (year: number, month: number) => {
    const { from, to } = monthRange(year, month)
    setLoading(true)
    try {
      const [availability, off, open] = await Promise.all([
        schedulingApi.availability(from, to),
        schedulingApi.daysOff(from, to),
        schedulingApi.slots(from, to),
      ])
      setDays(Object.fromEntries(availability.days.map((d) => [d.date, d])))
      setDaysOff(Object.fromEntries(off.map((d) => [d.date, d.note])))
      const byDay: Record<string, OpenSlot[]> = {}
      for (const s of open) (byDay[s.date] ??= []).push(s)
      setSlots(byDay)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDay = useCallback(async (iso: string) => {
    setAppointments(null)
    setDayError(null)
    try {
      setAppointments(await schedulingApi.dayAppointments(iso))
    } catch (err) {
      setDayError(errorText(err, 'Nu am putut încărca programările zilei.'))
    }
  }, [])

  useEffect(() => {
    loadMonth(view.year, view.month)
  }, [view, loadMonth, version])

  useEffect(() => {
    loadDay(selected)
    setNote('')
  }, [selected, loadDay])

  const getDay = (iso: string): DayInfo => {
    if (iso in daysOff) return { variant: 'off', hint: daysOff[iso] ?? 'Liber' }
    const open = slots[iso] ?? []
    const hint = open.map((s) => `${shortTime(s.start)}–${shortTime(s.end)}`).join(', ') || undefined
    switch (days[iso]?.status) {
      case 'available':
        return { variant: 'available', hint }
      case 'full':
        return { variant: 'full', hint: hint ? `${hint} · plin` : 'Complet' }
      case 'closed':
        return { variant: 'closed', hint: iso >= today ? 'Închis' : undefined }
      default:
        return { variant: 'past', hint }
    }
  }

  const isOff = selected in daysOff
  const isPast = selected < today
  const daySlots = slots[selected] ?? []

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setSaving(true)
    setDayError(null)
    try {
      await action()
      await loadMonth(view.year, view.month)
    } catch (err) {
      setDayError(errorText(err, fallback))
    } finally {
      setSaving(false)
    }
  }

  const addSlot = (start: string, end: string) => {
    if (start >= end) {
      setDayError('Ora de început trebuie să fie înaintea celei de final.')
      return
    }
    run(() => schedulingApi.addSlot(selected, start, end), 'Nu am putut adăuga intervalul.')
  }

  const toggleDayOff = () =>
    run(
      () => (isOff ? schedulingApi.removeDayOff(selected) : schedulingApi.setDayOff(selected, note.trim() || undefined)),
      'Nu am putut salva ziua.',
    )

  const fillMonth = async () => {
    const { from, to } = monthRange(view.year, view.month)
    setFilling(true)
    setMonthMessage(null)
    try {
      const { daysFilled } = await schedulingApi.applyStandard(from, to)
      setMonthMessage(
        daysFilled === 0
          ? 'Toate zilele lucrătoare din lună aveau deja intervale.'
          : `Am deschis ${daysFilled === 1 ? 'o zi' : `${daysFilled} zile`} cu programul standard.`,
      )
      await loadMonth(view.year, view.month)
    } catch (err) {
      setMonthMessage(errorText(err, 'Nu am putut completa luna.'))
    } finally {
      setFilling(false)
    }
  }

  return (
    <>
      <div className="month-tools">
        <button type="button" className="btn btn-secondary" onClick={fillMonth} disabled={filling} aria-busy={filling}>
          Completează {MONTHS[view.month]} cu programul standard
        </button>
        {monthMessage && <span className="muted">{monthMessage}</span>}
      </div>

      <div className="booking-layout">
        <div className="card calendar-card">
          <Calendar
            year={view.year}
            month={view.month}
            getDay={getDay}
            selected={selected}
            onSelect={setSelected}
            canPrev
            canNext
            onPrev={() => setView((v) => addMonths(v.year, v.month, -1))}
            onNext={() => setView((v) => addMonths(v.year, v.month, 1))}
            loading={loading}
            legend={
              <>
                <LegendItem variant="available">Deschis, are locuri</LegendItem>
                <LegendItem variant="full">Plin</LegendItem>
                <LegendItem variant="off">Zi liberă</LegendItem>
              </>
            }
          />
        </div>

        <aside className="card slot-panel" aria-live="polite">
          <h2 className="slot-title">{formatLong(selected)}</h2>
          {dayError && <div className="alert">{dayError}</div>}

          {/* ---- intervale deschise ---- */}
          <h3 className="panel-subtitle">Intervale deschise</h3>
          {isOff ? (
            <p className="muted">Ziua e marcată liberă — clientele nu se pot programa.</p>
          ) : daySlots.length === 0 ? (
            <p className="muted">{isPast ? 'Ziua a fost închisă.' : 'Ziua e închisă. Adaugă un interval ca să te poată programa clientele.'}</p>
          ) : (
            <ul className="window-list">
              {daySlots.map((s) => (
                <li key={s.id} className="window-chip">
                  <span>
                    {s.start} – {s.end}
                  </span>
                  {!isPast && (
                    <button
                      type="button"
                      aria-label={`Închide intervalul ${s.start}–${s.end}`}
                      onClick={() => run(() => schedulingApi.deleteSlot(s.id), 'Nu am putut închide intervalul.')}
                      disabled={saving}
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!isPast && !isOff && (
            <div className="window-add">
              <div className="window-presets" role="group" aria-label="Intervale rapide">
                {PRESETS.map((p) => (
                  <button
                    key={p.start}
                    type="button"
                    className="chip"
                    onClick={() => addSlot(p.start, p.end)}
                    disabled={saving}
                  >
                    + {shortTime(p.start)}–{shortTime(p.end)}
                  </button>
                ))}
              </div>
              <div className="window-custom">
                <input type="time" step={600} aria-label="De la" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
                <span aria-hidden="true">–</span>
                <input type="time" step={600} aria-label="Până la" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
                <button type="button" className="btn btn-primary" onClick={() => addSlot(newStart, newEnd)} disabled={saving}>
                  Adaugă
                </button>
              </div>
            </div>
          )}

          {/* ---- programările zilei ---- */}
          <h3 className="panel-subtitle">Programări</h3>
          {appointments === null ? (
            <p className="muted">Se încarcă…</p>
          ) : appointments.length === 0 ? (
            <p className="muted">Nicio programare în ziua asta.</p>
          ) : (
            <ul className="appointment-list">
              {appointments.map((a) => (
                <li key={a.id} className="appointment-item">
                  <div>
                    <strong>
                      {a.start} – {a.end}
                    </strong>
                    <span>{a.clientName}</span>
                    <br />
                    <span className="muted" style={{ fontSize: '0.85rem' }}>
                      {a.email}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* ---- zi liberă ---- */}
          {!isPast && (
            <div className="day-off-box">
              {!isOff && (
                <div className="field">
                  <label htmlFor="note">Zi liberă — motiv (opțional)</label>
                  <input id="note" placeholder="Crăciun, concediu…" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
              )}
              {!isOff && appointments && appointments.length > 0 && (
                <p className="field-error">
                  Ai {appointments.length === 1 ? 'o programare' : `${appointments.length} programări`} în ziua asta.
                  Ele rămân valabile — anunță clientele dacă nu lucrezi.
                </p>
              )}
              <button type="button" className="btn btn-secondary btn-block" onClick={toggleDayOff} disabled={saving}>
                {isOff ? 'Lucrez în ziua asta' : 'Marchează zi liberă (X)'}
              </button>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- setări

function SettingsForm({ onSaved }: { onSaved: () => void }) {
  const [settings, setSettings] = useState<SalonSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    schedulingApi
      .settings()
      .then(setSettings)
      .catch((err) => setError(errorText(err, 'Nu am putut încărca setările.')))
  }, [])

  if (!settings) return error ? <div className="alert">{error}</div> : <p className="muted">Se încarcă…</p>

  const set = <K extends keyof SalonSettings>(key: K, value: SalonSettings[K]) => {
    setSettings({ ...settings, [key]: value })
    setSaved(false)
  }

  const toggleDay = (isoDay: number) =>
    set(
      'workDays',
      settings.workDays.includes(isoDay)
        ? settings.workDays.filter((d) => d !== isoDay)
        : [...settings.workDays, isoDay].sort(),
    )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (settings.workStart >= settings.workEnd) {
      setError('Ora de început trebuie să fie înaintea celei de final.')
      return
    }
    if (settings.workDays.length === 0) {
      setError('Alege cel puțin o zi lucrătoare.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      setSettings(await schedulingApi.saveSettings(settings))
      setSaved(true)
      onSaved()
    } catch (err) {
      setError(errorText(err, 'Nu am putut salva setările.'))
    } finally {
      setSaving(false)
    }
  }

  const number = (key: keyof SalonSettings, label: string, hint: string, min: number, max: number) => (
    <div className="field">
      <label htmlFor={key}>{label}</label>
      <input
        id={key}
        type="number"
        min={min}
        max={max}
        value={settings[key] as number}
        onChange={(e) => set(key, Number(e.target.value) as never)}
      />
      <span className="muted" style={{ fontSize: '0.85rem' }}>
        {hint}
      </span>
    </div>
  )

  return (
    <form className="card settings-form" onSubmit={submit} noValidate>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}

      <p className="muted">
        Programul standard se folosește doar la „Completează luna”: deschide automat intervalul de mai jos în zilele
        bifate. Fiecare zi o poți modifica apoi separat din calendar.
      </p>

      <div className="form-row">
        <div className="field">
          <label htmlFor="workStart">Începe la</label>
          <input id="workStart" type="time" step={600} value={settings.workStart} onChange={(e) => set('workStart', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="workEnd">Termină la</label>
          <input id="workEnd" type="time" step={600} value={settings.workEnd} onChange={(e) => set('workEnd', e.target.value)} />
        </div>
      </div>

      <fieldset className="weekday-picker">
        <legend>Zile lucrătoare</legend>
        {WEEKDAYS_LONG.map((name, i) => (
          <label key={name} className={`chip${settings.workDays.includes(i + 1) ? ' is-on' : ''}`}>
            <input type="checkbox" checked={settings.workDays.includes(i + 1)} onChange={() => toggleDay(i + 1)} />
            {name}
          </label>
        ))}
      </fieldset>

      <div className="settings-grid">
        {number('breakMinutes', 'Pauză între cliente (min)', 'Se adaugă după fiecare lucrare.', 0, 120)}
        {number('defaultDurationMinutes', 'Durată lucrare (min)', 'Până calculăm durata din fișa clientei.', 15, 480)}
        {number('minNoticeHours', 'Programare cu minim (ore) înainte', 'Clientele nu se pot programa mai aproape de atât.', 0, 168)}
        {number('bookingWindowDays', 'Programări cu maxim (zile) înainte', 'Cât de departe se vede calendarul.', 1, 365)}
      </div>

      <div className="settings-actions">
        <button type="submit" className="btn btn-primary" disabled={saving} aria-busy={saving}>
          {saving ? 'Se salvează…' : 'Salvează'}
        </button>
        {saved && <span className="muted">Salvat.</span>}
      </div>
    </form>
  )
}
