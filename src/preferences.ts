import type { Chat } from './types'
import { isQuietTime, type Profile } from './api/profileApi'

export function sortConversations(chats: Chat[], order: string): Chat[] {
  const activity = (chat: Chat) => { const timestamp = Date.parse(chat.updatedAt ?? ''); return Number.isNaN(timestamp) ? 0 : timestamp }
  return [...chats].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) ||
    (order === 'name' ? a.name.localeCompare(b.name) : order === 'unread' ? (b.unread ?? 0) - (a.unread ?? 0) : activity(b) - activity(a)))
}

export function shouldAlert(profile: Profile, kind: Chat['kind'] | undefined, text: string, date = new Date()): boolean {
  const p = profile.preferences
  const category = kind === 'group' ? p.notifyGroups : kind === 'channel' ? p.notifyChannels : kind === 'dm' ? p.notifyDirect : false
  const mention = !!profile.username && text.toLowerCase().includes(`@${profile.username.toLowerCase()}`)
  return category && (!p.mentionsOnly || mention) && !isQuietTime(p, date)
}
