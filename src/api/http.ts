type ApiError = { message?: string; detail?: string }
type CsrfToken = { headerName: string; token: string }

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

async function getCsrfToken(): Promise<CsrfToken> {
  const response = await fetch('/api/auth/csrf', { credentials: 'same-origin', signal: AbortSignal.timeout(5000) })
  if (!response.ok) throw new ApiRequestError(`Could not get a CSRF token (HTTP ${response.status}). Check that the backend is running and you are signed in.`, response.status)
  return response.json() as Promise<CsrfToken>
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = await getCsrfToken()
    headers.set(csrf.headerName, csrf.token)
  }

  const response = await fetch(`/api/${path.replace(/^\/+/, '')}`, {
    ...init,
    method,
    credentials: 'same-origin',
    headers,
    signal: init.signal ?? AbortSignal.timeout(15000),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null) as ApiError | null
    const message = result?.detail ?? result?.message ?? (response.status === 413
      ? 'The upload is too large. Videos: up to 20 MB; all attachments: up to 30 MB.'
      : response.status === 429
        ? 'Too many attempts. Please wait a moment and try again.'
        : 'Request failed. Please try again.')
    if (response.status === 401 && !path.startsWith('auth/login')) {
      window.dispatchEvent(new CustomEvent('nightfall:auth-required'))
    }
    throw new ApiRequestError(message, response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
