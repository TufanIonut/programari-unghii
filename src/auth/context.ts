import { createContext, useContext } from 'react'
import type { User } from '../api/client'

export interface RegisterInput {
  email: string
  password: string
  firstName: string
  lastName: string
}

export interface AuthState {
  user: User | null
  /** true până aflăm dacă există o sesiune (refresh la pornire). */
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (input: RegisterInput) => Promise<User>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth trebuie folosit în interiorul <AuthProvider>.')
  return ctx
}
