import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { IS_DEMO } from '../api/client'
import { useAuth } from '../auth/context'

export const SALON_NAME = 'Studio Unghii'

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
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
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container">
          © {new Date().getFullYear()} {SALON_NAME}
        </div>
      </footer>
    </>
  )
}
