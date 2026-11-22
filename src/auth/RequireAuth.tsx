import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Role } from '../api/client'
import { useAuth } from './context'

/** Protejează o pagină: fără sesiune → login; cu rol greșit → acasă. */
export function RequireAuth({ role, children }: { role?: Role; children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="page-loading">Se încarcă…</div>
  if (!user) return <Navigate to="/autentificare" replace state={{ from: location.pathname }} />
  if (role && user.role !== role) return <Navigate to="/" replace />

  return children
}
