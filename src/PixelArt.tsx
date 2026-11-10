import './pixel-art.css'
import catalog from './data/pixelArt.json'
import license from './data/pixelArtLicense.json'
export { catalog as pixelArtCatalog,license as pixelArtLicense }
export function PixelArt({ id = 'server', mode = 'pixel', size = 64, className = '' }: {id?:string;mode?:string;size?:number;className?:string}) {
  const item=catalog.find(item=>item.id===id)??catalog[0]
  if(mode==='off') return null
  if(mode==='ascii') return <pre className={`pixel-ascii ${className}`} aria-hidden="true" style={{fontSize:size/24,lineHeight:1,margin:0}}>{item.ascii}</pre>
  return <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">{item.paths.map((d,index)=><path key={index} d={d}/>)}</svg>
}
