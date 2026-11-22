import { Link, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './auth/RequireAuth'
import { Layout } from './components/Layout'
import { Admin } from './pages/Admin'
import { Fisa } from './pages/Fisa'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Profile } from './pages/Profile'
import { Register } from './pages/Register'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="autentificare" element={<Login />} />
        <Route path="inregistrare" element={<Register />} />
        <Route
          path="profil"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />
        <Route
          path="fisa"
          element={
            <RequireAuth role="client">
              <Fisa />
            </RequireAuth>
          }
        />
        <Route
          path="admin"
          element={
            <RequireAuth role="admin">
              <Admin />
            </RequireAuth>
          }
        />
        <Route
          path="*"
          element={
            <section>
              <h1>Pagina nu există</h1>
              <Link to="/">Înapoi acasă</Link>
            </section>
          }
        />
      </Route>
    </Routes>
  )
}
