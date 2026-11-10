import { paletteIds, coverOptions } from '../appearance'
import { browserStorageKey } from './runtime'
import { apiRequest } from './http'

export type GitHubProject = { name: string; url: string; description: string }

export const defaultVisibility = {
  avatar: true, firstName: true, lastName: true, headline: true, bio: true,
  pronouns: true, company: true, timezone: true, interests: true, lookingFor: true, githubUsername: true,
  skills: true, location: true, website: true, githubProjects: true, status: true,
}
export type ProfileVisibility = typeof defaultVisibility

export const defaultPreferences = {
  desktopNotifications: true, notificationPreview: true, notifyDirect: true,
  notifyGroups: true, notifyChannels: true, mentionsOnly: false, inAppNotifications: true,
  quietHours: false, quietStart: '22:00', quietEnd: '08:00',
  theme: 'dark', customAccent: '#b2ee97', coverStyle: 'forest', profileDensity: 'comfortable',
  artMode: 'pixel', artId: 'server', showDecorations: true, defaultPostAudience: 'friends',
  fontSize: 'medium', accent: 'green', chatBackground: 'grid', bubbleStyle: 'rounded',
  showAvatars: true, showTimestamps: true, showReactions: true, showChatTimes: true,
  showOnlineIndicators: true, showComposerHints: true, spellCheck: true,
  confirmDelete: true, sortChats: 'recent', highContrast: false, largeControls: false,
  autoScroll: true,
}
export type Preferences = typeof defaultPreferences

export type Audience = 'everyone' | 'friends' | 'nobody'

export type Profile = {
  pronouns: string
  company: string
  timezone: string
  interests: string
  lookingFor: string
  githubUsername: string
  displayName: string
  firstName: string
  lastName: string
  username: string
  headline: string
  bio: string
  skills: string
  location: string
  website: string
  githubProjects: GitHubProject[]
  status: string
  avatarDataUrl: string
  notifications: boolean
  showOnline: boolean
  compactMode: boolean
  showMessagePreview: boolean
  autoMarkRead: boolean
  sendOnEnter: boolean
  reduceMotion: boolean
  pixelGrid: boolean
  profileAudience: Audience
  wallPostingAudience: 'friends' | 'nobody'
  messageAudience: Audience
  visibility: ProfileVisibility
  preferences: Preferences
}

export const defaultProfile: Profile = {
  pronouns: '',
  company: '',
  timezone: '',
  interests: '',
  lookingFor: '',
  githubUsername: '',
  displayName: 'Nightwalker',
  firstName: '',
  lastName: '',
  username: 'nightwalker',
  headline: 'Developer',
  bio: 'Building after-hours worlds and shipping good vibes.',
  skills: '',
  location: '',
  website: '',
  githubProjects: [],
  status: 'Available',
  avatarDataUrl: '',
  notifications: true,
  showOnline: true,
  compactMode: false,
  showMessagePreview: true,
  autoMarkRead: true,
  sendOnEnter: true,
  reduceMotion: false,
  pixelGrid: true,
  profileAudience: 'everyone',
  wallPostingAudience: 'friends',
  messageAudience: 'everyone',
  visibility: { ...defaultVisibility },
  preferences: { ...defaultPreferences },
}

// Normalize cached and server data, including profiles saved before settings existed.
export function normalizeProfile(value: unknown): Profile {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const result = { ...defaultProfile } as Profile
  for (const key of Object.keys(defaultProfile) as (keyof Profile)[]) {
    if (typeof defaultProfile[key] !== 'object' && typeof raw[key] === typeof defaultProfile[key]) {
      Object.assign(result, { [key]: raw[key] })
    }
  }
  function mergeSettings<T extends object>(defaults: T, saved: unknown): T {
    const source = saved && typeof saved === 'object' ? saved as Record<string, unknown> : {}
    return Object.fromEntries(Object.entries(defaults).map(([key, value]) =>
      [key, typeof source[key] === typeof value ? source[key] : value])) as T
  }
  result.visibility = mergeSettings(defaultVisibility, raw.visibility)
  result.preferences = mergeSettings(defaultPreferences, raw.preferences)
  const options = { fontSize: ['small', 'medium', 'large'], accent: [...paletteIds, 'custom'],
    chatBackground: ['grid', 'plain', 'dots'], bubbleStyle: ['rounded', 'square'], sortChats: ['recent', 'name', 'unread'] }
  for (const [key, choices] of Object.entries(options)) {
    const field = key as keyof typeof options
    if (!choices.includes(result.preferences[field])) result.preferences[field] = defaultPreferences[field]
  }
  const extraOptions={theme:['dark','light','system'],coverStyle:[...coverOptions],profileDensity:['comfortable','compact'],artMode:['pixel','ascii','off'],defaultPostAudience:['friends','public']}
  for(const [key,values] of Object.entries(extraOptions)) { const field=key as keyof typeof extraOptions; if(!(values as readonly string[]).includes(result.preferences[field])) result.preferences[field]=defaultPreferences[field] }
  if(!/^#[0-9a-f]{6}$/i.test(result.preferences.customAccent)) result.preferences.customAccent=defaultPreferences.customAccent
  if(!/^[a-z0-9-]{1,40}$/.test(result.preferences.artId)) result.preferences.artId='server'
  for (const field of ['quietStart', 'quietEnd'] as const) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(result.preferences[field])) result.preferences[field] = defaultPreferences[field]
  }
  for (const key of ['profileAudience', 'messageAudience'] as const) {
    if (!['everyone', 'friends', 'nobody'].includes(result[key])) result[key] = 'everyone'
  }
  if(!['friends','nobody'].includes(result.wallPostingAudience)) result.wallPostingAudience='friends'
  result.githubProjects = Array.isArray(raw.githubProjects) ? raw.githubProjects.filter((p): p is GitHubProject =>
    !!p && typeof p === 'object' && typeof p.name === 'string' && typeof p.url === 'string' && typeof p.description === 'string').slice(0, 6) : []
  return result
}

let owner = 'local-demo'
const keyFor = (id: string) => `${browserStorageKey('profile')}-${id}`

export async function loadProfile(ownerId = 'local-demo'): Promise<Profile> {
  owner = ownerId
  let cached: Profile = normalizeProfile(null)
  try {
    // Only migrate the legacy cache into the local demo, never a signed-in account.
    cached = normalizeProfile(JSON.parse(localStorage.getItem(keyFor(ownerId)) ??
      (ownerId === 'local-demo' ? localStorage.getItem(browserStorageKey('profile')) : null) ?? 'null'))
  } catch { /* Ignore malformed browser data. */ }
  if (ownerId !== 'local-demo') {
    // A failed account request must not silently substitute another account's profile.
    cached = normalizeProfile(await apiRequest<Profile>('profile', { signal: AbortSignal.timeout(5000) }))
  }
  return cached
}

export async function saveProfile(next: Profile): Promise<Profile> {
  const savingOwner = owner
  const local = savingOwner === 'local-demo'
  const normalized = normalizeProfile(next)
  const saved = local ? normalized : normalizeProfile(await apiRequest<Profile>('profile', {
    method: 'PUT', body: JSON.stringify(normalized), signal: AbortSignal.timeout(5000),
  }))
  // The server is authoritative for signed-in accounts; cache failure must not undo its successful save.
  try { localStorage.setItem(keyFor(savingOwner), JSON.stringify(saved)) }
  catch { if (local) throw new Error('Device storage is full or unavailable. Remove a large avatar or free browser storage and try again.') }
  return { ...saved }
}

export function safeWebsite(value: string): string | undefined {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined } catch { return undefined }
}

export function isQuietTime(preferences: Preferences, date = new Date()): boolean {
  if (!preferences.quietHours) return false
  const current = date.getHours() * 60 + date.getMinutes()
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  const start = minutes(preferences.quietStart), end = minutes(preferences.quietEnd)
  return start === end || (start < end ? current >= start && current < end : current >= start || current < end)
}
