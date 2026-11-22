import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { IS_DEMO } from '../api/client'
import { useState } from 'react'
import { useAuth } from '../auth/context'
import { SEASON_LABEL, loadSeasonChoice, resolveSeason, saveSeasonChoice, seasonOf, type SeasonChoice } from '../lib/seasons'
import { SeasonalBackdrop } from './SeasonalBackdrop'

export const SALON_NAME = 'Studio Unghii'

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const [seasonChoice, setSeasonChoice] = useState<SeasonChoice>(loadSeasonChoice)
  const season = resolveSeason(seasonChoice)
  const changeSeason = (choice: SeasonChoice) => {
    setSeasonChoice(choice)
    saveSeasonChoice(choice)
  }

  const navClass = ({ isActive }: { isActive: boolean }) => `btn btn-ghost${isActive ? ' active' : ''}`

  const resetDemo = async () => {
    if (!window.confirm('Ștergi datele demo de pe acest dispozitiv și o iei de la capăt?')) return
    const { resetDemo } = await import('../demo/mockServer')
    resetDemo()
    window.location.reload()
  }

  return (
    <>
      {season && <SeasonalBackdrop season={season} />}
      {IS_DEMO && (
        <div className="demo-banner" role="note">
          <span>Versiune demo — datele sunt simulate și rămân doar pe acest dispozitiv.</span>
          <button type="button" onClick={resetDemo}>
            Resetează
          </button>
        </div>
      )}
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
            <span>{SALON_NAME}</span>
          </Link>

          <nav className="nav" aria-label="Navigare principală">
            {user?.role === 'admin' && (
              <NavLink to="/admin" className={navClass}>
                Administrare
              </NavLink>
            )}
            {user ? (
              <>
                <NavLink to="/profil" className={navClass}>
                  {user.firstName}
                </NavLink>
                <button type="button" className="btn btn-secondary" onClick={handleLogout}>
                  Ieșire
                </button>
              </>
            ) : (
              <>
                <NavLink to="/autentificare" className={navClass}>
                  Intră în cont
                </NavLink>
                <Link to="/inregistrare" className="btn btn-primary">
                  Cont nou
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="container">
        {/* cheia nouă la fiecare rută repornește animația de intrare a paginii */}
        <div className="page" key={location.pathname}>
          <Outlet />
        </div>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <span>
            © {new Date().getFullYear()} {SALON_NAME}
          </span>
          <label className="season-picker">
            <span>Decor</span>
            <select value={seasonChoice} onChange={(e) => changeSeason(e.target.value as SeasonChoice)}>
              <option value="auto">După anotimp ({SEASON_LABEL[seasonOf(new Date())].split(' — ')[1]})</option>
              {(Object.keys(SEASON_LABEL) as (keyof typeof SEASON_LABEL)[]).map((s) => (
                <option key={s} value={s}>
                  {SEASON_LABEL[s]}
                </option>
              ))}
              <option value="off">Fără animație</option>
            </select>
          </label>
        </div>
      </footer>
    </>
  )
}
