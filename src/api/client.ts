// Client HTTP pentru API-ul .NET.
// - Access token-ul stă doar în memorie (nu în localStorage), ca să nu poată fi citit de scripturi străine.
// - Refresh token-ul e în cookie httpOnly; browserul îl trimite singur la /api/auth/*.
// - La 401 încercăm o singură dată un refresh, apoi repetăm cererea.

export type Role = 'client' | 'admin'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: Role
}

export interface AuthResponse {
  accessToken: string
  expiresAt: string
  user: User
}

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string[]>

  constructor(status: number, message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
  }

  static async from(res: Response): Promise<ApiError> {
    let body: { detail?: string; title?: string; errors?: Record<string, string[]> } = {}
    try {
      body = await res.json()
    } catch {
      /* răspuns fără corp JSON */
    }
    const fallback =
      res.status === 429
        ? 'Prea multe încercări. Mai încearcă peste un minut.'
        : 'A apărut o problemă. Mai încearcă o dată.'
    return new ApiError(res.status, body.detail ?? fallback, body.errors ?? {})
  }
}

let accessToken: string | null = null
let refreshInFlight: Promise<AuthResponse | null> | null = null
let sessionListener: ((session: AuthResponse | null) => void) | null = null

/** AuthProvider se abonează aici, ca să afle când sesiunea se schimbă din afara lui. */
export function onSessionChange(listener: typeof sessionListener) {
  sessionListener = listener
}

export function setSession(session: AuthResponse | null) {
  accessToken = session?.accessToken ?? null
  sessionListener?.(session)
}

/**
 * Cere un access token nou folosind cookie-ul. Cererile simultane folosesc același apel:
 * serverul rotește token-ul, iar două refresh-uri cu același cookie ar închide sesiunea.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then(async (res) => (res.ok ? ((await res.json()) as AuthResponse) : null))
    .catch(() => null)
    .then((session) => {
      setSession(session)
      return session
    })
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

export async function api<T>(path: string, { method = 'GET', body }: RequestOptions = {}): Promise<T> {
  const send = () =>
    fetch(path, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

  let res = await send()
  if (res.status === 401 && accessToken && (await refreshSession())) {
    res = await send()
  }

  if (!res.ok) throw await ApiError.from(res)
  return (res.status === 204 ? undefined : await res.json()) as T
}
