import { Link } from 'react-router-dom'
import { useAuth } from '../auth/context'

export function Home() {
  const { user } = useAuth()

  return (
    <section className="hero">
      <div>
        <span className="eyebrow">Programări online</span>
        <h1>Unghii frumoase, la ora care ți se potrivește</h1>
        <p className="muted">
          Alegi ziua din calendar, iar noi îți arătăm orele libere în funcție de lucrarea pe care o dorești.
          Primești confirmarea și un memento pe e-mail.
        </p>
        <div className="hero-actions">
          {user ? (
            <Link to="/profil" className="btn btn-primary">
              Contul meu
            </Link>
          ) : (
            <>
              <Link to="/inregistrare" className="btn btn-primary">
                Programează-te
              </Link>
              <Link to="/autentificare" className="btn btn-secondary">
                Am deja cont
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="hero-visual" aria-hidden="true">
        <svg viewBox="0 0 120 160" fill="none">
          <rect x="38" y="4" width="44" height="46" rx="8" fill="#6B3F52" />
          <rect x="30" y="50" width="60" height="10" rx="3" fill="#6B3F52" />
          <path
            d="M24 70c0-5.5 4.5-10 10-10h52c5.5 0 10 4.5 10 10v68c0 9-7 16-16 16H40c-9 0-16-7-16-16V70z"
            fill="#FBF7F3"
          />
          <path d="M24 96h72v42c0 9-7 16-16 16H40c-9 0-16-7-16-16V96z" fill="#6B3F52" />
          <rect x="34" y="74" width="8" height="18" rx="4" fill="#E8C4C4" />
        </svg>
      </div>
    </section>
  )
}
