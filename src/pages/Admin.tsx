import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'

export function Admin() {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<{ message: string }>('/api/admin/ping')
      .then((r) => setMessage(r.message))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Serverul nu răspunde.'))
  }, [])

  return (
    <section>
      <span className="eyebrow">Administrare</span>
      <h1>Panoul salonului</h1>
      {error ? <div className="alert">{error}</div> : <p className="muted">{message ?? 'Se verifică accesul…'}</p>}

      <div className="info-grid">
        <div className="info-tile">
          <strong>Programările zilei</strong>
          <span className="muted">Urmează.</span>
        </div>
        <div className="info-tile">
          <strong>Program de lucru și zile libere</strong>
          <span className="muted">Urmează.</span>
        </div>
        <div className="info-tile">
          <strong>Scanare card fidelitate</strong>
          <span className="muted">Urmează.</span>
        </div>
      </div>
    </section>
  )
}
