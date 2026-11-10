import { useCallback, useEffect, useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { getHubStorageMode, listHubPosts, type HubPost, type HubStorageMode } from './api/hubApi'
import PostComposer from './PostComposer'
import PostCard from './PostCard'
import { PixelArt } from './PixelArt'
import './hub.css'
import './wall.css'
import './stream.css'

type Props={userId:string;ownerId?:string;ownerName?:string;displayName:string;username:string;canPostToWall?:boolean;defaultAudience?:'friends'|'public';artId?:string;artMode?:string;onOpenThreads:()=>void;onNotice:(message:string)=>void;onOpenPerson?:(id:string)=>void}
export default function UserWall({userId,ownerId=userId,ownerName,displayName,username,canPostToWall=false,defaultAudience='friends',artId='server',artMode='pixel',onOpenThreads,onNotice,onOpenPerson}:Props){
 const [posts,setPosts]=useState<HubPost[]>([]),[mode,setMode]=useState<HubStorageMode|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[reload,setReload]=useState(0)
 const own=ownerId===userId,user={id:userId,displayName,username}
 useEffect(()=>{let active=true;setLoading(true);setError('');Promise.all([listHubPosts(userId,ownerId),getHubStorageMode(userId)]).then(([items,mode])=>{if(active){setPosts(items);setMode(mode)}}).catch(error=>{if(active){const message=error instanceof Error?error.message:'Could not load this wall.';setError(message);onNotice(message)}}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[userId,ownerId,onNotice,reload])
 const changed=useCallback((next:HubPost)=>setPosts(current=>current.map(post=>post.id===next.id?next:post)),[])
 return <section className="user-wall hub-dashboard" aria-label={own?'Your wall':`${ownerName||'User'}’s wall`}><header className="wall-heading"><div><span>NOTES, MOMENTS & GOOD COMPANY</span><h2>{own?'My wall':`${ownerName||'User'}’s wall`}</h2></div><span className="wall-audience"><LockKeyhole size={13}/>Personal wall</span></header>
  {(own||canPostToWall)&&!error&&<PostComposer user={user} wallOwnerId={ownerId} ownerName={ownerName} defaultAudience={own?defaultAudience:'friends'} local={mode==='local'} onPublished={post=>setPosts(current=>[post,...current])} onOpenThreads={onOpenThreads}/>}
  {loading&&<p className="wall-feedback" role="status">Loading posts…</p>}{error&&<div className="wall-feedback" role="alert"><p>{error}</p><button type="button" onClick={()=>setReload(value=>value+1)}>Retry</button></div>}
  <div className="hub-post-list">{!loading&&!error&&posts.map(post=><PostCard key={post.id} post={post} user={user} mode={mode} onChanged={changed} onDeleted={id=>setPosts(current=>current.filter(post=>post.id!==id))} onOpenPerson={onOpenPerson}/>)}</div>
  {!loading&&!error&&!posts.length&&<div className="wall-empty"><PixelArt id={artId} mode={artMode} size={72}/><h3>{own?'Your story starts here.':'A quiet corner, for now.'}</h3><p>{own?'Your posts and notes left by friends on your page will appear here.':'Posts shared on this page will appear here.'}</p></div>}
 </section>
}
