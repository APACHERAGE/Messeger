import assert from 'node:assert/strict'
import { build } from 'rolldown'
import { createRequire, Module } from 'node:module'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(root, 'package.json'))

// Minimal browser surface used by the API layer.
const storage = new Map()
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
}
const events = []
globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: event => { events.push(event.type); return true },
}

const requests = []
let handler = async () => { throw new TypeError('network down') }
globalThis.fetch = async (url, init = {}) => {
  requests.push({ url: String(url), method: init.method ?? 'GET', headers: new Headers(init.headers), body: init.body })
  return handler(String(url), init)
}

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

const result = await build({
  input: 'api-test-entry',
  cwd: root,
  external: ['react', 'react/jsx-runtime', 'lucide-react'],
  plugins: [{
    name: 'api-test-environment',
    resolveId(source) {
      if (source === 'api-test-entry') return '\0entry'
      if (source.endsWith('.css')) return '\0css'
      if (source === './runtime' || source === '../api/runtime') return '\0mock:runtime'
    },
    load(id) {
      if (id === '\0css') return 'export default new Proxy({}, { get: (_, key) => key })'
      if (id === '\0entry') {
        return `export * from ${JSON.stringify(resolve(root, 'src/api/chatApi.ts'))};
          export * from ${JSON.stringify(resolve(root, 'src/api/mailApi.ts'))};`
      }
      if (id === '\0mock:runtime') {
        return `export const isPublicPreview = false;
          export function browserStorageKey(feature){ return 'nightfall-' + feature; }`
      }
    },
  }],
  output: { format: 'cjs' },
})
const mod = new Module(resolve(root, 'api-test.cjs'))
mod.filename = resolve(root, 'api-test.cjs')
mod.paths = Module._nodeModulePaths(root)
mod._compile(result.output.find(item => item.type === 'chunk').code, mod.filename)
const api = mod.exports

// --- chatApi: server probe falls back to the local demo store -----------------
let chats = await api.listChats()
assert.equal(api.isDemoMode(), true, 'a network failure switches chat to demo mode')
assert.ok(Array.isArray(chats) && chats.length > 0, 'demo chats are available offline')

// Reconnect: the next probe succeeds and server data wins.
api.retryChatConnection()
handler = async url => {
  if (url.endsWith('/api/chats')) return jsonResponse([{ id: 'server-chat', name: 'Server', avatar: 'S', accent: 'violet', lastMessage: 'hi', time: 'now', kind: 'dm' }])
  return jsonResponse([])
}
chats = await api.listChats()
assert.equal(api.isDemoMode(), false, 'a successful probe switches chat back to server mode')
assert.equal(chats[0].id, 'server-chat')

// Pagination clamps the limit and forwards the cursor.
requests.length = 0
await api.listMessages('chat 1', { limit: 500, before: 1234 })
const pageRequest = requests.find(item => item.url.includes('/messages'))
assert.ok(pageRequest, 'messages request was made')
assert.match(pageRequest.url, /\/api\/chats\/chat%201\/messages\?limit=100&before=1234$/)

// A 401 surfaces as ApiRequestError and asks the app to sign in again.
handler = async () => jsonResponse({ message: 'Unauthorized' }, 401)
await assert.rejects(api.listMessages('chat 1'), error => error.status === 401)
assert.ok(events.includes('nightfall:auth-required'), '401 emits the auth-required event')

// Attachments are rejected before any network call.
handler = async () => jsonResponse([])
const tooBig = new File([new Uint8Array(1_000_001)], 'big.png', { type: 'image/png' })
await assert.rejects(api.postMessageWithFile('chat 1', '', tooBig), /1 MB/)
const badType = new File(['<svg/>'], 'art.svg', { type: 'image/svg+xml' })
await assert.rejects(api.postMessageWithFile('chat 1', '', badType), /not supported/)

// --- mailApi: server contract ------------------------------------------------
handler = async (url, init = {}) => {
  if (url.endsWith('/api/health')) return jsonResponse({ status: 'ok' })
  if (url.endsWith('/api/auth/csrf')) return jsonResponse({ headerName: 'X-CSRF-TOKEN', token: 'csrf-test' })
  if (url.endsWith('/api/mail/mailboxes') && (init.method ?? 'GET') === 'GET') {
    return jsonResponse([{ id: 'u1', label: 'Nightfall Mail', address: 'night@nf.com', type: 'site', createdAt: '2026-01-01T00:00:00Z' }])
  }
  if (url.endsWith('/api/mail/mailboxes') && init.method === 'POST') {
    return jsonResponse({ id: 'u1', label: 'Nightfall Mail', address: 'night@nf.com', type: 'site', createdAt: '2026-01-01T00:00:00Z' }, 201)
  }
  if (url.includes('/api/mail/inbox')) return jsonResponse([])
  return jsonResponse({ message: 'unexpected' }, 500)
}

const mailboxes = await api.getMailboxes()
assert.equal(mailboxes[0].address, 'night@nf.com', 'server mailboxes come from the API')
assert.equal(api.isLocalMailMode(), false)

requests.length = 0
const account = await api.registerMailbox('Nightfall Mail', 'night@nf.com')
assert.equal(account.address, 'night@nf.com')
const mailboxPost = requests.find(item => item.method === 'POST' && item.url.endsWith('/api/mail/mailboxes'))
assert.ok(mailboxPost, 'mailbox registration posts to the API')
assert.equal(mailboxPost.headers.get('X-CSRF-TOKEN'), 'csrf-test', 'unsafe requests carry the CSRF header')

requests.length = 0
await api.listMail('inbox', undefined, { limit: 500, before: '2026-01-01T00:00:00.000Z' })
const inboxRequest = requests.find(item => item.url.includes('/api/mail/inbox'))
assert.ok(inboxRequest, 'inbox request was made')
assert.match(inboxRequest.url, /limit=200/)
assert.match(inboxRequest.url, /before=2026-01-01T00%3A00%3A00.000Z/)

console.log('api tests passed: chat fallback, pagination, auth expiry, attachments, mail server mode and CSRF')
