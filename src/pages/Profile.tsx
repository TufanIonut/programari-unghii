import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import { loyaltyApi, type LoyaltyCard as Card } from '../api/loyalty'
import { profileApi, type ProfileResponse } from '../api/profile'
import { schedulingApi, type Appointment } from '../api/scheduling'
import { useAuth } from '../auth/context'
import { LoyaltyCard } from '../components/LoyaltyCard'
import { formatDuration, formatLong } from '../lib/dates'
import { LENGTH, MATERIAL, labelOf } from '../lib/profileOptions'

export function Profile() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [fisa, setFisa] = useState<ProfileResponse | null | undefined>(undefined)
  const [card, setCard] = useState<Card | null>(null)

  const load = useCallback(() => {
    schedulingApi
      .mine()
      .then(setAppointments)
      .catch(() => setError('Nu am putut încărca programările.'))
  }, [])

  useEffect(() => {
    if (user?.role !== 'client') return
    load()
    profileApi.get().then(setFisa).catch(() => setFisa(undefined))
    loyaltyApi.card().then(setCard).catch(() => setCard(null))
  }, [user, load])

  // venit din placa „Cardul tău”: cardul se încarcă după pagină, așa că derulăm noi la el
  useEffect(() => {
    if (card && window.location.hash === '#card') document.getElementById('card')?.scrollIntoView({ behavior: 'smooth' })
  }, [card])

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
                    {a.serviceName && (
                      <span className="work-tag">
                        {a.serviceName}
                        {a.price != null && ` · ${a.price} lei`}
                      </span>
                    )}
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

      {user.role === 'client' && fisa !== undefined && (
        <>
          <h2 className="section-title">Fișa mea</h2>
          {fisa ? (
            <div className="card fisa-summary">
              <div className="estimate-totals">
                <div>
                  <strong>{formatDuration(fisa.estimate.minutes)}</strong>
                  <small>durată</small>
                </div>
                <div>
                  <strong>{fisa.estimate.price} lei</strong>
                  <small>preț estimat</small>
                </div>
              </div>
              <p>
                <strong>{fisa.estimate.summary}</strong>
              </p>
              <p className="muted small">
                Lungime: {labelOf(LENGTH, fisa.profile.length)} · Material acum: {labelOf(MATERIAL, fisa.profile.existingMaterial)}
                {fisa.profile.wantsDesign && fisa.profile.models.length > 0 && <> · Modele: {fisa.profile.models.join(', ')}</>}
              </p>
              <Link to="/fisa" className="btn btn-secondary">
                Modifică fișa
              </Link>
            </div>
          ) : (
            <div className="card fisa-summary">
              <p>Încă nu ai completat fișa. Din ea aflăm cât durează lucrarea ta, ca să-ți arătăm orele potrivite.</p>
              <Link to="/fisa" className="btn btn-primary">
                Completează fișa
              </Link>
            </div>
          )}
        </>
      )}

      {card && (
        <>
          <h2 className="section-title" id="card">
            Cardul meu
          </h2>
          <LoyaltyCard card={card} />
        </>
      )}
    </section>
  )
}
