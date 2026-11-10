import { copyFile, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(project, 'web-preview', 'dist')
// Deliberate allowlist. Never copy public/ or the workspace wholesale.
for (const asset of ['favicon.svg']) {
  await copyFile(path.join(project, 'public', asset), path.join(output, asset))
}
const forbiddenName = /(^|\/)(\.env(?:\..*)?|node_modules|backend|\.git|\.codex|\.agents|\.vscode|credentials?)(\/|$)|\.(?:map|pem|key|p12|pfx|db|sqlite|sqlite3|jar|java|properties|log|zip)$/i
const sensitiveContent = [
  ['private key', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/],
  ['OpenAI-style credential', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}/],
  ['AWS-style credential', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub-style credential', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],
  ['local user filesystem path', /\/home\/[A-Za-z0-9_.-]+\/|C:\\\\Users\\\\/],
]
async function listFiles(directory, prefix = '') {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name)
    if (entry.isSymbolicLink()) throw new Error('Symlink not allowed in demo: ' + relative)
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), relative))
    else files.push(relative)
  }
  return files
}
const files = await listFiles(output)
const allowed = /^(?:index\.html|favicon\.svg|assets\/[A-Za-z0-9_-]+\.(?:js|css))$/
for (const relative of files) {
  if (!allowed.test(relative) || forbiddenName.test(relative)) throw new Error('Unexpected file in public output: ' + relative)
  if (/\.(?:html|js|css|svg)$/.test(relative)) {
    const content = await readFile(path.join(output, relative), 'utf8')
    for (const [label, pattern] of sensitiveContent) {
      if (pattern.test(content)) throw new Error('Review required: ' + label + ' detected in ' + relative)
    }
  }
}
const htmlPath = path.join(output, 'index.html')
let html = await readFile(htmlPath, 'utf8')
html = html.replace('<title>Nightfall — Developer Community</title>', '<title>Nightfall — Demo Preview</title>')
html = html.replace('content="Nightfall is a developer community for DevOps, programming, technical channels, discussions, and messaging."', 'content="Nightfall demo preview. Contacts and messages are fictional; changes are saved only in the visitor’s browser."')
await writeFile(htmlPath, html)
const inventory = await Promise.all(files.map(async file => ({ file, bytes: (await stat(path.join(output, file))).size })))
console.log(JSON.stringify({ demoOnly: true, sourceMaps: false, copiedPrivateFiles: false, files: inventory }, null, 2))
