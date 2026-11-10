import { apiRequest } from './http'
import { browserStorageKey, isPublicPreview } from './runtime'

export type Mailbox = { address: string }

export type MailboxAccount = {
  id: string
  label: string
  address: string
  type: 'site' | 'external'
  createdAt: string
}

export type MailMessage = {
  id: string
  senderAddress: string
  senderName: string
  recipientAddress: string
  recipientName: string
  subject: string
  body: string
  sentAt: string
}

export type MailFolder = 'inbox' | 'sent'

type LocalMailStore = {
  mailboxes: MailboxAccount[]
  messages: MailMessage[]
}

let serverAvailable: boolean | null = isPublicPreview ? false : null

export function isLocalMailMode() {
  return serverAvailable === false
}

function localStorageKey() {
  return `${browserStorageKey('mail')}-default`
}

function normalizeAddress(address: string) {
  return address.trim().toLowerCase().replace(/\s+/g, '')
}

function readLocalStore(): LocalMailStore {
  const saved = localStorage.getItem(localStorageKey())
  if (!saved) {
    const defaultMailbox: MailboxAccount = {
      id: 'site-mailbox',
      label: 'Nightfall Site',
      address: 'nf@gmail.com',
      type: 'site',
      createdAt: new Date().toISOString(),
    }
    const store: LocalMailStore = { mailboxes: [defaultMailbox], messages: [] }
    localStorage.setItem(localStorageKey(), JSON.stringify(store))
    return store
  }
  try {
    const parsed = JSON.parse(saved) as Partial<LocalMailStore>
    const mailboxes = Array.isArray(parsed.mailboxes) ? parsed.mailboxes.filter(item => !!item?.address) : []
    const messages = Array.isArray(parsed.messages) ? parsed.messages.filter(item => !!item?.id) : []
    if (mailboxes.length === 0) {
      const defaultMailbox: MailboxAccount = {
        id: 'site-mailbox',
        label: 'Nightfall Site',
        address: 'nf@gmail.com',
        type: 'site',
        createdAt: new Date().toISOString(),
      }
      const store = { mailboxes: [defaultMailbox], messages }
      localStorage.setItem(localStorageKey(), JSON.stringify(store))
      return store
    }
    return { mailboxes, messages }
  } catch {
    const store: LocalMailStore = {
      mailboxes: [{
        id: 'site-mailbox',
        label: 'Nightfall Site',
        address: 'nf@gmail.com',
        type: 'site',
        createdAt: new Date().toISOString(),
      }],
      messages: [],
    }
    localStorage.setItem(localStorageKey(), JSON.stringify(store))
    return store
  }
}

function writeLocalStore(store: LocalMailStore) {
  localStorage.setItem(localStorageKey(), JSON.stringify(store))
}

async function useServer(): Promise<boolean> {
  if (serverAvailable !== null) return serverAvailable
  try {
    const response = await fetch('/api/health', { credentials: 'same-origin', signal: AbortSignal.timeout(3000) })
    serverAvailable = response.ok
  } catch {
    serverAvailable = false
  }
  return serverAvailable
}

function resolveMailbox(mailboxAddress?: string): MailboxAccount {
  const store = readLocalStore()
  const address = mailboxAddress ? normalizeAddress(mailboxAddress) : store.mailboxes[0]?.address ?? 'nf@gmail.com'
  const candidate = store.mailboxes.find(item => normalizeAddress(item.address) === normalizeAddress(address))
  if (candidate) return candidate
  const fallback: MailboxAccount = { id: crypto.randomUUID(), label: 'Nightfall Site', address: normalizeAddress(address) || 'nf@gmail.com', type: 'site', createdAt: new Date().toISOString() }
  store.mailboxes = [fallback, ...store.mailboxes]
  writeLocalStore(store)
  return fallback
}

export async function getMailbox(mailboxAddress?: string) {
  if (await useServer()) return apiRequest<Mailbox>(`mail/mailbox`)
  return { address: resolveMailbox(mailboxAddress).address }
}

export async function getMailboxes() {
  if (await useServer()) return apiRequest<MailboxAccount[]>('mail/mailboxes')
  return readLocalStore().mailboxes
}

export async function registerMailbox(label: string, address: string) {
  const cleanAddress = normalizeAddress(address)
  if (!cleanAddress || !cleanAddress.includes('@')) throw new Error('Choose a valid mail address, for example nf@gmail.com.')
  if (await useServer()) return apiRequest<MailboxAccount>('mail/mailboxes', { method: 'POST', body: JSON.stringify({ label, address: cleanAddress }) })
  const store = readLocalStore()
  const existing = store.mailboxes.find(item => normalizeAddress(item.address) === cleanAddress)
  if (existing) return existing
  const mailbox: MailboxAccount = {
    id: crypto.randomUUID(),
    label: label.trim() || 'Attached mailbox',
    address: cleanAddress,
    type: cleanAddress.endsWith('@gmail.com') || cleanAddress.endsWith('@outlook.com') ? 'site' : 'external',
    createdAt: new Date().toISOString(),
  }
  store.mailboxes = [mailbox, ...store.mailboxes]
  writeLocalStore(store)
  return mailbox
}

export async function listMail(folder: MailFolder, mailboxAddress?: string, options: { limit?: number; before?: string } = {}) {
  if (await useServer()) {
    const params = new URLSearchParams()
    params.set('limit', String(Math.max(1, Math.min(options.limit ?? 100, 200))))
    if (options.before) params.set('before', options.before)
    return apiRequest<MailMessage[]>(`mail/${folder}?${params.toString()}`)
  }
  const currentMailbox = resolveMailbox(mailboxAddress)
  const store = readLocalStore()
  const results = store.messages.filter(message => {
    const isInboxMessage = normalizeAddress(message.recipientAddress) === normalizeAddress(currentMailbox.address)
    const isSentMessage = normalizeAddress(message.senderAddress) === normalizeAddress(currentMailbox.address)
    return folder === 'inbox' ? isInboxMessage : isSentMessage
  })
  const before = options.before ? new Date(options.before).getTime() : Number.POSITIVE_INFINITY
  return results
    .filter(message => new Date(message.sentAt).getTime() < before)
    .sort((left, right) => new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime())
    .slice(0, Math.max(1, Math.min(options.limit ?? 100, 200)))
}

export async function sendMail(input: { recipient: string; subject: string; body: string }, mailboxAddress?: string) {
  const cleanRecipient = normalizeAddress(input.recipient)
  const cleanSubject = input.subject.trim() || 'No subject'
  const cleanBody = input.body.trim()
  if (!cleanRecipient || !cleanRecipient.includes('@')) {
    throw new Error('Choose a valid recipient mailbox before sending.')
  }
  if (await useServer()) return apiRequest<MailMessage>('mail', { method: 'POST', body: JSON.stringify({ ...input, recipient: cleanRecipient }) })
  const senderMailbox = resolveMailbox(mailboxAddress)
  const store = readLocalStore()
  const senderAddress = senderMailbox.address
  const createdAt = new Date().toISOString()
  const incoming = {
    id: crypto.randomUUID(),
    senderAddress: senderAddress,
    senderName: senderMailbox.label || 'Nightfall User',
    recipientAddress: cleanRecipient,
    recipientName: 'Recipient',
    subject: cleanSubject,
    body: cleanBody,
    sentAt: createdAt,
  }
  const outgoing = {
    ...incoming,
    recipientAddress: senderAddress,
    recipientName: senderMailbox.label || 'Nightfall User',
    senderAddress: cleanRecipient,
    senderName: 'Recipient',
  }
  store.messages = [incoming, ...store.messages]
  store.messages = [outgoing, ...store.messages]
  const recipientKnown = store.mailboxes.some(item => normalizeAddress(item.address) === cleanRecipient)
  if (!recipientKnown) {
    store.mailboxes = [{ id: crypto.randomUUID(), label: 'Attached mailbox', address: cleanRecipient, type: 'external', createdAt }, ...store.mailboxes]
  }
  writeLocalStore(store)
  return incoming
}
