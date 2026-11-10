import { useEffect, useState } from 'react'
import { ArrowUpRight, Radio, Sparkles } from 'lucide-react'
import { getGeneralFeed, getHubStorageMode, type FeedEntry, type HubPost, type HubStorageMode } from './api/hubApi'
import { safeWebsite } from './api/profileApi'
import PostCard from './PostCard'
import PostComposer from './PostComposer'
import { PixelArt } from './PixelArt'
import './stream.css'

type Props={user:{id:string;displayName:string;username:string};defaultAudience:'friends'|'public';artId:string;artMode:string;onOpenThreads:()=>void;onOpenPerson:(id:string)=>void;onOpenChannel:(id:string)=>void}
export default function GeneralFeed({user,defaultAudience,artId,artMode,onOpenThreads,onOpenPerson,onOpenChannel}:Props){
 const [tab,setTab]=useState<'for-you'|'following'>('for-you'),[entries,setEntries]=useState<FeedEntry[]>([]),[mode,setMode]=useState<HubStorageMode|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0)
 useEffect(()=>{let active=true;setLoading(true);setError('');Promise.all([getGeneralFeed(user.id,tab),getHubStorageMode(user.id)]).then(([items,mode])=>{if(active){setEntries(items);setMode(mode)}}).catch(error=>{if(active)setError(error instanceof Error?error.message:'Could not load your feed.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[user.id,tab,reload])
 const changed=(post:HubPost)=>setEntries(current=>current.map(entry=>entry.post?.id===post.id?{...entry,post}:entry))
 return <section className="general-feed user-wall hub-dashboard" aria-label="General feed"><nav className="general-feed-tabs" aria-label="General feed tabs"><button type="button" aria-pressed={tab==='for-you'} onClick={()=>setTab('for-you')}><Sparkles size={14}/>For you</button><button type="button" aria-pressed={tab==='following'} onClick={()=>setTab('following')}>Following</button></nav>
  <PostComposer user={user} defaultAudience={defaultAudience} local={mode==='local'} onPublished={post=>setEntries(current=>[{id:post.id,kind:'post',reason:'you',createdAt:post.createdAt??new Date().toISOString(),post,channel:null},...current])} onOpenThreads={onOpenThreads}/>
  {loading&&<p className="wall-feedback" role="status">Building your feed…</p>}{error&&<div className="wall-feedback" role="alert"><p>{error}</p><button type="button" onClick={()=>setReload(value=>value+1)}>Try again</button></div>}
  {!loading&&!error&&entries.map(entry=><div className="feed-entry" key={entry.id}>{entry.reason==='recommended'&&<div className="feed-reason"><Sparkles size={12}/>Recommended · public post</div>}{entry.kind==='post'&&entry.post?<PostCard post={entry.post} user={user} mode={mode} onChanged={changed} onDeleted={id=>setEntries(current=>current.filter(entry=>entry.post?.id!==id))} onOpenPerson={onOpenPerson}/>:entry.channel&&<article className="stream-channel"><header><span><Radio size={19}/></span><div><strong>{entry.channel.title}</strong><small>@{entry.channel.handle} · Followed channel</small></div><button type="button" onClick={()=>onOpenChannel(entry.channel!.id)} aria-label={`Open ${entry.channel.title}`}><ArrowUpRight size={18}/></button></header><p>{entry.channel.body}</p>{entry.channel.link&&safeWebsite(entry.channel.link)&&<a href={safeWebsite(entry.channel.link)} target="_blank" rel="noreferrer">Open link <ArrowUpRight size={13}/></a>}<button type="button" className="open-feed-channel" onClick={()=>onOpenChannel(entry.channel!.id)}>Open channel <ArrowUpRight size={13}/></button></article>}</div>)}
  {!loading&&!error&&!entries.length&&<div className="wall-empty"><PixelArt id={artId} mode={artMode} size={72}/><h3>{tab==='following'?'Good people make a good feed.':'A little discovery starts here.'}</h3><p>Follow people and channels to see their updates. Public recommendations will appear when there are eligible posts.</p></div>}
 </section>
}
