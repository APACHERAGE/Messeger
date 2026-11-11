import assert from 'node:assert/strict'
import { build } from 'rolldown'
import { createRequire, Module } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { indexedDB } from 'fake-indexeddb'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(root, 'package.json'))
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const saved = new Map()
let quotaExceeded = false
Object.assign(globalThis, { indexedDB, localStorage: {
  getItem: key => saved.get(key) ?? null,
  setItem: (key, value) => { if (quotaExceeded) throw new Error('QuotaExceededError'); saved.set(key, value) },
} })
async function load(preview) {
  const result = await build({ input: 'post-check-entry', cwd: root,
    external: ['react', 'react/jsx-runtime', 'lucide-react'],
    transform: { define: { 'import.meta.env.MODE': JSON.stringify(preview ? 'demo-preview' : 'test') } },
    plugins: [{ name: 'post-check-entry', resolveId(id) { if (id === 'post-check-entry') return '\0post-entry'; if (id.endsWith('.css')) return '\0empty-css' }, load(id) {
      if (id === '\0post-entry') return `export * from ${JSON.stringify(resolve(root, 'src/api/hubApi.ts'))}; export * from ${JSON.stringify(resolve(root, 'src/api/hubMedia.ts'))}; export {apiRequest} from ${JSON.stringify(resolve(root, 'src/api/http.ts'))}; export { default as HubHome } from ${JSON.stringify(resolve(root, 'src/UserWall.tsx'))}; export { default as PostCard } from ${JSON.stringify(resolve(root, 'src/PostCard.tsx'))};`
      if (id === '\0empty-css') return ''
    } }], output: { format: 'cjs' },
  })
  const mod = new Module(resolve(root, 'posts-check.cjs'))
  mod.filename = resolve(root, 'posts-check.cjs'); mod.paths = Module._nodeModulePaths(root)
  mod._compile(result.output.find(item => item.type === 'chunk').code, mod.filename)
  return mod.exports
}
const api = await load(true)
const png = new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')], 'photo.png', { type: 'image/png' })
const gif = new File([Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')], 'moment.gif', { type: 'image/gif' })
const video = new File([await readFile(resolve(root, 'scripts/fixtures/post-sample.mp4'))], 'clip.mp4', { type: 'video/mp4' })
const alice = { id: 'alice', displayName: 'Alice', username: 'alice' }
await api.validatePostFiles([png, gif, video])
await assert.rejects(api.validatePostFiles([png, png, png, png, png]), /up to 4/)
await assert.rejects(api.validatePostFiles([new File(['not a GIF'], 'fake.gif', { type: 'image/gif' })]), /does not match/)
await assert.rejects(api.validatePostFiles([new File(['<svg/>'], 'image.svg', { type: 'image/svg+xml' })]), /Choose/)
await assert.rejects(api.validatePostFiles([new File([], 'empty.png', { type: 'image/png' })]), /empty/)
await assert.rejects(api.validatePostFiles([new File([new Uint8Array(api.MAX_IMAGE_BYTES + 1)], 'large.png', { type: 'image/png' })]), /too large/)
await assert.rejects(api.createHubPost('   ', alice), /Add some text/)
const post = await api.createHubPost('A moment for friends', alice, [png, gif, video])
assert.equal(post.attachments.length, 3)
assert.equal((await api.listHubPosts('alice'))[0].attachments[1].type, 'image/gif')
assert.equal((await api.listHubPosts('bob')).length, 0)
const blob = await api.readLocalMedia('alice', post.attachments[2].id)
assert.deepEqual(Buffer.from(await blob.arrayBuffer()), Buffer.from(await video.arrayBuffer()))
await assert.rejects(api.readLocalMedia('bob', post.attachments[2].id), /no longer stored/)
const reloaded = await load(true)
assert.equal((await reloaded.listHubPosts('alice'))[0].attachments[0].name, 'photo.png')
assert.equal((await reloaded.readLocalMedia('alice', post.attachments[0].id)).size, png.size)
assert.equal((await api.updateHubPost(post.id, '', 'alice')).body, '')
assert.equal((await api.toggleHubReaction(post.id, 'alice')).attachments.length, 3)
await api.createHubComment(post.id, 'Nice!', alice)
assert.equal((await api.listHubComments(post.id, 'alice')).length, 1)
await api.deleteHubPost(post.id, 'alice')
assert.equal((await api.listHubPosts('alice')).length, 0)
await assert.rejects(api.readLocalMedia('alice', post.attachments[0].id), /no longer stored/)
const mediaOnly = await api.createHubPost('', alice, [gif])
assert.equal(mediaOnly.body, '')
const before = (await api.listHubPosts('alice')).length
quotaExceeded = true
await assert.rejects(api.createHubPost('Keep my draft', alice, [png]), /draft is kept/)
quotaExceeded = false
assert.equal((await api.listHubPosts('alice')).length, before)
const view = renderToStaticMarkup(React.createElement(api.HubHome, { userId: 'alice', displayName: 'Alice', username: 'alice', onOpenChats() {}, onOpenProfile() {}, onOpenChannels() {}, onOpenThreads() {}, onNotice() {} }))
for (const label of ['Create a post', 'Photo', 'GIF', 'Video', 'Publish post', 'Questions? Open Threads']) assert(view.includes(label), label)
assert(!view.includes('Ask a question or share a solution'))
assert(!view.includes('Describe an issue, bug'))
const card = renderToStaticMarkup(React.createElement(api.PostCard, {
  post: { ...post, id: 'ui-post', attachments: [], comments: 0, likes: 1, liked: true },
  user: alice,
  mode: 'local',
  onChanged() {},
  onDeleted() {},
}))
assert(card.includes('Comments'), 'Post cards expose a visible comments control')
assert(card.includes('aria-controls="hub-comments-ui-post"'), 'Post cards identify the comments region')

const requests = []
globalThis.fetch = async (url, init = {}) => {
  requests.push({ url, init })
  if (url.endsWith('/csrf')) return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'test-csrf' })
  if (url.endsWith('/health')) return Response.json({ status: 'ok' })
  return Response.json({ id: 'server-post', body: '', attachments: [] })
}
const server = await load(false)
await server.createHubPost('', alice, [png, gif, video])
const upload = requests.find(item => item.init.body instanceof FormData)
assert(upload, 'Media upload must use multipart form data')
assert.equal(upload.init.body.getAll('files').length, 3)
assert.equal(upload.init.headers.has('Content-Type'), false, 'Browser must choose its multipart boundary')
assert.equal(upload.init.headers.get('X-CSRF-TOKEN'), 'test-csrf')
await server.createHubPost('Text only still works', alice)
assert(requests.some(item => typeof item.init.body === 'string' && JSON.parse(item.init.body).body === 'Text only still works'))
console.log('Post checks passed: photo/GIF/video validation, media-only posts, IndexedDB persistence/reload/isolation/cleanup, storage failure, reactions/comments/editing, composer copy, multipart CSRF, and text-only compatibility.')
