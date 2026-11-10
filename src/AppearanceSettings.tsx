import { useState } from 'react'
import { Check, Monitor, Moon, Search, Sun } from 'lucide-react'
import { appearanceVariables, palettes, resolveTheme } from './appearance'
import { PixelArt, pixelArtCatalog,pixelArtLicense } from './PixelArt'
import type { Preferences } from './api/profileApi'
import './appearance.css'

type Props={preferences:Preferences;onChange:(preferences:Preferences)=>void}
export default function AppearanceSettings({preferences:p,onChange}:Props) {
 const [artOpen,setArtOpen]=useState(false),[query,setQuery]=useState('')
 const change=<K extends keyof Preferences,>(key:K,value:Preferences[K])=>onChange({...p,[key]:value})
 const theme=resolveTheme(p.theme,typeof window!=='undefined'&&window.matchMedia('(prefers-color-scheme: dark)').matches)
 return <div className="appearance-picker">
  <h4>Make yourself at home.</h4><p>Dark by default. Choose the light, colors, and little details that feel like you.</p>
  <div className="theme-options" role="group" aria-label="Color scheme">{[['dark','Dark',Moon],['light','Light',Sun],['system','System',Monitor]].map(([id,label,Icon])=>{const ThemeIcon=Icon as typeof Sun;return <button type="button" key={String(id)} data-preview-theme={String(id)} aria-pressed={p.theme===id} onClick={()=>change('theme',String(id))}><span className="theme-miniature"><i/><i/><i/></span><span><ThemeIcon size={14}/>{String(label)}{p.theme===id&&<Check size={13}/>}</span></button>})}</div>
  <h4>Color palette <small>{palettes.length} colors + custom</small></h4>
  <div className="palette-options" role="group" aria-label="Accent palette">{palettes.map(([id,label,dark,light])=><button type="button" key={id} title={label} aria-label={label} aria-pressed={p.accent===id} style={{'--swatch':theme==='dark'?dark:light} as React.CSSProperties} onClick={()=>change('accent',id)}>{p.accent===id&&<Check size={13}/>}<span>{label}</span></button>)}</div>
  <label className="custom-accent"><span>Your own color</span><input type="color" value={p.customAccent} onChange={event=>onChange({...p,accent:'custom',customAccent:event.target.value})}/><code>{p.customAccent}</code></label>
  <div className="appearance-preview" data-theme={theme} style={appearanceVariables(p,theme)}><span className="appearance-preview-avatar">N</span><div><strong>Nightfall, your way.</strong><small>A small preview of your chosen color.</small></div><button type="button" tabIndex={-1}>Hello there</button></div>
  <label className="preference-row"><span><strong>Profile cover</strong><small>Choose the atmosphere at the top of your Home.</small></span><select value={p.coverStyle} onChange={event=>change('coverStyle',event.target.value)}><option value="forest">Forest</option><option value="terminal">Terminal</option><option value="orbit">Orbit</option><option value="plain">Minimal</option></select></label>
  <label className="preference-row"><span><strong>Profile spacing</strong><small>A relaxed layout or a denser personal page.</small></span><select value={p.profileDensity} onChange={event=>change('profileDensity',event.target.value)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
  <label className="preference-row"><span><strong>Decorative artwork</strong><small>Show your selected artwork in covers and empty states.</small></span><input type="checkbox" role="switch" checked={p.showDecorations} onChange={event=>change('showDecorations',event.target.checked)}/></label>
  <label className="preference-row"><span><strong>Artwork style</strong><small>100 pixel designs, each with an ASCII version.</small></span><select value={p.artMode} onChange={event=>change('artMode',event.target.value)}><option value="pixel">Pixel</option><option value="ascii">ASCII</option><option value="off">Off</option></select></label>
  <button type="button" className="art-library-launch" onClick={()=>setArtOpen(value=>!value)}><PixelArt id={p.artId} size={36}/><span><strong>Pick your little companion</strong><small>{pixelArtCatalog.find(item=>item.id===p.artId)?.name??'Server'} · 100 artworks</small></span><span>{artOpen?'Close':'Browse'}</span></button>
  {artOpen&&<div className="art-library"><label className="settings-search"><Search size={15}/><input aria-label="Search artwork" placeholder="Server, coffee, robot…" value={query} onChange={event=>setQuery(event.target.value)}/></label><div className="art-library-grid">{pixelArtCatalog.filter(item=>`${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase())).map(item=><button key={item.id} type="button" aria-pressed={p.artId===item.id} onClick={()=>change('artId',item.id)} title={item.name}><PixelArt id={item.id} mode={p.artMode==='ascii'?'ascii':'pixel'} size={48}/><span>{item.name}</span></button>)}</div><small>Pixelarticons · MIT · <a href="https://github.com/halfmage/pixelarticons" target="_blank" rel="noreferrer">Source & license</a></small><details><summary>MIT License</summary><pre>{pixelArtLicense.text}</pre></details></div>}
 </div>
}
