import type { CSSProperties } from 'react'

export const palettes = [
  ['green','Nightfall','#b2ee97','#3d6b2d'],['sage','Sage','#bed0aa','#526d39'],['forest','Forest','#7ccc91','#28633d'],['emerald','Emerald','#6ee7b7','#087657'],['mint','Mint','#9cf0d0','#176d56'],['teal','Teal','#5eead4','#0f766e'],['turquoise','Turquoise','#67e8d8','#087e78'],['cyan','Cyan','#67e8f9','#0e7490'],['ice','Glacier','#b0e7ff','#28668b'],['sky','Sky','#7dd3fc','#0369a1'],['blue','Blue','#93c5fd','#1d4ed8'],['cobalt','Cobalt','#94a9ff','#3441b8'],['indigo','Indigo','#a5b4fc','#4338ca'],['violet','Violet','#c4b5fd','#6d28d9'],['lavender','Lavender','#ddd0ff','#7650a8'],['purple','Purple','#d8b4fe','#7e22ce'],['orchid','Orchid','#e8b4ef','#913696'],['fuchsia','Fuchsia','#f0abfc','#a21caf'],['magenta','Magenta','#f5a0da','#a32175'],['pink','Pink','#f9a8d4','#be185d'],['rose','Rose','#fda4af','#be123c'],['cherry','Cherry','#ff9fa8','#b9233d'],['red','Red','#fca5a5','#b91c1c'],['coral','Coral','#ffb4a2','#b54430'],['salmon','Salmon','#ffc0ad','#a7452d'],['orange','Orange','#fdba74','#c2410c'],['tangerine','Tangerine','#ffc58a','#a95309'],['peach','Peach','#ffd2af','#92521f'],['amber','Amber','#fcd27b','#936512'],['gold','Gold','#f1d286','#88651e'],['yellow','Sunflower','#fde68a','#856b08'],['lemon','Lemon','#f5f49b','#727015'],['lime','Lime','#d9f99d','#4d7c0f'],['olive','Olive','#d3d9a0','#656b2a'],['sand','Sand','#e7d6b2','#786039'],['copper','Copper','#e8b49b','#895437'],['terracotta','Terracotta','#dda990','#8a4e36'],['slate','Slate','#cbd5e1','#475569'],['silver','Silver','#d9dce2','#555c67'],['mono','Monochrome','#e6e6e6','#333333'],
] as const
export type PaletteId = typeof palettes[number][0] | 'custom'
export const paletteIds = palettes.map(item => item[0])
export const coverOptions = ['forest','terminal','orbit','plain'] as const
export function resolveTheme(theme: string, systemDark: boolean): 'dark' | 'light' { return theme === 'light' || theme === 'system' && !systemDark ? 'light' : 'dark' }
export function luminance(hex:string):number {
 const values=[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4)
 return values[0]*.2126+values[1]*.7152+values[2]*.0722
}
export function contrast(a:string,b:string):number {const l1=luminance(a),l2=luminance(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)}
export function contrastColor(hex:string):string {
 const dark=contrast(hex,'#101510'),white=contrast(hex,'#ffffff')
 if(Math.max(dark,white)>=4.5)return dark>white?'#101510':'#ffffff'
 return '#000000'
}
export function readableAccent(hex:string,theme:'dark'|'light'):string {
 const background=theme==='light'?'#ffffff':'#131f17'
 if(contrast(hex,background)>=4.5)return hex
 const rgb=[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16)),target=theme==='light'?0:255
 for(let step=1;step<=20;step++){
  const next='#'+rgb.map(value=>Math.round(value+(target-value)*step/20).toString(16).padStart(2,'0')).join('')
  if(contrast(next,background)>=4.5)return next
 }
 return theme==='light'?'#333333':'#eeeeee'
}
export function appearanceVariables(preferences: {accent:string;customAccent:string}, theme:'dark'|'light'): CSSProperties {
  const palette=palettes.find(item=>item[0]===preferences.accent)??palettes[0]
  const rawAccent=preferences.accent==='custom' && /^#[0-9a-f]{6}$/i.test(preferences.customAccent)?preferences.customAccent:palette[theme==='dark'?2:3]
  const accent=readableAccent(rawAccent,theme)
  return { '--ui-accent':accent,'--account-accent':accent,'--ui-on-accent':contrastColor(accent),'--account-accent-soft':'color-mix(in srgb, var(--ui-accent) 9%, transparent)','--account-border':'color-mix(in srgb, var(--ui-accent) 22%, var(--ui-border))' } as CSSProperties
}
