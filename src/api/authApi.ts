import { apiRequest } from './http'

export type AuthUser = {
  id: string
  firstName: string
  lastName: string
  username: string
  email: string
}

export type AuthSession = {
  authenticated: boolean
  user: AuthUser | null
}

export type AuthConfig = {
  inviteRequired: boolean
  emailVerificationRequired: boolean
  passwordResetAvailable: boolean
  invitationsAvailable: boolean
}

export class BackendUnavailableError extends Error {}

export class AuthCheckError extends Error {
  constructor(readonly status: number) {
    super(`Session check failed (${status}).`)
  }
}

async function post<T>(path: string, body?: unknown, timeoutMs = 15000): Promise<T> {
  return apiRequest<T>(`auth/${path}`, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) })
}

export async function getAuthSession(): Promise<AuthSession> {
  let health: Response
  try {
    health = await fetch('/api/health', { signal: AbortSignal.timeout(3000) })
  } catch {
    throw new BackendUnavailableError('API is currently unavailable.')
  }
  if (!health.ok) throw new BackendUnavailableError('API is currently unavailable.')

  const response = await fetch('/api/auth/session', { credentials: 'same-origin', signal: AbortSignal.timeout(3000) })
  if (!response.ok) throw new AuthCheckError(response.status)
  return response.json() as Promise<AuthSession>
}

export async function getAuthConfig(): Promise<AuthConfig> {
  return apiRequest<AuthConfig>('auth/config', { signal: AbortSignal.timeout(3000) })
}

export function registerAccount(input: {
  firstName: string
  lastName: string
  username: string
  email: string
  password: string
  confirmPassword: string
  inviteCode?: string
}) {
  return post<{ message: string; verificationRequired: boolean }>('register', input, 35000)
}

export function loginAccount(identifier: string, password: string) {
  return post<AuthSession>('login', { identifier, password })
}

export function verifyEmail(token: string, password: string) {
  return post<{ message: string }>('verify', { token, password })
}

export function resendVerification(email: string) {
  return post<{ message: string }>('resend-verification', { email }, 35000)
}

export function sendInvitation(email: string) {
  return post<{ message: string }>('invite', { email }, 35000)
}

export function requestPasswordReset(identifier: string) {
  return post<{ message: string }>('password-reset/request', { identifier }, 35000)
}

export function confirmPasswordReset(token: string, password: string, confirmPassword: string) {
  return post<{ message: string }>('password-reset/confirm', { token, password, confirmPassword })
}

export function logoutAccount() {
  return post<void>('logout')
}
