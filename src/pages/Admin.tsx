import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import {
  schedulingApi,
  type AdminAppointment,
  type DayAvailability,
  type SalonSettings,
} from '../api/scheduling'
import { Calendar, LegendItem, type DayInfo } from '../components/Calendar'
import { WEEKDAYS_LONG, addMonths, formatLong, monthRange, parseISO, todayISO } from '../lib/dates'

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback)

export function Admin() {
  // crește la fiecare salvare a programului, ca să se reîncarce calendarul
  const [version, setVersion] = useState(0)

  return (
    <section>
      <span className="eyebrow">Administrare</span>
      <h1>Panoul salonului</h1>
      <p className="muted">Alege o zi ca să vezi programările sau ca s-o marchezi liberă (X).</p>

      <ScheduleCalendar version={version} />

      <h2 className="section-title">Program de lucru</h2>
      <SettingsForm onSaved={() => setVersion((v) => v + 1)} />
    </section>
  )
}

// ---------------------------------------------------------------- calendar + zi

function ScheduleCalendar({ version }: { version: number }) {
  const today = parseISO(todayISO())
  const [view, setView] = useState({ year: today.year, month: today.month })
  const [days, setDays] = useState<Record<string, DayAvailability>>({})
  const [daysOff, setDaysOff] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)

  const [selected, setSelected] = useState<string>(todayISO())
  const [appointments, setAppointments] = useState<AdminAppointment[] | null>(null)
  const [dayError, setDayError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')

  const loadMonth = useCallback(async (year: number, month: number) => {
    const { from, to } = monthRange(year, month)
    setLoading(true)
    try {
      const [availability, off] = await Promise.all([
        schedulingApi.availability(from, to),
        schedulingApi.daysOff(from, to),
      ])
      setDays(Object.fromEntries(availability.days.map((d) => [d.date, d])))
      setDaysOff(Object.fromEntries(off.map((d) => [d.date, d.note])))
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
    const d = days[iso]
    switch (d?.status) {
      case 'available':
        return { variant: 'available', hint: 'Are locuri' }
      case 'full':
        return { variant: 'full', hint: 'Complet' }
      case 'closed':
        return { variant: 'closed' }
      default:
        return { variant: 'past' }
    }
  }

  const isOff = selected in daysOff

  const toggleDayOff = async () => {
    setSaving(true)
    setDayError(null)
    try {
      if (isOff) await schedulingApi.removeDayOff(selected)
      else await schedulingApi.setDayOff(selected, note.trim() || undefined)
      await loadMonth(view.year, view.month)
    } catch (err) {
      setDayError(errorText(err, 'Nu am putut salva ziua.'))
    } finally {
      setSaving(false)
    }
  }

  return (
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
              <LegendItem variant="available">Are locuri</LegendItem>
              <LegendItem variant="full">Complet</LegendItem>
              <LegendItem variant="off">Zi liberă</LegendItem>
            </>
          }
        />
      </div>

      <aside className="card slot-panel" aria-live="polite">
        <h2 className="slot-title">{formatLong(selected)}</h2>
        {dayError && <div className="alert">{dayError}</div>}

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

        <div className="day-off-box">
          {isOff ? (
            <p>
              Ziua e marcată <strong>liberă</strong>
              {daysOff[selected] ? ` (${daysOff[selected]})` : ''}. Clientele nu se pot programa.
            </p>
          ) : (
            <div className="field">
              <label htmlFor="note">Motiv (opțional)</label>
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
      </aside>
    </div>
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
          {saving ? 'Se salvează…' : 'Salvează programul'}
        </button>
        {saved && <span className="muted">Salvat.</span>}
      </div>
    </form>
  )
}
