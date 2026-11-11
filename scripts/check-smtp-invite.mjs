import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const base = 'http://127.0.0.1:8080'
const recipient = 'apache.desktop@gmail.com'
const text = await readFile(new URL('../test-accounts.txt', import.meta.url), 'utf8')
const username = text.match(/^Username: (.+)$/m)?.[1]
const password = text.match(/^Password: (.+)$/m)?.[1]
assert(username && password, 'First test account credentials are missing')

const configResponse = await fetch(`${base}/api/auth/config`)
assert.equal(configResponse.status, 200, 'Nightfall API is unavailable')
assert.equal((await configResponse.json()).invitationsAvailable, true, 'SMTP invitations are not enabled')

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
  const csrfResponse = await fetch(`${base}/api/auth/csrf`, { headers: { Cookie: cookieHeader() } })
  assert.equal(csrfResponse.status, 200, 'Could not get a CSRF token')
  remember(csrfResponse)
  const csrf = await csrfResponse.json()
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(), [csrf.headerName]: csrf.token },
    body: JSON.stringify(body),
  })
  remember(response)
  return response
}

const login = await post('/api/auth/login', { identifier: username, password })
assert.equal(login.status, 200, `Test account login failed: HTTP ${login.status}`)
assert.equal((await login.json()).authenticated, true)

const invitation = await post('/api/auth/invite', { email: recipient })
assert.equal(invitation.status, 202, `SMTP invitation failed: HTTP ${invitation.status}`)
console.log(`SMTP accepted one Nightfall invitation from ${recipient} to ${recipient}. Check the inbox for final delivery.`)
