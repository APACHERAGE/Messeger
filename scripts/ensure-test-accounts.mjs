import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const base = new URL(process.env.NIGHTFALL_BASE_URL || 'http://127.0.0.1:8080')
if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) {
  throw new Error('Test account credentials may only be sent to a local Nightfall server.')
}

const text = await readFile(new URL('../test-accounts.txt', import.meta.url), 'utf8')
const profiles = text.split(/^Profile \d+\s*$/m).slice(1).map(block => {
  const field = name => {
    const value = block.match(new RegExp(`^${name}: (.+)$`, 'm'))?.[1]
    assert(value, `Missing ${name} in test-accounts.txt`)
    return value
  }
  const [firstName, ...lastName] = field('Name').split(' ')
  return { firstName, lastName: lastName.join(' '), username: field('Username'), email: field('Email'), password: field('Password') }
})
assert.equal(profiles.length, 2, 'Expected exactly two test profiles')

const configResponse = await fetch(new URL('/api/auth/config', base))
assert.equal(configResponse.status, 200, 'Nightfall API is unavailable')
const config = await configResponse.json()
assert.equal(config.emailVerificationRequired, false, 'Do not seed test accounts while email verification is required')
const inviteCode = config.inviteRequired
  ? (await readFile(new URL('../.share/invite-code', import.meta.url), 'utf8')).trim()
  : ''

for (const profile of profiles) {
  const cookies = new Map()
  function remember(response) {
    for (const header of response.headers.getSetCookie()) {
      const [name, value] = header.split(';', 1)[0].split('=', 2)
      if (name && value) cookies.set(name, value)
    }
  }
  function cookieHeader() {
    return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ')
  }
  async function post(path, body) {
    const csrfResponse = await fetch(new URL('/api/auth/csrf', base), { headers: { Cookie: cookieHeader() } })
    assert.equal(csrfResponse.status, 200, 'Could not get a CSRF token')
    remember(csrfResponse)
    const csrf = await csrfResponse.json()
    const response = await fetch(new URL(path, base), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(), [csrf.headerName]: csrf.token },
      body: JSON.stringify(body),
    })
    remember(response)
    return response
  }

  let login = await post('/api/auth/login', { identifier: profile.username, password: profile.password })
  if (login.status !== 200) {
    const registration = await post('/api/auth/register', {
      firstName: profile.firstName, lastName: profile.lastName, username: profile.username,
      email: profile.email, password: profile.password, confirmPassword: profile.password, inviteCode,
    })
    assert.equal(registration.status, 202, `Registration failed for ${profile.username}: HTTP ${registration.status}`)
    login = await post('/api/auth/login', { identifier: profile.username, password: profile.password })
  }
  assert.equal(login.status, 200, `Login failed for ${profile.username}: HTTP ${login.status}`)
  assert.equal((await login.json()).authenticated, true, `Login was not authenticated for ${profile.username}`)
  const profileResponse = await fetch(new URL('/api/profile', base), { headers: { Cookie: cookieHeader() } })
  assert.equal(profileResponse.status, 200, `Profile is unavailable for ${profile.username}`)
  assert.equal((await profileResponse.json()).username, profile.username)
  console.log(`${profile.username}: login and profile verified`)
}
