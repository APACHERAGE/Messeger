import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ImagePlus, Reply, Send, Smile, Trash2, X } from 'lucide-react'
import { addChannelComment, commentEmoji, deleteChannelComment, listChannelComments, reactChannelComment, type ChannelComment } from './api/channelsApi'

type Props={channelId:string;postId:string;user:{id:string;name:string;username:string};open:boolean;enabled:boolean;onCount:(count:number)=>void}
export default function ChannelComments({channelId,postId,user,open,enabled,onCount}:Props) {
 const [comments,setComments]=useState<ChannelComment[]>([]),[loaded,setLoaded]=useState(false),[loading,setLoading]=useState(false),[more,setMore]=useState(false),[page,setPage]=useState(0)
 const [body,setBody]=useState(''),[photo,setPhoto]=useState<File|null>(null),[preview,setPreview]=useState(''),[reply,setReply]=useState<ChannelComment|null>(null),[emojiOpen,setEmojiOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const input=useRef<HTMLInputElement>(null),text=useRef<HTMLTextAreaElement>(null),alive=useRef(true)
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
 useEffect(()=>{if(!photo){setPreview('');return}const url=URL.createObjectURL(photo);setPreview(url);return()=>URL.revokeObjectURL(url)},[photo])
 useEffect(()=>{if(!open||loaded)return;let active=true;setLoading(true);listChannelComments(channelId,postId,user.id).then(result=>{if(active){setComments(result.items);setMore(result.hasMore);setPage(result.nextPage);setLoaded(true);onCount(result.total)}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[open,loaded,channelId,postId,user.id])
 async function loadMore(){setLoading(true);setError('');try{const result=await listChannelComments(channelId,postId,user.id,page);if(!alive.current)return;setComments(current=>[...current,...result.items.filter(c=>!current.some(item=>item.id===c.id))]);setMore(result.hasMore);setPage(result.nextPage);onCount(result.total)}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Could not load comments.')}finally{if(alive.current)setLoading(false)}}
 async function submit(event:FormEvent){event.preventDefault();if(busy||!enabled||(!body.trim()&&!photo))return;setBusy(true);setError('');try{const comment=await addChannelComment(channelId,postId,user,body,reply?.id??null,photo??undefined);if(!alive.current)return
 // A new reply may be beyond the current page; include it immediately without skipping unloaded pages.
 setComments(current=>[...current.filter(c=>c.id!==comment.id),comment]);setBody('');setPhoto(null);setReply(null);setEmojiOpen(false)
 const result=await listChannelComments(channelId,postId,user.id);if(alive.current)onCount(result.total)
 }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Could not send comment.')}finally{if(alive.current)setBusy(false)}}
 async function remove(comment:ChannelComment){setBusy(true);setError('');try{await deleteChannelComment(channelId,postId,comment.id,user.id);if(!alive.current)return;setComments(current=>current.map(c=>c.id===comment.id?{...c,removed:true,body:'',photoUrl:null,reactions:[],canDelete:false}:c.parentId===comment.id?{...c,parentBody:'Comment removed'}:c));if(reply?.id===comment.id)setReply(null);const result=await listChannelComments(channelId,postId,user.id);if(alive.current)onCount(result.total)}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Could not remove comment.')}finally{if(alive.current)setBusy(false)}}
 async function react(comment:ChannelComment,emoji:string){setBusy(true);setError('');try{const updated=await reactChannelComment(channelId,postId,comment.id,user.id,emoji);if(alive.current)setComments(current=>current.map(c=>c.id===updated.id?updated:c))}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Could not update reaction.')}finally{if(alive.current)setBusy(false)}}
 function choose(file?:File){if(!file)return;if(!['image/png','image/jpeg','image/gif','image/webp'].includes(file.type)||file.size===0||file.size>1_000_000){setError('Choose a JPG, PNG, GIF or WebP photo up to 1 MB.');return}setPhoto(file);setError('')}
 return <section className="channel-comments" id={`comments-${postId}`} aria-label="Post comments" hidden={!open}>
  <div className="channel-comments-heading"><h4>Discussion</h4><span>Replies to this post</span><button type="button" disabled={busy||loading} onClick={()=>{setLoaded(false);setError('')}}>Refresh</button></div>
  {error&&<p role="alert" className="channel-inline-error">{error}</p>}
  {loading&&!loaded&&<p role="status">Loading comments…</p>}
  {!loading&&loaded&&!comments.length&&<p className="channel-comments-empty">No comments yet. Start the discussion.</p>}
  <ol className="channel-comment-list">{[...comments].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id.localeCompare(b.id)).map(comment=><li className={`channel-comment ${comment.parentId?'is-reply':''}`} key={comment.id}>
   <div className="channel-comment-avatar" aria-hidden="true">{comment.author.slice(0,1).toUpperCase()}</div>
   <article><header><strong>{comment.author}</strong><span>@{comment.username}</span><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time></header>
    {comment.parentId&&<blockquote><Reply size={12}/><span><strong>{comment.parentAuthor}</strong> {comment.parentBody||'Photo'}</span></blockquote>}
    {comment.removed?<p className="channel-comment-removed">Comment removed</p>:<><p>{comment.body}</p>{comment.photoUrl&&<a href={comment.photoUrl} target="_blank" rel="noreferrer" className="channel-comment-photo"><img src={comment.photoUrl} alt={`Photo from ${comment.author}`} loading="lazy"/></a>}
    <footer><button type="button" disabled={!enabled||busy} onClick={()=>{setReply(comment);text.current?.focus()}}><Reply size={13}/>Reply</button>
     <div className="channel-comment-reactions" aria-label="Comment reactions">{commentEmoji.map(emoji=>{const r=comment.reactions.find(r=>r.emoji===emoji);return <button type="button" aria-label={`React ${emoji}`} aria-pressed={r?.mine??false} disabled={busy} key={emoji} onClick={()=>void react(comment,emoji)}>{emoji}{!!r?.count&&<span>{r.count}</span>}</button>})}</div>
     {comment.canDelete&&<button type="button" className="channel-comment-remove" disabled={busy} onClick={()=>void remove(comment)} aria-label="Remove comment"><Trash2 size={13}/></button>}
    </footer></>}
   </article>
  </li>)}</ol>
  {more&&<button type="button" className="channel-load-comments" disabled={loading||busy} onClick={()=>void loadMore()}>{loading?'Loading…':'Load more comments'}</button>}
  {enabled?<form className="channel-comment-form" onSubmit={submit}>
   {reply&&<div className="channel-reply-target"><Reply size={14}/><span>Replying to <strong>{reply.author}</strong><small>{reply.body.slice(0,120)||'Photo'}</small></span><button type="button" onClick={()=>setReply(null)} aria-label="Cancel reply"><X size={14}/></button></div>}
   <label htmlFor={`comment-draft-${postId}`}>Add a comment</label><textarea ref={text} id={`comment-draft-${postId}`} value={body} onChange={e=>setBody(e.target.value)} maxLength={2000} placeholder="Join the discussion…" rows={3} disabled={busy}/>
   {photo&&<div className="channel-comment-preview">{preview&&<img src={preview} alt="Selected photo preview"/>}<span>{photo.name}</span><button type="button" onClick={()=>setPhoto(null)} aria-label="Remove photo"><X size={14}/></button></div>}
   <input ref={input} className="channel-attachment-input" type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={e=>{choose(e.target.files?.[0]);e.currentTarget.value=''}}/>
   {emojiOpen&&<div className="channel-emoji-picker" aria-label="Add emoji">{['😀','😂','❤️','👍','🔥','🎉','🚀','👀','🤔','🙌','💻','✨'].map(emoji=><button type="button" key={emoji} onClick={()=>{setBody(current=>current.length+emoji.length<=2000?current+emoji:current);text.current?.focus()}}>{emoji}</button>)}</div>}
   <div className="channel-comment-form-actions"><button type="button" disabled={busy} onClick={()=>input.current?.click()}><ImagePlus size={16}/><span>Photo</span></button><button type="button" disabled={busy} aria-expanded={emojiOpen} onClick={()=>setEmojiOpen(value=>!value)}><Smile size={16}/><span>Emoji</span></button><small>{body.length}/2000 · photo up to 1 MB</small><button type="submit" className="channel-primary" disabled={busy||(!body.trim()&&!photo)}><Send size={15}/>{busy?'Sending…':'Comment'}</button></div>
  </form>:<p className="channel-comments-closed">Comments are closed. Existing discussion remains available.</p>}
 </section>
}
