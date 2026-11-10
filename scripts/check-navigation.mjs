import assert from 'node:assert/strict'
import { build } from 'rolldown'
import { createRequire, Module } from 'node:module'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { indexedDB } from 'fake-indexeddb'
const rootDir=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(resolve(rootDir,'package.json'))
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://nightfall.test/',pretendToBeVisual:true})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,localStorage:dom.window.localStorage,indexedDB,IS_REACT_ACT_ENVIRONMENT:true})
window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}})
window.HTMLElement.prototype.scrollIntoView=function(){}
window.confirm=()=>true
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client')
const errors=[]
const originalError=console.error
console.error=(...args)=>{errors.push(args.map(String).join(' '));originalError(...args)}
const result=await build({input:'nav-entry',cwd:rootDir,external:['react','react/jsx-runtime','lucide-react','react-dom'],transform:{define:{'import.meta.env.MODE':JSON.stringify('demo-preview')}},plugins:[{name:'entry',resolveId(id){if(id==='nav-entry')return '\0nav-entry';if(id.endsWith('.css'))return '\0css'},load(id){if(id==='\0css')return 'export default new Proxy({}, {get:(_,key)=>key})';if(id==='\0nav-entry')return `export {default as App} from ${JSON.stringify(resolve(rootDir,'src/App.tsx'))};`}}],output:{format:'cjs',codeSplitting:false}})
const mod=new Module(resolve(rootDir,'navigation-check.cjs'));mod.filename=resolve(rootDir,'navigation-check.cjs');mod.paths=Module._nodeModulePaths(rootDir);mod._compile(result.output.find(x=>x.type==='chunk').code,mod.filename)
const fixtures=[{id:'channel-a',title:'Channel Alpha',handle:'alpha',description:'A',ownerId:'local-demo',ownerName:'You',ownerUsername:'local',followers:1,subscribed:true,createdAt:'2026-01-01T00:00:00Z',commentsEnabled:true},{id:'channel-b',title:'Channel Beta',handle:'beta',description:'B',ownerId:'another',ownerName:'Another',ownerUsername:'other',followers:2,subscribed:true,createdAt:'2026-01-02T00:00:00Z',commentsEnabled:true}]
localStorage.setItem('nightfall-public-demo-channels-v1-local-demo',JSON.stringify({channels:fixtures,posts:{'channel-a':[],'channel-b':[]}}))
let renders=0
const appRoot=createRoot(document.getElementById('root'))
async function settle(){for(let i=0;i<4;i++)await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10))})}
async function mount(path='/'){window.history.replaceState(null,'',path);await act(async()=>{appRoot.render(React.createElement(React.StrictMode,null,React.createElement(React.Profiler,{id:'app',onRender(){if(++renders>200)throw Error('Navigation exceeded render limit')}},React.createElement(mod.exports.App))))});await settle()}
async function click(selector){const node=document.querySelector(selector);assert(node,`Missing control ${selector}`);await act(async()=>{node.dispatchEvent(new window.MouseEvent('click',{bubbles:true}))});await settle()}
async function checkPage(label,path,selector){await click(`.rail button[aria-label="${label}"]`);assert.equal(window.location.pathname,path);assert(document.querySelector(selector),`${label} page should render`);const before=renders;await settle();assert.equal(renders,before,`${label} must settle without route updates`)}
try{
 await mount()
 await checkPage('Channels','/channels','.channels-workspace')
 await click('.channel-list-item:nth-child(2)');assert.equal(window.location.pathname,'/channels/beta')
 await checkPage('Home feed','/','[aria-label="Your home and profile"]')
 for(const [label,path,selector] of [['Messages','/messages','.chat-list-panel'],['Contacts','/contacts','.people-page'],['Threads','/threads','.threads-page'],['Mail','/mail','.mail-workspace']]){
  await checkPage('Channels','/channels','.channels-workspace');await click('.channel-list-item:nth-child(2)')
  await checkPage(label,path,selector)
 }
 await checkPage('Channels','/channels','.channels-workspace');await click('.channel-list-item:nth-child(1)')
 await click('.settings-launch');assert.equal(window.location.pathname,'/settings');assert(document.querySelector('[role="dialog"]'))
 await click('.rail button[aria-label="Home feed"]');assert.equal(window.location.pathname,'/')
 await act(async()=>appRoot.unmount())
 assert(!errors.some(e=>/Maximum update depth|Cannot update a component|not wrapped in act/.test(e)),errors.join('\n'))
 console.log(`Navigation checks passed: Channels → Home, messages, contacts, Threads, mail and settings; channel selection; StrictMode; stable renders (${renders} commits).`)
}finally{console.error=originalError;dom.window.close()}
