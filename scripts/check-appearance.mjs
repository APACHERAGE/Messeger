import assert from 'node:assert/strict'
import { build } from 'rolldown'
import { createRequire,Module } from 'node:module'
import { readFile } from 'node:fs/promises'
import { dirname,resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(resolve(root,'package.json'))
const result=await build({input:'appearance-check',cwd:root,external:['react','react/jsx-runtime','lucide-react'],plugins:[{name:'appearance-check',resolveId(id){if(id==='appearance-check')return '\0entry';if(id.endsWith('.css'))return '\0css'},load(id){if(id==='\0css')return 'export default new Proxy({}, {get:(_,key)=>key})';if(id==='\0entry')return `export * from ${JSON.stringify(resolve(root,'src/appearance.ts'))};export * from ${JSON.stringify(resolve(root,'src/PixelArt.tsx'))};export {default as AppearanceSettings} from ${JSON.stringify(resolve(root,'src/AppearanceSettings.tsx'))};`}}],output:{format:'cjs'}})
const mod=new Module(resolve(root,'appearance-check.cjs'));mod.filename=resolve(root,'appearance-check.cjs');mod.paths=Module._nodeModulePaths(root);mod._compile(result.output.find(item=>item.type==='chunk').code,mod.filename)
const api=mod.exports
assert.equal(api.palettes.length,40)
assert.equal(new Set(api.palettes.map(item=>item[0])).size,40)
assert.equal(api.resolveTheme('system',true),'dark');assert.equal(api.resolveTheme('system',false),'light');assert.equal(api.resolveTheme('dark',false),'dark')
for(const [id] of api.palettes)for(const theme of ['dark','light']){
 const vars=api.appearanceVariables({accent:id,customAccent:'#b2ee97'},theme)
 assert(api.contrast(vars['--ui-accent'],vars['--ui-on-accent'])>=4.5,`${id}/${theme}: button label contrast`)
 assert(api.contrast(vars['--ui-accent'],theme==='light'?'#ffffff':'#131f17')>=4.5,`${id}/${theme}: accent text contrast`)
}
for(const color of ['#000000','#ffffff','#777777','#00ff00','#ff00ff'])for(const theme of ['dark','light']){
 const vars=api.appearanceVariables({accent:'custom',customAccent:color},theme)
 assert(api.contrast(vars['--ui-accent'],vars['--ui-on-accent'])>=4.5)
 assert(api.contrast(vars['--ui-accent'],theme==='light'?'#ffffff':'#131f17')>=4.5)
}
assert.equal(api.pixelArtCatalog.length,100)
assert.equal(new Set(api.pixelArtCatalog.map(item=>item.id)).size,100)
for(const item of api.pixelArtCatalog){assert(item.paths.length>0);assert(item.ascii.includes('#'));assert(item.paths.every(path=>!path.includes('<')))}
assert(api.pixelArtLicense.text.includes('MIT License')&&api.pixelArtLicense.text.includes('Gerrit Halfmann'))
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const preferences={theme:'dark',accent:'green',customAccent:'#b2ee97',coverStyle:'forest',profileDensity:'comfortable',artMode:'pixel',artId:'server',showDecorations:true}
const html=renderToStaticMarkup(React.createElement(api.AppearanceSettings,{preferences,onChange(){}}))
for(const label of ['Dark','Light','System','Color palette','Your own color','Profile cover','100 artworks'])assert(html.includes(label))
assert(renderToStaticMarkup(React.createElement(api.PixelArt,{id:'server',mode:'ascii'})).includes('#'))
const themeCss=await readFile(resolve(root,'src/theme.css'),'utf8')
assert(themeCss.includes(':root[data-theme=light]')&&themeCss.includes('--ui-surface:#ffffff'))
console.log('Appearance checks passed: 40 palettes and custom colors, light/dark/system, accent/label contrast, 100 unique pixel/ASCII artworks, bundled MIT notice, and appearance controls.')
