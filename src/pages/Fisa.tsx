import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { profileApi, type ClientProfile, type Pricing } from '../api/profile'
import { WEEKDAYS_SHORT, formatDuration } from '../lib/dates'
import {
  CUTICLES,
  EMPTY_PROFILE,
  GROWTH,
  LENGTH,
  MATERIAL,
  NAIL_BED,
  estimateWork,
  type Option,
} from '../lib/profileOptions'

const STEPS = ['Unghiile tale', 'Ce îți dorești', 'Despre tine']

/** Un grup de „plăcuțe” lucioase din care alegi una. */
function Choice({
  legend, options, value, onChange,
}: { legend: string; options: Option[]; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset className="choice">
      <legend>{legend}</legend>
      <div className="choice-grid">
        {options.map((o) => (
          <label key={o.value} className={`choice-tile${value === o.value ? ' is-on' : ''}`}>
            <input type="radio" name={legend} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span className="choice-label">{o.label}</span>
            {o.hint && <span className="choice-hint">{o.hint}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function Fisa() {
  const navigate = useNavigate()
  const location = useLocation()
  const pendingDay = (location.state as { day?: string } | null)?.day

  const [profile, setProfile] = useState<ClientProfile>(EMPTY_PROFILE)
  const [pricing, setPricing] = useState<Pricing | null>(null)
  const [isNew, setIsNew] = useState(true)
  const [consent, setConsent] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([profileApi.pricing(), profileApi.get()])
      .then(([p, existing]) => {
        setPricing(p)
        if (existing) {
          setProfile(existing.profile)
          setIsNew(false)
          setConsent(true)
        }
      })
      .catch(() => setError('Nu am putut încărca fișa. Reîncarcă pagina.'))
      .finally(() => setLoading(false))
  }, [])

  const set = <K extends keyof ClientProfile>(key: K, value: ClientProfile[K]) => {
    setProfile((p) => ({ ...p, [key]: value }))
    setError(null)
  }

  const estimate = useMemo(() => (pricing ? estimateWork(profile, pricing) : null), [profile, pricing])

  const stepError = (s: number): string | null => {
    if (s === 0) {
      if (!profile.growth) return 'Spune-ne cum îți cresc unghiile.'
      if (!profile.nailBed) return 'Alege tipul patului unghial.'
      if (!profile.cuticles) return 'Alege cum sunt cuticulele.'
      if (!profile.existingMaterial) return 'Spune-ne dacă ai deja ceva pe unghii.'
    }
    if (s === 1) {
      if (!profile.service) return 'Alege lucrarea pe care o vrei.'
      if (!profile.length) return 'Alege lungimea.'
    }
    if (s === 2) {
      if (profile.age !== null && (profile.age < 12 || profile.age > 110)) return 'Vârsta nu pare corectă.'
      if (Boolean(profile.preferredFrom) !== Boolean(profile.preferredTo)) return 'Completează ambele ore preferate sau niciuna.'
      if (profile.preferredFrom && profile.preferredTo && profile.preferredFrom >= profile.preferredTo)
        return 'Ora de început trebuie să fie înaintea celei de final.'
      if (!consent) return 'Bifează acordul pentru prelucrarea datelor.'
    }
    return null
  }

  const next = () => {
    const err = stepError(step)
    if (err) return setError(err)
    setError(null)
    setStep((s) => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const save = async () => {
    const err = stepError(2)
    if (err) return setError(err)
    setSaving(true)
    setError(null)
    try {
      await profileApi.save(profile, consent)
      // a venit din calendar: o ducem înapoi la ziua aleasă
      navigate(pendingDay ? '/' : '/profil', { replace: true, state: pendingDay ? { day: pendingDay } : undefined })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Nu am putut salva fișa.')
    } finally {
      setSaving(false)
    }
  }

  const setModel = (i: number, value: string) => set('models', profile.models.map((m, j) => (j === i ? value : m)))
  const toggleDay = (d: number) =>
    set('preferredDays', profile.preferredDays.includes(d) ? profile.preferredDays.filter((x) => x !== d) : [...profile.preferredDays, d].sort())

  if (loading) return <div className="page-loading">Se încarcă…</div>

  return (
    <section className="fisa">
      <span className="eyebrow">Fișa de cunoaștere</span>
      <h1>{isNew ? 'Hai să ne cunoaștem unghiile' : 'Fișa ta'}</h1>
      <p className="muted lead">
        {isNew
          ? 'Durează un minut. Din răspunsuri aflăm cât durează lucrarea ta și îți arătăm doar orele potrivite.'
          : 'Actualizează ce s-a schimbat — prețul și durata se recalculează pe loc.'}
      </p>

      <ol className="steps" aria-label="Pași">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'is-current' : i < step ? 'is-done' : ''}>
            <button type="button" onClick={() => i < step && setStep(i)} disabled={i > step}>
              <span className="step-dot">{i < step ? '✓' : i + 1}</span>
              <span className="step-name">{s}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="fisa-layout">
        <div className="card fisa-card">
          {step === 0 && (
            <>
              <Choice legend="Cum îți cresc unghiile?" options={GROWTH} value={profile.growth} onChange={(v) => set('growth', v)} />
              <Choice legend="Patul unghial" options={NAIL_BED} value={profile.nailBed} onChange={(v) => set('nailBed', v)} />
              <Choice legend="Cuticulele" options={CUTICLES} value={profile.cuticles} onChange={(v) => set('cuticles', v)} />
              <Choice legend="Ai acum ceva pe unghii?" options={MATERIAL} value={profile.existingMaterial} onChange={(v) => set('existingMaterial', v)} />
            </>
          )}

          {step === 1 && pricing && (
            <>
              <Choice
                legend="Ce lucrare vrei?"
                options={pricing.services.map((s) => ({
                  value: s.code,
                  label: s.name,
                  hint: `${s.price} lei · ${formatDuration(s.minutes)}`,
                }))}
                value={profile.service}
                onChange={(v) => set('service', v)}
              />
              <Choice legend="Lungimea dorită" options={LENGTH} value={profile.length} onChange={(v) => set('length', v)} />

              <fieldset className="choice">
                <legend>Design</legend>
                <div className="choice-grid two">
                  <label className={`choice-tile${!profile.wantsDesign ? ' is-on' : ''}`}>
                    <input type="radio" name="design" checked={!profile.wantsDesign} onChange={() => set('wantsDesign', false)} />
                    <span className="choice-label">Simplu</span>
                    <span className="choice-hint">O culoare, fără modele</span>
                  </label>
                  <label className={`choice-tile${profile.wantsDesign ? ' is-on' : ''}`}>
                    <input type="radio" name="design" checked={profile.wantsDesign} onChange={() => set('wantsDesign', true)} />
                    <span className="choice-label">Vreau ceva anume</span>
                    <span className="choice-hint">Culori, modele</span>
                  </label>
                </div>
              </fieldset>

              {profile.wantsDesign && (
                <div className="design-box">
                  <div className="stepper-row">
                    <span>Câte culori?</span>
                    <div className="stepper">
                      <button type="button" aria-label="Mai puține culori" onClick={() => set('colors', Math.max(1, profile.colors - 1))}>−</button>
                      <output aria-live="polite">{profile.colors}</output>
                      <button type="button" aria-label="Mai multe culori" onClick={() => set('colors', Math.min(10, profile.colors + 1))}>+</button>
                    </div>
                  </div>

                  <div className="models">
                    <span>Modele</span>
                    {profile.models.map((m, i) => (
                      <div key={i} className="model-row">
                        <input
                          value={m}
                          maxLength={80}
                          placeholder="ex. french, flori, ombre"
                          aria-label={`Modelul ${i + 1}`}
                          onChange={(e) => setModel(i, e.target.value)}
                        />
                        <button type="button" aria-label={`Șterge modelul ${i + 1}`} onClick={() => set('models', profile.models.filter((_, j) => j !== i))}>
                          ✕
                        </button>
                      </div>
                    ))}
                    {profile.models.length < 10 && (
                      <button type="button" className="chip add-model" onClick={() => set('models', [...profile.models, ''])}>
                        + model
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="field narrow">
                <label htmlFor="age">Vârsta (opțional)</label>
                <input
                  id="age"
                  type="number"
                  inputMode="numeric"
                  min={12}
                  max={110}
                  value={profile.age ?? ''}
                  onChange={(e) => set('age', e.target.value ? Number(e.target.value) : null)}
                />
              </div>

              <fieldset className="choice">
                <legend>Zilele în care ți-ar plăcea să vii (opțional)</legend>
                <div className="weekday-picker">
                  {WEEKDAYS_SHORT.map((d, i) => (
                    <label key={d} className={`chip${profile.preferredDays.includes(i + 1) ? ' is-on' : ''}`}>
                      <input type="checkbox" checked={profile.preferredDays.includes(i + 1)} onChange={() => toggleDay(i + 1)} />
                      {d}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="form-row">
                <div className="field">
                  <label htmlFor="pfrom">Ora preferată — de la</label>
                  <input id="pfrom" type="time" step={1800} value={profile.preferredFrom ?? ''} onChange={(e) => set('preferredFrom', e.target.value || null)} />
                </div>
                <div className="field">
                  <label htmlFor="pto">până la</label>
                  <input id="pto" type="time" step={1800} value={profile.preferredTo ?? ''} onChange={(e) => set('preferredTo', e.target.value || null)} />
                </div>
              </div>

              <div className="field">
                <label htmlFor="notes">Ceva ce ar trebui să știm? (opțional)</label>
                <textarea
                  id="notes"
                  rows={3}
                  maxLength={500}
                  placeholder="Alergii, unghii sensibile, o poză pe care o aduci…"
                  value={profile.notes ?? ''}
                  onChange={(e) => set('notes', e.target.value || null)}
                />
              </div>

              <label className="consent">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                  Sunt de acord ca salonul să păstreze datele din fișă ca să-mi pregătească programările. Le pot modifica
                  oricând din contul meu.
                </span>
              </label>
            </>
          )}

          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}

          <div className="fisa-actions">
            {step > 0 ? (
              <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>
                ← Înapoi
              </button>
            ) : (
              <Link to={isNew ? '/' : '/profil'} className="btn btn-ghost">
                Renunță
              </Link>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn btn-primary" onClick={next}>
                Continuă
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving} aria-busy={saving}>
                {saving ? 'Se salvează…' : pendingDay ? 'Salvează și alege ora' : 'Salvează fișa'}
              </button>
            )}
          </div>
        </div>

        {/* estimarea live: durată și preț */}
        <aside className="card estimate-card" aria-live="polite">
          <span className="panel-subtitle">Lucrarea ta</span>
          {estimate ? (
            <>
              <div className="estimate-totals">
                <div>
                  <strong>{formatDuration(estimate.minutes)}</strong>
                  <small>durată</small>
                </div>
                <div>
                  <strong>{estimate.price} lei</strong>
                  <small>preț estimat</small>
                </div>
              </div>
              <ul className="estimate-lines">
                {estimate.lines.map((l) => (
                  <li key={l.name}>
                    <span>{l.name}</span>
                    <span>{l.price} lei</span>
                  </li>
                ))}
              </ul>
              <p className="muted small">Plătești la salon, în ziua programării.</p>
            </>
          ) : (
            <p className="muted">Alege lucrarea și îți arătăm aici durata și prețul.</p>
          )}
        </aside>
      </div>
    </section>
  )
}
