import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import { schedulingApi, type Appointment } from '../api/scheduling'
import { useAuth } from '../auth/context'
import { formatLong } from '../lib/dates'

export function Profile() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const load = useCallback(() => {
    schedulingApi
      .mine()
      .then(setAppointments)
      .catch(() => setError('Nu am putut încărca programările.'))
  }, [])

  useEffect(() => {
    if (user?.role === 'client') load()
  }, [user, load])

  const cancel = async (a: Appointment) => {
    if (!window.confirm(`Anulezi programarea din ${formatLong(a.date)}, ora ${a.start}?`)) return
    setCancelling(a.id)
    setError(null)
    try {
      await schedulingApi.cancel(a.id)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu am putut anula programarea.')
    } finally {
      setCancelling(null)
    }
  }

  if (!user) return null

  return (
    <section>
      <span className="eyebrow">Contul meu</span>
      <h1>Bună, {user.firstName}!</h1>
      <p className="muted">{user.email}</p>

      {user.role === 'client' && (
        <>
          <h2 className="section-title">Programările mele</h2>
          {error && <div className="alert">{error}</div>}
          {appointments === null ? (
            <p className="muted">Se încarcă…</p>
          ) : appointments.length === 0 ? (
            <p className="muted">
              Nu ai nicio programare viitoare. <Link to="/">Alege o zi din calendar</Link>.
            </p>
          ) : (
            <ul className="appointment-list">
              {appointments.map((a) => (
                <li key={a.id} className="appointment-item">
                  <div>
                    <strong>{formatLong(a.date)}</strong>
                    <span className="muted">
                      {a.start} – {a.end}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => cancel(a)}
                    disabled={cancelling === a.id}
                    aria-busy={cancelling === a.id}
                  >
                    Anulează
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="info-grid">
        <div className="info-tile">
          <strong>Fișa de cunoaștere</strong>
          <span className="muted">Urmează: detaliile despre unghii și designul dorit.</span>
        </div>
        <div className="info-tile">
          <strong>Card de fidelitate</strong>
          <span className="muted">Urmează: codul QR și vizitele bifate.</span>
        </div>
      </div>
    </section>
  )
}
