import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Film, Globe, ImagePlus, LockKeyhole, Send } from 'lucide-react'
import { createHubPost, type HubPost } from './api/hubApi'
import { IMAGE_ACCEPT, VIDEO_ACCEPT, validatePostFiles } from './api/hubMedia'
import { DraftMedia } from './HubMedia'
import './hub.css'
import './wall.css'
import './stream.css'

type Props={user:{id:string;displayName:string;username:string};wallOwnerId?:string;ownerName?:string;defaultAudience?:'friends'|'public';local?:boolean;onPublished:(post:HubPost)=>void;onOpenThreads:()=>void}
export default function PostComposer({user,wallOwnerId=user.id,ownerName,defaultAudience='friends',local=false,onPublished,onOpenThreads}:Props){
 const [draft,setDraft]=useState(''),[files,setFiles]=useState<{id:string;file:File}[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[validating,setValidating]=useState(false)
 const [audience,setAudience]=useState<'friends'|'public'>(wallOwnerId===user.id?defaultAudience:'friends')
 const photo=useRef<HTMLInputElement>(null),gif=useRef<HTMLInputElement>(null),video=useRef<HTMLInputElement>(null),busyRef=useRef(false),validatingRef=useRef(false)
 useEffect(()=>{if(!draft&&!files.length)setAudience(wallOwnerId===user.id?defaultAudience:'friends')},[defaultAudience,wallOwnerId,user.id])
 async function addFiles(list:FileList|null){
  if(!list?.length||busyRef.current||validatingRef.current)return
  validatingRef.current=true;setValidating(true);setError('')
  const next=[...files,...Array.from(list,file=>({id:crypto.randomUUID(),file}))]
  try{await validatePostFiles(next.map(item=>item.file));setFiles(next)}catch(error){setError(error instanceof Error?error.message:'Could not add this file.')}finally{validatingRef.current=false;setValidating(false)}
 }
 async function publish(event:FormEvent){
  event.preventDefault();if(busyRef.current||validatingRef.current||!draft.trim()&&!files.length)return
  busyRef.current=true;setBusy(true);setError('')
  try{const post=await createHubPost(draft,user,files.map(item=>item.file),{wallOwnerId,audience});onPublished(post);setDraft('');setFiles([])}catch(error){setError(error instanceof Error?error.message:'Could not publish your post. Your draft is kept.')}finally{busyRef.current=false;setBusy(false)}
 }
 const disabled=busy||validating
 return <section className="hub-composer post-composer" aria-label="Create a post"><span className="composer-avatar">{user.displayName.slice(0,1).toUpperCase()||'N'}</span><form onSubmit={event=>void publish(event)}>
  <div className="hub-composer-heading"><label htmlFor={`post-${wallOwnerId}`}>{wallOwnerId===user.id?'Create a post':`Write on ${ownerName||'your friend'}’s wall`}</label><label className="post-audience" title="Who can see this post">{audience==='public'?<Globe size={13}/>:<LockKeyhole size={13}/>}<select aria-label="Post visibility" value={audience} disabled={disabled||wallOwnerId!==user.id} onChange={event=>setAudience(event.target.value as 'friends'|'public')}><option value="friends">Friends</option>{wallOwnerId===user.id&&<option value="public">Public</option>}</select></label></div>
  <textarea id={`post-${wallOwnerId}`} value={draft} onChange={event=>setDraft(event.target.value)} disabled={busy} placeholder="What's new? Share a moment, an update, or something you love…" maxLength={500} rows={3}/>
  {!!files.length&&<div className="hub-draft-media-grid" aria-label="Post attachments">{files.map(item=><DraftMedia key={item.id} file={item.file} disabled={disabled} onRemove={()=>{setFiles(current=>current.filter(file=>file.id!==item.id));setError('')}}/>)}</div>}
  <input type="file" hidden multiple ref={photo} accept={IMAGE_ACCEPT} onChange={event=>{void addFiles(event.target.files);event.target.value=''}}/><input type="file" hidden multiple ref={gif} accept="image/gif" onChange={event=>{void addFiles(event.target.files);event.target.value=''}}/><input type="file" hidden multiple ref={video} accept={VIDEO_ACCEPT} onChange={event=>{void addFiles(event.target.files);event.target.value=''}}/>
  <div className="hub-composer-tools" role="group" aria-label="Add to your post"><button type="button" disabled={disabled||files.length>=4} onClick={()=>photo.current?.click()}><ImagePlus size={16}/>Photo</button><button type="button" disabled={disabled||files.length>=4} onClick={()=>gif.current?.click()}><b className="hub-gif-icon">GIF</b></button><button type="button" disabled={disabled||files.length>=4} onClick={()=>video.current?.click()}><Film size={16}/>Video</button><small>{files.length}/4 · {draft.length}/500</small></div>
  {error&&<p className="hub-media-error" role="alert">{error}</p>}{validating&&<p className="hub-upload-status" role="status">Checking attachments…</p>}
  <div className="hub-composer-footer"><span>{local?'Saved only on this device':audience==='public'?'Public · may appear in recommendations':'Only the wall owner and their friends'}</span><button type="submit" disabled={disabled||!draft.trim()&&!files.length}><Send size={15}/>{busy?'Publishing…':'Publish post'}</button></div>
  <div className="hub-composer-hint"><span>Photos & GIFs up to 5 MB · videos up to 20 MB</span><button type="button" onClick={onOpenThreads}>Questions? Open Threads <ArrowRight size={12}/></button></div>
 </form></section>
}
