import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { ApiError, IS_DEMO } from '../api/client'
import { loyaltyApi, type LoyaltySettings, type ScanResult } from '../api/loyalty'
import { DEMO_LOYALTY_CODES } from '../demo/loyaltyCodes'
import { StampDots } from './LoyaltyCard'

// camera și jsQR se încarcă doar când proprietara apasă „Scanează”
const QrScanner = lazy(() => import('./QrScanner').then((m) => ({ default: m.QrScanner })))

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback)

/** Scanarea cardului de fidelitate: fiecare scanare bifează vizita de azi a clientei. */
export function LoyaltyAdmin() {
  const [scanning, setScanning] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stamp = async (text: string) => {
    setScanning(false)
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult(await loyaltyApi.scan(text))
      setCode('')
    } catch (err) {
      setError(errorText(err, 'Nu am putut bifa vizita. Mai încearcă o dată.'))
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (code.trim()) stamp(code)
  }

  return (
    <div className="loyalty-admin">
      <div className="card loyalty-scan">
        <p className="muted">
          Scanează codul QR din contul clientei. Fiecare scanare bifează o vizită (cel mult una pe zi). Când se umple cardul,
          îți spunem ce recompensă primește clienta azi.
        </p>

        <button type="button" className="btn btn-primary btn-block scan-btn" onClick={() => setScanning(true)} disabled={busy}>
          Scanează cardul
        </button>

        <form className="code-form" onSubmit={submit}>
          <label htmlFor="loyalty-code" className="sr-only">
            Codul cardului
          </label>
          <input
            id="loyalty-code"
            placeholder="sau scrie codul: XXXXX-XXXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary" disabled={busy || !code.trim()} aria-busy={busy}>
            Bifează
          </button>
        </form>

        {IS_DEMO && (
          <p className="muted small">
            În demo poți tasta:{' '}
            {DEMO_LOYALTY_CODES.map((d, i) => (
              <span key={d.code}>
                {i > 0 && ', '}
                <button type="button" className="client-link" onClick={() => setCode(d.code)}>
                  {d.code}
                </button>{' '}
                ({d.name})
              </span>
            ))}
            .
          </p>
        )}

        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}

        {result && (
          <div className={`scan-result${result.completedNow ? ' is-complete' : ''}`} role="status">
            <span className="tile-label">{result.clientName}</span>
            {result.completedNow ? (
              <>
                <strong className="scan-big">Card complet!</strong>
                <p>
                  Azi primește: <em>{result.reward}</em>. Cardul a luat-o de la capăt.
                </p>
              </>
            ) : result.status === 'already_today' ? (
              <>
                <strong className="scan-big">Deja bifată azi</strong>
                <p>
                  O singură vizită pe zi se bifează. Acum are {result.stamps} din {result.required}.
                </p>
              </>
            ) : (
              <>
                <strong className="scan-big">
                  Vizita {result.stamps} din {result.required}
                </strong>
                <p>
                  {result.required - result.stamps === 1
                    ? `La următoarea vizită primește ${result.reward}.`
                    : `Încă ${result.required - result.stamps} vizite până la ${result.reward}.`}
                </p>
              </>
            )}
            <StampDots stamps={result.completedNow ? result.required : result.stamps} required={result.required} />
          </div>
        )}
      </div>

      <LoyaltySettingsForm />

      {scanning && (
        <Suspense fallback={null}>
          <QrScanner onResult={stamp} onClose={() => setScanning(false)} />
        </Suspense>
      )}
    </div>
  )
}

function LoyaltySettingsForm() {
  const [s, setS] = useState<LoyaltySettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loyaltyApi
      .settings()
      .then(setS)
      .catch((err) => setError(errorText(err, 'Nu am putut încărca regulile cardului.')))
  }, [])

  if (!s) return error ? <div className="alert">{error}</div> : <p className="muted">Se încarcă…</p>

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      setS(await loyaltyApi.saveSettings(s))
      setSaved(true)
    } catch (err) {
      setError(errorText(err, 'Nu am putut salva regulile cardului.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <span className="tile-label">Regulile cardului</span>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="stamps-required">Câte vizite are un card</label>
        <input
          id="stamps-required"
          type="number"
          min={2}
          max={20}
          value={s.stampsRequired}
          onChange={(e) => {
            setS({ ...s, stampsRequired: Number(e.target.value) })
            setSaved(false)
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="reward">Ce primește clienta la ultima vizită</label>
        <input
          id="reward"
          maxLength={80}
          value={s.reward}
          onChange={(e) => {
            setS({ ...s, reward: e.target.value })
            setSaved(false)
          }}
        />
      </div>
      <p className="muted small">
        Clientele văd: „La a {s.stampsRequired || '…'}-a vizită: {s.reward || '…'}”.
      </p>
      <div className="settings-actions">
        <button type="submit" className="btn btn-primary" disabled={saving} aria-busy={saving}>
          {saving ? 'Se salvează…' : 'Salvează'}
        </button>
        {saved && <span className="muted">Salvat.</span>}
      </div>
    </form>
  )
}
