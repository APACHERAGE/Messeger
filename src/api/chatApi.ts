import type { Chat, Message } from '../types'
import { browserStorageKey, isPublicPreview } from './runtime'
import { apiRequest, ApiRequestError } from './http'

const seedChats: Chat[] = [
  { id: 'general', name: 'Nightfall HQ', handle: 'nightfall_hq', avatar: 'N', accent: 'violet', lastMessage: 'Mira: the new build is in the channel', time: '12:42', unread: 4, kind: 'channel', pinned: true },
  { id: 'squad', name: 'Squad • Apex', avatar: 'S', accent: 'orange', lastMessage: 'Alex: queue up in 10?', time: '11:08', unread: 2, kind: 'group', pinned: true },
  { id: 'mira', name: 'Mira K.', handle: 'mira.exe', avatar: 'M', accent: 'pink', lastMessage: 'I’ll send the mockups tonight ✦', time: '10:24', online: true, kind: 'dm' },
  { id: 'zero', name: 'zero_cool', handle: 'zero_cool', avatar: 'Z', accent: 'cyan', lastMessage: 'gg, clean run', time: 'Yesterday', kind: 'dm' },
  { id: 'devs', name: 'Dev after dark', avatar: 'D', accent: 'blue', lastMessage: 'Lena: PR #48 is ready for review', time: 'Tue', unread: 8, kind: 'group' },
  { id: 'music', name: 'Late night radio', avatar: '♫', accent: 'green', lastMessage: 'Now playing: KLOUD — Wraith', time: 'Mon', kind: 'channel' },
]

const seedMessages: Record<string, Message[]> = {
  general: [
    { id: '1', author: 'Mira K.', avatar: 'M', text: 'The new build is in the channel. Check out the lobby screen — more breathing room and neon.', time: '12:36', reactions: ['✦ 12', '🔥 4'] },
    { id: '2', author: 'zero_cool', avatar: 'Z', text: 'Looks great. The card glow makes the actions much clearer.', time: '12:38' },
    { id: '3', author: 'You', avatar: 'Y', text: 'And the mobile layout holds up now. Try swiping between rooms.', time: '12:42', own: true, reactions: ['⚡ 3'] },
  ],
  squad: [
    { id: '4', author: 'Alex', avatar: 'A', text: 'Queue up in 10? I’m already in the lobby.', time: '11:04' },
    { id: '5', author: 'You', avatar: 'Y', text: 'Be there in a minute — grabbing some tea.', time: '11:08', own: true },
  ],
  mira: [{ id: '6', author: 'Mira K.', avatar: 'M', text: 'I’ll send the mockups tonight ✦', time: '10:24' }],
  zero: [{ id: '7', author: 'zero_cool', avatar: 'Z', text: 'gg, clean run', time: 'Yesterday' }],
  devs: [{ id: '8', author: 'Lena', avatar: 'L', text: 'PR #48 is ready for review. It includes the new WebSocket gateway.', time: 'Tue' }],
  music: [{ id: '9', author: 'Nightfall Radio', avatar: '♫', text: 'Now playing: KLOUD — Wraith', time: 'Mon' }],
}

export const CHAT_ATTACHMENT_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/ogg', 'audio/wav',
] as const
export const CHAT_ATTACHMENT_ACCEPT = CHAT_ATTACHMENT_TYPES.join(',')
export const CHAT_FILE_LIMIT_BYTES = 1_000_000

export type MessagePageOptions = { limit?: number; before?: number }

type Store = { chats: Chat[]; messages: Record<string, Message[]> }
const storageKey = browserStorageKey('messenger')
let store: Store
try {
  const saved = localStorage.getItem(storageKey)
  store = saved ? JSON.parse(saved) as Store : { chats: seedChats, messages: seedMessages }
  if (!Array.isArray(store.chats) || !store.messages) throw new Error('Invalid store')
} catch {
  store = { chats: seedChats, messages: seedMessages }
}

function save() { localStorage.setItem(storageKey, JSON.stringify(store)) }

type ServerMode = 'unknown' | 'online' | 'offline'
let serverMode: ServerMode = isPublicPreview ? 'offline' : 'unknown'
let pendingProbe: Promise<Chat[]> | null = null

function isClientError(error: unknown) {
  return error instanceof ApiRequestError && error.status >= 400 && error.status < 500
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return apiRequest<T>(path, { ...init, signal: init?.signal ?? AbortSignal.timeout(5000) })
}

export async function listChats(): Promise<Chat[]> {
  if (isPublicPreview) return [...store.chats]
  if (serverMode === 'offline') return [...store.chats]
  if (pendingProbe) return pendingProbe
  pendingProbe = request<Chat[]>('/chats')
    .then(result => {
      serverMode = 'online'
      return result
    })
    .catch(error => {
      if (isClientError(error)) throw error
      serverMode = 'offline'
      return [...store.chats]
    })
    .finally(() => { pendingProbe = null })
  return pendingProbe
}

async function ensureMode(): Promise<boolean> {
  if (serverMode === 'unknown') await listChats()
  return serverMode === 'online'
}

export async function listMessages(chatId: string, options: MessagePageOptions = {}): Promise<Message[]> {
  if (await ensureMode()) {
    const params = new URLSearchParams()
    params.set('limit', String(Math.max(1, Math.min(options.limit ?? 100, 100))))
    if (options.before) params.set('before', String(options.before))
    return request<Message[]>(`/chats/${encodeURIComponent(chatId)}/messages?${params.toString()}`)
  }
  const messages = store.messages[chatId] ?? []
  const before = options.before
  const filtered = before ? messages.filter(message => (message.createdAt ?? 0) < before) : messages
  return filtered.slice(-Math.max(1, Math.min(options.limit ?? 100, 100)))
}

export async function postMessage(chatId: string, text: string): Promise<Message> {
  if (await ensureMode()) return request<Message>(`/chats/${encodeURIComponent(chatId)}/messages`, { method: 'POST', body: JSON.stringify({ text }) })
  const message: Message = {
    id: crypto.randomUUID(),
    author: 'You',
    avatar: 'Y',
    text,
    time: new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(new Date()),
    own: true,
    createdAt: Date.now(),
  }
  store.messages[chatId] = [...(store.messages[chatId] ?? []), message]
  store.chats = store.chats.map(chat => chat.id === chatId ? { ...chat, lastMessage: text, time: message.time, updatedAt: new Date().toISOString() } : chat)
  save()
  return message
}

export async function postMessageWithFile(chatId: string, text: string, file: File): Promise<Message> {
  if (file.size > CHAT_FILE_LIMIT_BYTES) throw new Error('Files must be 1 MB or smaller.')
  if (!CHAT_ATTACHMENT_TYPES.includes(file.type as typeof CHAT_ATTACHMENT_TYPES[number])) {
    throw new Error('This file type is not supported. Choose an image, PDF, text, video, or audio file.')
  }
  const attachmentData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.readAsDataURL(file)
  })
  const payload = { text, attachmentName: file.name, attachmentType: file.type, attachmentData }
  if (await ensureMode()) return request<Message>(`/chats/${encodeURIComponent(chatId)}/messages`, { method: 'POST', body: JSON.stringify(payload) })
  const message: Message = {
    id: crypto.randomUUID(),
    author: 'You',
    avatar: 'Y',
    text,
    time: new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(new Date()),
    own: true,
    createdAt: Date.now(),
    attachmentName: file.name,
    attachmentType: payload.attachmentType,
    attachmentData,
  }
  store.messages[chatId] = [...(store.messages[chatId] ?? []), message]
  store.chats = store.chats.map(chat => chat.id === chatId ? { ...chat, lastMessage: text || `File: ${file.name}`, time: message.time, updatedAt: new Date().toISOString() } : chat)
  save()
  return message
}

export async function updateMessage(chatId: string, messageId: string, text: string): Promise<Message> {
  const updated = text.trim()
  if (!updated) throw new Error('Message cannot be empty.')
  if (await ensureMode()) return request<Message>(`/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`, {
    method: 'PUT',
    body: JSON.stringify({ text: updated }),
  })
  const message = (store.messages[chatId] ?? []).find(item => item.id === messageId && item.own)
  if (!message) throw new Error('Message not found or cannot be edited.')
  message.text = updated
  message.edited = true
  const updatedMessages = store.messages[chatId] ?? []
  const last = updatedMessages[updatedMessages.length - 1]
  if (last?.id === messageId) store.chats = store.chats.map(chat => chat.id === chatId ? { ...chat, lastMessage: updated } : chat)
  save()
  return { ...message }
}

export async function deleteMessage(chatId: string, messageId: string): Promise<void> {
  if (await ensureMode()) {
    await request<void>(`/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' })
    return
  }
  const existing = (store.messages[chatId] ?? []).find(item => item.id === messageId && item.own)
  if (!existing) throw new Error('Message not found or cannot be deleted.')
  store.messages[chatId] = (store.messages[chatId] ?? []).filter(item => item.id !== messageId)
  const remainingMessages = store.messages[chatId] ?? []
  const last = remainingMessages[remainingMessages.length - 1]
  store.chats = store.chats.map(chat => chat.id === chatId
    ? { ...chat, lastMessage: last?.text || (last?.attachmentName ? `File: ${last.attachmentName}` : 'Say hello') }
    : chat)
  save()
}

export async function createChat(name: string, peerId: string): Promise<Chat> {
  if (await ensureMode()) return request<Chat>('/chats', { method: 'POST', body: JSON.stringify({ name, kind: 'dm', peerId }) })
  const chat: Chat = { id: crypto.randomUUID(), name, avatar: name.charAt(0).toUpperCase(), accent: 'violet', lastMessage: 'Say hello', time: 'now', kind: 'dm', peerId }
  store.chats = [chat, ...store.chats]
  store.messages[chat.id] = []
  save()
  return chat
}

export async function getOrCreateSelfChat(): Promise<Chat> {
  if (await ensureMode()) return request<Chat>('/chats/self', { method: 'POST' })
  const existing = store.chats.find(chat => chat.kind === 'self')
  if (existing) return existing
  const chat: Chat = { id: 'my-chat', name: 'My Chat', avatar: 'N', accent: 'green', lastMessage: 'Private notes and files', time: 'now', kind: 'self', pinned: true }
  store.chats = [chat, ...store.chats]
  store.messages[chat.id] = []
  save()
  return chat
}

export async function createSelfChat(name: string): Promise<Chat> {
  const title = name.trim()
  if (!title) throw new Error('Choose a name for your private chat.')
  if (await ensureMode()) return request<Chat>('/chats/self/named', { method: 'POST', body: JSON.stringify({ name: title }) })
  const chat: Chat = {
    id: crypto.randomUUID(),
    name: title,
    avatar: title.slice(0, 1).toUpperCase(),
    accent: 'green',
    lastMessage: 'Private notes and files',
    time: 'now',
    kind: 'self',
  }
  store.chats = [chat, ...store.chats]
  store.messages[chat.id] = []
  save()
  return chat
}

export async function readChat(chatId: string): Promise<void> {
  if (await ensureMode()) { await request<Chat>(`/chats/${encodeURIComponent(chatId)}/read`, { method: 'POST' }); return }
  store.chats = store.chats.map(chat => chat.id === chatId ? { ...chat, unread: 0 } : chat)
  save()
}

export function isDemoMode() { return serverMode === 'offline' }

/** Allows the next listChats call to probe the API again after a transient outage. */
export function retryChatConnection() {
  if (serverMode === 'offline') serverMode = 'unknown'
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (serverMode === 'offline') serverMode = 'unknown'
  })
}
