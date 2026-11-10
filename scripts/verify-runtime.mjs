import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const base='http://[::1]:5173'
for(const path of ['/','/profile','/settings','/src/HomePage.tsx','/src/ChannelsView.tsx','/src/ChannelPostItem.tsx','/src/ChannelComments.tsx','/src/ChannelOwnerPanel.tsx','/src/channels.css','/src/GeneralFeed.tsx','/src/PostComposer.tsx','/src/AppearanceSettings.tsx','/src/theme.css','/src/data/pixelArt.json']){
 const response=await fetch(base+path,{signal:AbortSignal.timeout(10000)}),body=await response.text()
 assert.equal(response.status,200,`${path}: HTTP status`)
 assert(!body.includes('vite-error-overlay')&&!body.includes('Internal Server Error'),`${path}: Vite compilation failure`)
 console.log(`${path}: HTTP 200`)
}
const source=await readFile('src/ProfileOverview.tsx','utf8')
const css=await(await fetch(base+'/src/ProfileOverview.module.css',{signal:AbortSignal.timeout(10000)})).text()
const classes=[...new Set([...source.matchAll(/styles\.([A-Za-z]+)/g)].map(match=>match[1]))]
assert.deepEqual(classes.filter(name=>!new RegExp(`export const ${name}\\s*=`).test(css)),[],'Every profile class must be exported by its served CSS module')
const app=await(await fetch(base+'/src/App.tsx',{signal:AbortSignal.timeout(10000)})).text()
assert(app.includes('AccountDialog')&&app.includes('HomePage')&&!app.includes('/src/HubHome.tsx'))
console.log(`Verified live Vite modules and all ${classes.length} profile CSS exports. Browser rendering is a separate check.`)
