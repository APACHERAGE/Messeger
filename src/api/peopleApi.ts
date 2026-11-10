import { browserStorageKey, isPublicPreview } from './runtime'
import { apiRequest } from './http'
import type { GitHubProject } from './profileApi'

export type Relationship = 'none' | 'incoming' | 'outgoing' | 'friends'
export type FriendsState = { friends: Person[]; incoming: Person[]; outgoing: Person[] }

export type Person = { id: string; displayName: string; username: string; email: string; phone: string; avatar: string; accent: string; online: boolean; headline: string; skills: string; githubProjects: GitHubProject[]; firstName?: string; lastName?: string; bio?: string; location?: string; website?: string; status?: string; avatarDataUrl?: string; pronouns?: string; company?: string; timezone?: string; interests?: string; lookingFor?: string; githubUsername?: string; appearance?: Partial<import('./profileApi').Preferences>; canPostToWall?: boolean; isFollowing?: boolean; canViewProfile?: boolean; canMessage?: boolean; canViewWall?: boolean; relationship?: Relationship }

const directory: Person[] = [
  { id: 'mira', displayName: 'Mira K.', username: 'mira.exe', email: 'mira@example.test', phone: '+1 202 555 0101', avatar: 'M', accent: 'pink', online: true, headline: 'Frontend engineer', skills: 'React, TypeScript', githubProjects: [] },
  { id: 'zero', displayName: 'zero_cool', username: 'zero_cool', email: 'zero@example.test', phone: '+1 202 555 0102', avatar: 'Z', accent: 'cyan', online: false, headline: 'Systems developer', skills: 'Linux, Rust', githubProjects: [] },
  { id: 'ilya', displayName: 'Alex R.', username: 'alex_apex', email: 'alex@example.test', phone: '+1 202 555 0103', avatar: 'A', accent: 'orange', online: true, headline: 'Platform engineer', skills: 'Kubernetes, CI/CD', githubProjects: [] },
  { id: 'lena', displayName: 'Lena D.', username: 'lena_dev', email: 'lena@example.test', phone: '+1 202 555 0104', avatar: 'L', accent: 'blue', online: false, headline: 'Backend developer', skills: 'Java, PostgreSQL', githubProjects: [] },
]

let sessionOwner = 'local-demo'
let serverSession = false
export function configurePeopleSession(userId: string, online: boolean) {
  sessionOwner = userId
  serverSession = online && !isPublicPreview
}
const baseKey = browserStorageKey('contacts')
const storageKey = () => `${baseKey}-${sessionOwner}`
type LocalSocial = { contacts: string[]; blocked: string[]; incoming: string[]; outgoing: string[]; friends: string[]; following: string[] }
function readSocial(): LocalSocial {
  const empty: LocalSocial = { contacts: [], blocked: [], incoming: [], outgoing: [], friends: [], following: [] }
  try {
    const saved = localStorage.getItem(storageKey())
    if (!saved) {
      if (sessionOwner === 'local-demo') {
        const legacy: unknown = JSON.parse(localStorage.getItem(baseKey) ?? '[]')
        empty.contacts = Array.isArray(legacy) ? legacy.filter((id): id is string => typeof id === 'string') : []
        const blocked: unknown = JSON.parse(localStorage.getItem(`${baseKey}-blocked`) ?? '[]')
        empty.blocked = Array.isArray(blocked) ? blocked.filter((id): id is string => typeof id === 'string') : []
      }
      return empty
    }
    const raw = JSON.parse(saved) as Record<string, unknown>
    for (const key of Object.keys(empty) as (keyof LocalSocial)[]) {
      if (Array.isArray(raw[key])) empty[key] = (raw[key] as unknown[]).filter((id): id is string => typeof id === 'string')
    }
  } catch { /* Invalid local social data does not grant relationships or access. */ }
  return empty
}
function writeSocial(state: LocalSocial) { localStorage.setItem(storageKey(), JSON.stringify(state)) }
function localPerson(id: string, state = readSocial()): Person {
  const person = directory.find(item => item.id === id)
  if (!person) throw new Error('Person not found')
  const blocked = state.blocked.includes(id)
  const relationship: Relationship = blocked ? 'none' : state.friends.includes(id) ? 'friends' : state.incoming.includes(id) ? 'incoming' : state.outgoing.includes(id) ? 'outgoing' : 'none'
  return { ...person, canViewProfile: !blocked, canMessage: !blocked, canViewWall: !blocked && relationship === 'friends', canPostToWall: !blocked && relationship === 'friends', isFollowing: !blocked && state.following.includes(id), relationship }
}

function normalized(value: string) { return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') }
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return apiRequest<T>(path, { ...init, signal: init?.signal ?? AbortSignal.timeout(5000) })
}

export async function searchPeople(query: string): Promise<Person[]> {
  if (serverSession) return api<Person[]>(`/people?query=${encodeURIComponent(query.trim())}`)
  const needle = normalized(query.trim())
  if (!needle) return directory.map(person => localPerson(person.id))
  return directory.filter(person => [person.displayName, person.username, person.email, person.phone].some(value => normalized(value).includes(needle))).map(person => localPerson(person.id))
}

export async function listContacts(): Promise<Person[]> {
  if (serverSession) return api<Person[]>('/contacts')
  const state = readSocial()
  return directory.filter(person => state.contacts.includes(person.id)).map(person => localPerson(person.id,state))
}

export async function addContact(personId: string): Promise<Person> {
  if (serverSession) return api<Person>(`/contacts/${encodeURIComponent(personId)}`, { method: 'POST' })
  const person = localPerson(personId)
  const state = readSocial()
  state.contacts = [...new Set([...state.contacts,personId])]
  writeSocial(state)
  return person
}

export async function removeContact(personId: string): Promise<void> {
  if (serverSession) { await api<Person[]>(`/contacts/${encodeURIComponent(personId)}`, { method: 'DELETE' }); return }
  const state = readSocial(); state.contacts = state.contacts.filter(id => id !== personId); writeSocial(state)
}

export async function listBlockedPeople(): Promise<string[]> {
  if (serverSession) return api<string[]>('/people/blocked')
  return [...readSocial().blocked]
}

export async function blockPerson(personId: string): Promise<void> {
  if (serverSession) {
    await api<void>(`/people/${encodeURIComponent(personId)}/block`, { method: 'POST' })
    return
  }
  const state = readSocial(); state.blocked = [...new Set([...state.blocked,personId])]; state.friends = state.friends.filter(id => id !== personId); state.incoming = state.incoming.filter(id => id !== personId); state.outgoing = state.outgoing.filter(id => id !== personId); state.following = state.following.filter(id => id !== personId); writeSocial(state)
}

export async function unblockPerson(personId: string): Promise<void> {
  if (serverSession) {
    await api<void>(`/people/${encodeURIComponent(personId)}/block`, { method: 'DELETE' })
    return
  }
  const state = readSocial(); state.blocked = state.blocked.filter(id => id !== personId); writeSocial(state)
}

export async function reportPerson(personId: string, reason: string): Promise<void> {
  if (!serverSession) throw new Error('Reporting requires a signed-in server account.')
  await api<void>(`/people/${encodeURIComponent(personId)}/report`, { method: 'POST', body: JSON.stringify({ reason }) })
}

export async function getPerson(personId: string): Promise<Person> {
  return serverSession ? api<Person>(`people/${encodeURIComponent(personId)}`) : localPerson(personId)
}
export async function listFriends(): Promise<FriendsState> {
  if (serverSession) return api<FriendsState>('friends')
  const state=readSocial()
  const people = (ids: string[]) => ids.filter(id => !state.blocked.includes(id) && directory.some(person => person.id === id)).map(id => localPerson(id,state))
  return { friends: people(state.friends), incoming: people(state.incoming), outgoing: people(state.outgoing) }
}
export async function requestFriend(personId: string): Promise<FriendsState> {
  if (serverSession) return api<FriendsState>(`friends/requests/${encodeURIComponent(personId)}`, { method: 'POST' })
  const person=localPerson(personId); const state=readSocial()
  if (person.canMessage === false) throw new Error('This account is blocked.')
  if (person.relationship === 'none') { state.outgoing.push(personId); writeSocial(state) }
  return listFriends()
}
export async function acceptFriend(personId: string): Promise<FriendsState> {
  if (serverSession) return api<FriendsState>(`friends/requests/${encodeURIComponent(personId)}/accept`, { method: 'POST' })
  const state=readSocial()
  if (!state.incoming.includes(personId) || state.blocked.includes(personId)) throw new Error('No incoming friend request from this person.')
  state.incoming=state.incoming.filter(id => id!==personId); state.friends=[...new Set([...state.friends,personId])]; writeSocial(state)
  return listFriends()
}
export async function dismissFriendRequest(personId: string): Promise<FriendsState> {
  if (serverSession) return api<FriendsState>(`friends/requests/${encodeURIComponent(personId)}`, { method: 'DELETE' })
  const state=readSocial(); state.incoming=state.incoming.filter(id => id!==personId); state.outgoing=state.outgoing.filter(id => id!==personId); writeSocial(state)
  return listFriends()
}
export async function removeFriend(personId: string): Promise<FriendsState> {
  if (serverSession) return api<FriendsState>(`friends/${encodeURIComponent(personId)}`, { method: 'DELETE' })
  const state=readSocial(); state.friends=state.friends.filter(id => id!==personId); writeSocial(state)
  return listFriends()
}

export async function listFollowing(): Promise<Person[]> {
 if(serverSession)return api<Person[]>('following')
 const state=readSocial();return state.following.filter(id=>!state.blocked.includes(id)).map(id=>localPerson(id,state))
}
export async function followPerson(id:string):Promise<Person[]> {
 if(serverSession)return api<Person[]>(`people/${encodeURIComponent(id)}/follow`,{method:'POST'})
 const state=readSocial();if(state.blocked.includes(id))throw new Error('This account is blocked.');localPerson(id,state);state.following=[...new Set([...state.following,id])];writeSocial(state);return listFollowing()
}
export async function unfollowPerson(id:string):Promise<Person[]> {
 if(serverSession)return api<Person[]>(`people/${encodeURIComponent(id)}/follow`,{method:'DELETE'})
 const state=readSocial();state.following=state.following.filter(item=>item!==id);writeSocial(state);return listFollowing()
}
