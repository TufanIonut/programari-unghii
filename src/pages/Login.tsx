import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError, IS_DEMO } from '../api/client'
import { useAuth } from '../auth/context'

export function Login() {
  const { login, loginDemoAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Completează e-mailul și parola.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const user = await login(email.trim(), password)
      navigate(from ?? (user.role === 'admin' ? '/admin' : '/profil'), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu ne-am putut conecta la server.')
    } finally {
      setBusy(false)
    }
  }

  const enterAsAdmin = async () => {
    setBusy(true)
    try {
      await loginDemoAdmin()
      navigate('/admin', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="card">
        <h1>Bine ai revenit</h1>
        <p className="muted">Intră în cont ca să-ți vezi programările.</p>

        <form onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}

          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nume@exemplu.ro"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Parolă</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" aria-busy={busy} disabled={busy}>
            {busy ? 'Se verifică…' : 'Intră în cont'}
          </button>
        </form>

        {IS_DEMO && (
          <div className="demo-admin">
            <p className="muted">Versiune demo: poți vedea și panoul proprietarei.</p>
            <button type="button" className="btn btn-secondary btn-block" onClick={enterAsAdmin} disabled={busy}>
              Intră ca admin (demo)
            </button>
          </div>
        )}

        <p className="auth-switch">
          Prima dată aici? <Link to="/inregistrare">Creează un cont</Link>
        </p>
      </div>
    </div>
  )
}
