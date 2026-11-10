export type Chat = {
  id: string
  name: string
  handle?: string
  avatar: string
  accent: string
  lastMessage: string
  time: string
  updatedAt?: string
  unread?: number
  online?: boolean
  kind: 'dm' | 'group' | 'channel' | 'self'
  pinned?: boolean
  peerId?: string
}

export type Message = {
  id: string
  author: string
  avatar: string
  text: string
  time: string
  own?: boolean
  reactions?: string[]
  attachmentName?: string
  attachmentType?: string
  attachmentData?: string
  edited?: boolean
  createdAt?: number
}
