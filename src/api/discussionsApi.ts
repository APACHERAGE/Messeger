import { apiRequest } from './http'
import { browserStorageKey, isPublicPreview } from './runtime'

export type DiscussionThread = {
  id: string
  title: string
  body: string
  author: string
  username: string
  commentCount: number
  createdAt: string
  updatedAt: string
  tags: string[]
  resolved: boolean
  acceptedAnswerId: string | null
  saved: boolean
}

export type DiscussionComment = {
  id: string
  parentCommentId: string | null
  author: string
  username: string
  body: string
  createdAt: string
}

export type DiscussionDetail = { thread: DiscussionThread; comments: DiscussionComment[] }
export type DiscussionSort = 'active' | 'new'
type LocalThread = DiscussionDetail
type LocalStore = { threads: LocalThread[] }
type DiscussionUser = { id: string; displayName: string; username: string }

let serverAvailable: boolean | null = isPublicPreview ? false : null

function isDiscussionComment(value: unknown): value is DiscussionComment {
  if (!value || typeof value !== 'object') return false
  const comment = value as Record<string, unknown>
  return typeof comment.id === 'string'
    && (comment.parentCommentId === null || typeof comment.parentCommentId === 'string')
    && typeof comment.author === 'string'
    && typeof comment.username === 'string'
    && typeof comment.body === 'string'
    && typeof comment.createdAt === 'string'
}

function normalizeThread(value: unknown): DiscussionThread | null {
  if (!value || typeof value !== 'object') return null
  const thread = value as Record<string, unknown>
  if (typeof thread.id !== 'string'
    || typeof thread.title !== 'string'
    || typeof thread.body !== 'string'
    || typeof thread.author !== 'string'
    || typeof thread.username !== 'string'
    || typeof thread.commentCount !== 'number'
    || typeof thread.createdAt !== 'string'
    || typeof thread.updatedAt !== 'string') return null

  return {
    id: thread.id,
    title: thread.title,
    body: thread.body,
    author: thread.author,
    username: thread.username,
    commentCount: thread.commentCount,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    tags: Array.isArray(thread.tags) ? thread.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    resolved: thread.resolved === true,
    acceptedAnswerId: typeof thread.acceptedAnswerId === 'string' ? thread.acceptedAnswerId : null,
    saved: thread.saved === true,
  }
}

function normalizeLocalThread(value: unknown): LocalThread | null {
  if (!value || typeof value !== 'object') return null
  const detail = value as Record<string, unknown>
  const thread = normalizeThread(detail.thread)
  if (!thread || !Array.isArray(detail.comments) || !detail.comments.every(isDiscussionComment)) return null
  return { thread, comments: detail.comments }
}

export function isLocalDiscussionMode() {
  return serverAvailable === false
}

function storageKey(userId: string) {
  return `${browserStorageKey('discussions')}-${userId}`
}

function readLocalStore(userId: string): LocalStore {
  const saved = localStorage.getItem(storageKey(userId))
  if (!saved) return { threads: [] }
  const parsed: unknown = JSON.parse(saved)
  const record = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
  const threads = record?.threads
  if (!Array.isArray(threads)) throw new Error('Saved local discussions are corrupted.')
  const normalized = threads.map(normalizeLocalThread)
  if (normalized.some(thread => thread === null)) throw new Error('Saved local discussions are corrupted.')
  return { threads: normalized as LocalThread[] }
}

function writeLocalStore(userId: string, store: LocalStore) {
  localStorage.setItem(storageKey(userId), JSON.stringify(store))
}

async function useServer() {
  if (serverAvailable !== null) return serverAvailable
  try {
    const response = await fetch('/api/health', { credentials: 'same-origin', signal: AbortSignal.timeout(3000) })
    serverAvailable = response.ok
  } catch {
    serverAvailable = false
  }
  return serverAvailable
}

export async function listDiscussions(userId: string, query: string, sort: DiscussionSort, tag = '', savedOnly = false) {
  if (await useServer()) {
    const params = new URLSearchParams({ query, sort })
    if (tag) params.set('tag', tag)
    if (savedOnly) params.set('savedOnly', 'true')
    const threads = await apiRequest<unknown[]>(`discussions?${params}`)
    return threads.map(normalizeThread).filter((thread): thread is DiscussionThread => thread !== null)
  }
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const normalizedTag = tag.trim().toLocaleLowerCase()
  return readLocalStore(userId).threads
    .map(({ thread }) => thread)
    .filter(thread => !normalizedQuery || `${thread.title} ${thread.body} ${thread.author} ${thread.username} ${thread.tags.join(' ')}`.toLocaleLowerCase().includes(normalizedQuery))
    .filter(thread => !normalizedTag || thread.tags.some(item => item.toLocaleLowerCase() === normalizedTag))
    .filter(thread => !savedOnly || thread.saved)
    .sort(sort === 'active'
      ? (left, right) => right.commentCount - left.commentCount || Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
      : (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
}

export async function getDiscussion(id: string, userId: string) {
  if (await useServer()) {
    const detail = await apiRequest<unknown>(`discussions/${encodeURIComponent(id)}`)
    if (!detail || typeof detail !== 'object') throw new Error('Thread response was invalid.')
    const result = detail as Record<string, unknown>
    const thread = normalizeThread(result.thread)
    if (!thread || !Array.isArray(result.comments) || !result.comments.every(isDiscussionComment)) {
      throw new Error('Thread response was invalid.')
    }
    return { thread, comments: result.comments }
  }
  const found = readLocalStore(userId).threads.find(item => item.thread.id === id)
  if (!found) throw new Error('Thread not found.')
  return found
}

export async function createDiscussion(input: { title: string; body: string; tags: string[] }, user: DiscussionUser) {
  if (await useServer()) {
    const created = await apiRequest<unknown>('discussions', { method: 'POST', body: JSON.stringify(input) })
    const thread = normalizeThread(created)
    if (!thread) throw new Error('Thread response was invalid.')
    return thread
  }
  const store = readLocalStore(user.id)
  const now = new Date().toISOString()
  const thread: DiscussionThread = {
    id: crypto.randomUUID(),
    ...input,
    author: user.displayName,
    username: user.username,
    commentCount: 0,
    createdAt: now,
    updatedAt: now,
    resolved: false,
    acceptedAnswerId: null,
    saved: false,
  }
  store.threads = [{ thread, comments: [] }, ...store.threads]
  writeLocalStore(user.id, store)
  return thread
}

export async function addDiscussionComment(
  threadId: string,
  input: { body: string; parentCommentId: string | null },
  user: DiscussionUser,
) {
  if (await useServer()) {
    return apiRequest<DiscussionComment>(`discussions/${encodeURIComponent(threadId)}/comments`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }
  const store = readLocalStore(user.id)
  const detail = store.threads.find(item => item.thread.id === threadId)
  if (!detail) throw new Error('Thread not found.')
  if (input.parentCommentId && !detail.comments.some(comment => comment.id === input.parentCommentId)) {
    throw new Error('Reply target not found.')
  }
  const comment: DiscussionComment = {
    id: crypto.randomUUID(),
    parentCommentId: input.parentCommentId,
    author: user.displayName,
    username: user.username,
    body: input.body,
    createdAt: new Date().toISOString(),
  }
  detail.comments.push(comment)
  detail.thread.commentCount = detail.comments.length
  detail.thread.updatedAt = comment.createdAt
  writeLocalStore(user.id, store)
  return comment
}

export async function setDiscussionSaved(threadId: string, userId: string, saved: boolean) {
  if (await useServer()) {
    await apiRequest<void>(`discussions/${encodeURIComponent(threadId)}/bookmark`, { method: saved ? 'PUT' : 'DELETE' })
  } else {
    const store = readLocalStore(userId)
    const detail = store.threads.find(item => item.thread.id === threadId)
    if (!detail) throw new Error('Thread not found.')
    detail.thread.saved = saved
    writeLocalStore(userId, store)
  }
  return saved
}

export async function setDiscussionResolved(threadId: string, user: DiscussionUser, resolved: boolean) {
  if (await useServer()) {
    return apiRequest<DiscussionThread>(`discussions/${encodeURIComponent(threadId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ resolved }),
    })
  }
  const store = readLocalStore(user.id)
  const detail = store.threads.find(item => item.thread.id === threadId)
  if (!detail) throw new Error('Thread not found.')
  if (detail.thread.username !== user.username) throw new Error('Only the discussion author can change its status.')
  detail.thread.resolved = resolved
  if (!resolved) detail.thread.acceptedAnswerId = null
  writeLocalStore(user.id, store)
  return detail.thread
}

export async function setAcceptedAnswer(threadId: string, commentId: string | null, user: DiscussionUser) {
  if (await useServer()) {
    return apiRequest<DiscussionThread>(`discussions/${encodeURIComponent(threadId)}/accepted-answer`, {
      method: 'PUT',
      body: JSON.stringify({ commentId }),
    })
  }
  const store = readLocalStore(user.id)
  const detail = store.threads.find(item => item.thread.id === threadId)
  if (!detail) throw new Error('Thread not found.')
  if (detail.thread.username !== user.username) throw new Error('Only the discussion author can choose an accepted answer.')
  if (commentId && !detail.comments.some(comment => comment.id === commentId)) throw new Error('Answer must belong to this discussion.')
  detail.thread.acceptedAnswerId = commentId
  if (commentId) detail.thread.resolved = true
  writeLocalStore(user.id, store)
  return detail.thread
}
