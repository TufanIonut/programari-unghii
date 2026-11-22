import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
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

  return (
    <>
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            <img src="/favicon.svg" alt="" />
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
