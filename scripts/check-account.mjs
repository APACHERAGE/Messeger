import assert from 'node:assert/strict'
import { build } from 'rolldown'
import { createRequire, Module } from 'node:module'
import { resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(root, 'package.json'))
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const storage = new Map()
let demo = true, storageFull = false, apiFails = false, serverProfile
const localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => { if (storageFull) throw new Error('QuotaExceededError'); storage.set(key, value) },
}
globalThis.localStorage = localStorage
globalThis.__accountTest = {
  isDemoMode: () => demo, listChats: async () => [],
  browserStorageKey: feature => `nightfall-${feature}-v1`,
  apiRequest: async (path, init) => {
    if (apiFails) throw new Error('API unavailable')
    if (init?.body) serverProfile = JSON.parse(init.body)
    return serverProfile
  },
}
const result = await build({
  input: 'account-test-entry', cwd: root, external: ['react', 'react/jsx-runtime', 'lucide-react'],
  plugins: [{ name: 'account-test-environment', resolveId(source) {
    if (source === 'account-test-entry') return '\0entry'
    if (source.endsWith('.css')) return '\0css'
    if (/^\.\/(?:api\/)?(?:chatApi|runtime|http)$/.test(source)) return `\0mock:${source}`
  }, load(id) {
    if (id === '\0css') return 'export default new Proxy({}, {get: (_, key) => key})'
    if (id === '\0entry') return `export * from ${JSON.stringify(resolve(root, 'src/api/profileApi.ts'))}; export * from ${JSON.stringify(resolve(root, 'src/preferences.ts'))}; export {default as Overview} from ${JSON.stringify(resolve(root, 'src/ProfileOverview.tsx'))}; export {default as Account} from ${JSON.stringify(resolve(root, 'src/AccountPanel.tsx'))};`
    if (id.startsWith('\0mock:')) return `export const isDemoMode = globalThis.__accountTest.isDemoMode; export const listChats = globalThis.__accountTest.listChats; export const browserStorageKey = globalThis.__accountTest.browserStorageKey; export const apiRequest = globalThis.__accountTest.apiRequest; export const isPublicPreview = false;`
  } }], output: { format: 'cjs' },
})
const mod = new Module(resolve(root, 'account-test.cjs'))
mod.filename = resolve(root, 'account-test.cjs')
mod.paths = Module._nodeModulePaths(root)
mod._compile(result.output.find(item => item.type === 'chunk').code, mod.filename)
const api = mod.exports
const { normalizeProfile, loadProfile, saveProfile, isQuietTime, safeWebsite } = api
const migrated = normalizeProfile({ displayName: 'Legacy', skills: null, visibility: { bio: false }, preferences: { fontSize: 'huge', quietStart: '25:90' }, githubProjects: [null, 5, { name: 'bad' }] })
assert.equal(migrated.skills, '')
assert.equal(migrated.visibility.bio, false)
assert.equal(migrated.visibility.website, true)
assert.equal(migrated.preferences.fontSize, 'medium')
assert.equal(migrated.preferences.quietStart, '22:00')
assert.deepEqual(migrated.githubProjects, [])
assert.equal(safeWebsite('javascript:alert(1)'), undefined)
assert.equal(safeWebsite('data:text/html,bad'), undefined)
assert.equal(safeWebsite('https://example.test'), 'https://example.test/')
const quiet = { ...api.defaultPreferences, quietHours: true }
const at = (h, m = 0) => new Date(2026, 10, 10, h, m)
assert.equal(isQuietTime(quiet, at(23)), true)
assert.equal(isQuietTime(quiet, at(7, 59)), true)
assert.equal(isQuietTime(quiet, at(8)), false)
assert.equal(isQuietTime(quiet, at(21, 59)), false)
assert.equal(isQuietTime({ ...quiet, quietStart: '10:00', quietEnd: '12:00' }, at(11)), true)
assert.equal(isQuietTime({ ...quiet, quietStart: '10:00', quietEnd: '10:00' }, at(15)), true)

storage.set('nightfall-profile-v1', JSON.stringify({ displayName: 'Legacy local' }))
assert.equal((await loadProfile()).displayName, 'Legacy local')
const profile = normalizeProfile({ displayName: 'Alice', username: 'alice', bio: 'PRIVATE BIO SENTINEL', firstName: 'PRIVATE FIRST', lastName: 'PRIVATE LAST', skills: 'TypeScript, React', location: 'PRIVATE PLACE', website: 'https://private.test', visibility: { bio: false, firstName: false, lastName: false, location: false, website: false } })
await saveProfile(profile)
assert.equal((await loadProfile()).visibility.bio, false)
serverProfile = normalizeProfile({ displayName: 'Bob' }); assert.equal((await loadProfile('account-b')).displayName, 'Bob')
serverProfile = normalizeProfile({ displayName: 'Bob' }); await saveProfile(serverProfile)
assert.equal((await loadProfile()).displayName, 'Alice')
storageFull = true
await assert.rejects(saveProfile(profile), /storage is full/)
storageFull = false

demo = false; serverProfile = normalizeProfile({ displayName: 'Server Alice' })
assert.equal((await loadProfile('server-a')).displayName, 'Server Alice')
apiFails = true
await assert.rejects(loadProfile('server-b'), /API unavailable/)
apiFails = false; storageFull = true
assert.equal((await saveProfile(serverProfile)).displayName, 'Server Alice')
storageFull = false

const Overview = api.Overview
const hiddenHtml = renderToStaticMarkup(React.createElement(Overview, { profile }))
for (const secret of ['PRIVATE BIO', 'PRIVATE FIRST', 'PRIVATE LAST', 'PRIVATE PLACE', 'private.test']) assert(!hiddenHtml.includes(secret), `Hidden field leaked: ${secret}`)
assert(hiddenHtml.includes('Alice') && hiddenHtml.includes('@alice') && hiddenHtml.includes('TypeScript'))
assert(!hiddenHtml.includes('Edit profile'), 'Other people must not see owner controls')
const visibleHtml = renderToStaticMarkup(React.createElement(Overview, { profile: { ...profile, visibility: { ...api.defaultVisibility } } }))
assert(visibleHtml.includes('PRIVATE BIO SENTINEL'))
const Account = api.Account
const props = { profile, onClose() {}, onSave: async () => {}, onTabChange() {}, onClearDrafts() {}, onDirtyChange() {} }
const overviewHtml = renderToStaticMarkup(React.createElement(Account, props))
assert(overviewHtml.includes('Your profile'))
assert(!overviewHtml.includes('What does it do?'), 'Default profile should not be a long editor')
const settingsHtml = renderToStaticMarkup(React.createElement(Account, { ...props, initialTab: 'preferences' }))
for (const category of ['Profile visibility', 'Privacy', 'Notifications', 'Chats', 'Appearance', 'Accessibility', 'Data &amp; Storage', 'Account']) assert(settingsHtml.includes(category))
assert(settingsHtml.includes('Search settings'))
assert.equal((settingsHtml.match(/role="switch"/g) ?? []).length, Object.keys(api.defaultVisibility).length)
console.log('Account checks passed: migration, account cache isolation, persistence failures, quiet hours, safe links, hidden-field rendering, profile overview, and settings navigation.')

const notifications = normalizeProfile({ username: 'alice', preferences: { mentionsOnly: true, notifyGroups: false } })
assert.equal(api.shouldAlert(notifications, 'dm', 'hello @alice'), true)
assert.equal(api.shouldAlert(notifications, 'dm', 'hello'), false)
assert.equal(api.shouldAlert(notifications, 'group', 'hello @alice'), false)
assert.equal(api.shouldAlert(notifications, 'self', '@alice note'), false)
const conversations = [
  { id: 'older', name: 'Zulu', updatedAt: '2026-11-09T12:00:00Z', unread: 2 },
  { id: 'newer', name: 'Alpha', updatedAt: '2026-11-10T12:00:00Z', unread: 0 },
  { id: 'pinned', name: 'Pinned', pinned: true },
]
assert.deepEqual(api.sortConversations(conversations, 'recent').map(c => c.id), ['pinned', 'newer', 'older'])
assert.deepEqual(api.sortConversations(conversations, 'unread').map(c => c.id), ['pinned', 'older', 'newer'])
assert.deepEqual(api.sortConversations(conversations, 'name').map(c => c.id), ['pinned', 'newer', 'older'])
console.log('Message preference checks passed: notification filtering and pinned/recent/unread/name sorting.')
