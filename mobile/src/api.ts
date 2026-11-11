import AsyncStorage from '@react-native-async-storage/async-storage'

export type AuthUser = { id: string; firstName: string; lastName: string; username: string; email: string }
export type AuthSession = { authenticated: boolean; user: AuthUser | null }
export type Chat = { id: string; name: string; handle?: string; avatar?: string; accent?: string; lastMessage?: string; time?: string; unread: number; kind: string; peerId?: string; pinned?: boolean }
export type Message = { id: string; author: string; avatar?: string; text: string; time: string; own: boolean; edited?: boolean; createdAt: number }
export type HubPost = { id: string; author: string; username: string; body: string; createdAt?: string; likes: number; comments: number; liked?: boolean; accent?: string }
export type HubComment = { id: string; postId: string; author: string; username: string; body: string; createdAt: string }

const API_URL_KEY = 'nightfall.mobile.api-url'
const DEFAULT_API_URL = 'http://localhost:8080'
let csrf: { headerName: string; token: string } | null = null

function normalizeUrl(value: string) {
  const url = value.trim().replace(/\/+$/, '')
  return url || DEFAULT_API_URL
}

export async function getApiUrl() { return normalizeUrl(await AsyncStorage.getItem(API_URL_KEY) ?? DEFAULT_API_URL) }
export async function setApiUrl(value: string) { await AsyncStorage.setItem(API_URL_KEY, normalizeUrl(value)); csrf = null }

export class ApiError extends Error { constructor(message: string, readonly status: number) { super(message) } }

async function getCsrf() {
  const base = await getApiUrl()
  const response = await fetch(`${base}/api/auth/csrf`, { credentials: 'include' })
  if (!response.ok) throw new ApiError(`Не удалось получить CSRF-токен (${response.status}).`, response.status)
  csrf = await response.json() as { headerName: string; token: string }
  return csrf
}

export async function api<T>(path: string, init: RequestInit = {}) {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  if (init.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // Login rotates the session and clears the server-side CSRF token. Fetching
    // it for every mutating request keeps the mobile client in sync with that
    // browser-session security model.
    const token = await getCsrf()
    headers.set(token.headerName, token.token)
  }
  const base = await getApiUrl()
  const response = await fetch(`${base}/api/${path.replace(/^\/+/, '')}`, { ...init, method, headers, credentials: 'include' })
  if (!response.ok) {
    if (response.status === 403 && method !== 'GET') csrf = null
    const body = await response.json().catch(() => null) as { detail?: string; message?: string } | null
    throw new ApiError(body?.detail ?? body?.message ?? `Запрос не выполнен (${response.status}).`, response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function login(identifier: string, password: string) {
  return api<AuthSession>('auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) })
}
export function session() { return api<AuthSession>('auth/session') }
export function logout() { return api<void>('auth/logout', { method: 'POST' }) }
export function listFeed() { return api<HubPost[]>('hub/posts') }
export function toggleLike(postId: string) { return api<HubPost>(`hub/posts/${encodeURIComponent(postId)}/reactions`, { method: 'POST' }) }
export function listComments(postId: string) { return api<HubComment[]>(`hub/posts/${encodeURIComponent(postId)}/comments`) }
export function addComment(postId: string, body: string) { return api<HubComment>(`hub/posts/${encodeURIComponent(postId)}/comments`, { method: 'POST', body: JSON.stringify({ body }) }) }
export function listChats() { return api<Chat[]>('chats') }
export function listMessages(chatId: string) { return api<Message[]>(`chats/${encodeURIComponent(chatId)}/messages?limit=100`) }
export function sendMessage(chatId: string, text: string) { return api<Message>(`chats/${encodeURIComponent(chatId)}/messages`, { method: 'POST', body: JSON.stringify({ text }) }) }
