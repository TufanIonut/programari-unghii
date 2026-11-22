import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth, type RegisterInput } from '../auth/context'

type Field = keyof RegisterInput
type Errors = Partial<Record<Field, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(v: RegisterInput): Errors {
  const errors: Errors = {}
  if (!v.firstName.trim()) errors.firstName = 'Spune-ne prenumele.'
  if (!v.lastName.trim()) errors.lastName = 'Spune-ne numele.'
  if (!EMAIL_RE.test(v.email.trim())) errors.email = 'Adresa de e-mail nu pare corectă.'
  if (v.password.length < 8) errors.password = 'Parola trebuie să aibă cel puțin 8 caractere.'
  return errors
}

/** Erorile de validare de la server vin cu numele câmpului cu majusculă (Email, Password…). */
function fromServer(fieldErrors: Record<string, string[]>): Errors {
  const errors: Errors = {}
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const field = (key.charAt(0).toLowerCase() + key.slice(1)) as Field
    errors[field] = messages[0]
  }
  return errors
}

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [values, setValues] = useState<RegisterInput>({ firstName: '', lastName: '', email: '', password: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const update = (field: Field) => (e: ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [field]: e.target.value }))
    if (errors[field]) setErrors((er) => ({ ...er, [field]: undefined }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const found = validate(values)
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length) return

    setBusy(true)
    try {
      await register({ ...values, email: values.email.trim() })
      navigate('/profil', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(fromServer(err.fieldErrors))
      else setFormError(err instanceof ApiError ? err.message : 'Nu ne-am putut conecta la server.')
    } finally {
      setBusy(false)
    }
  }

  const fieldProps = (field: Field) => ({
    id: field,
    value: values[field],
    onChange: update(field),
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `${field}-error` : undefined,
  })

  const fieldError = (field: Field) =>
    errors[field] && (
      <span id={`${field}-error`} className="field-error">
        {errors[field]}
      </span>
    )

  return (
    <div className="auth-page">
      <div className="card">
        <h1>Hai să ne cunoaștem</h1>
        <p className="muted">Îți faci contul o singură dată. Apoi completezi fișa și alegi ziua.</p>

        <form onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="alert" role="alert">
              {formError}
            </div>
          )}

          <div className="form-row">
            <div className="field">
              <label htmlFor="firstName">Prenume</label>
              <input {...fieldProps('firstName')} autoComplete="given-name" />
              {fieldError('firstName')}
            </div>
            <div className="field">
              <label htmlFor="lastName">Nume</label>
              <input {...fieldProps('lastName')} autoComplete="family-name" />
              {fieldError('lastName')}
            </div>
          </div>

          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input {...fieldProps('email')} type="email" autoComplete="email" placeholder="nume@exemplu.ro" />
            {fieldError('email')}
          </div>

          <div className="field">
            <label htmlFor="password">Parolă</label>
            <input {...fieldProps('password')} type="password" autoComplete="new-password" />
            {fieldError('password') ?? <span className="muted" style={{ fontSize: '0.85rem' }}>Minim 8 caractere.</span>}
          </div>

          <button type="submit" className="btn btn-primary btn-block" aria-busy={busy} disabled={busy}>
            {busy ? 'Se creează contul…' : 'Creează contul'}
          </button>
        </form>

        <p className="auth-switch">
          Ai deja cont? <Link to="/autentificare">Intră în cont</Link>
        </p>
      </div>
    </div>
  )
}
