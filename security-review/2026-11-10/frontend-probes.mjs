import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { transformWithOxc } from 'vite'

// Actual TS API modules; network and browser storage replaced with local fakes.
const here = path.dirname(fileURLToPath(import.meta.url))
const project = path.resolve(here, '../..')
const scratch = await mkdtemp(path.join(tmpdir(), 'nightfall-frontend-probes-'))
const storage = new Map()
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
}
let profileRequestFails = false
globalThis.fetch = async url => {
  if (url === '/api/chats') return Response.json([])
  if (url === '/api/profile') return profileRequestFails
    ? Response.json({ message: 'Temporary failure for the next user' }, { status: 500 })
    : Response.json({ displayName: 'Previous user', username: 'previous_user', bio: 'Previous user cached profile' })
  if (url === '/api/auth/csrf') return Response.json({ headerName: 'X-XSRF-TOKEN', token: 'local-test-token' })
  if (url === '/api/auth/logout') return new Response(null, { status: 204 })
  throw new Error('Unexpected mocked request: ' + url)
}
try {
  for (const name of ['runtime', 'http', 'chatApi', 'profileApi', 'authApi']) {
    const source = (await readFile(path.join(project, 'src/api', name + '.ts'), 'utf8'))
      .replaceAll('import.meta.env.MODE', '"development"')
    const transformed = await transformWithOxc(source, name + '.ts')
    const output = transformed.code.replace(/from (["'])\.\/([A-Za-z]+)\1/g, 'from "./$2.mjs"')
    await writeFile(path.join(scratch, name + '.mjs'), output)
  }
  const profiles = await import(pathToFileURL(path.join(scratch, 'profileApi.mjs')))
  const auth = await import(pathToFileURL(path.join(scratch, 'authApi.mjs')))
  assert.equal((await profiles.loadProfile()).username, 'previous_user')
  await auth.logoutAccount()
  assert.equal(JSON.parse(storage.get('nightfall-profile-v1')).username, 'previous_user')
  profileRequestFails = true
  assert.equal((await profiles.loadProfile()).username, 'previous_user')
  const result = 'CONFIRMED: logout leaves the profile cache; a failed profile request in the next session returns the previous user profile.\n'
  await writeFile(path.join(here, 'frontend-probe-results.txt'), result)
  console.log(result.trim())
} finally {
  await rm(scratch, { recursive: true, force: true })
}
