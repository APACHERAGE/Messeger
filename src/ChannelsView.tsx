import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowDownLeft, ArrowUpRight, Check, Copy, FileText, Link, Paperclip, Plus, Radio, Search, Send, UsersRound, X } from 'lucide-react'
import { CHANNEL_ATTACHMENT_ACCEPT, CHANNEL_ATTACHMENT_TYPES, CHANNEL_FILE_LIMIT_BYTES, createChannel, followChannel, getChannel, isLocalChannelMode, listChannels, publishChannelPost, unfollowChannel, type Channel, type ChannelPost } from './api/channelsApi'
import PixelLandscape from './PixelLandscape'
import ChannelOwnerPanel from './ChannelOwnerPanel'
import ChannelPostItem from './ChannelPostItem'
import './channels.css'

type Props = { userId: string; displayName?: string; username?: string; createKey?: number; initialChannelId?: string; onChannelChange?: (channelId: string | null) => void }

function firstLetter(value: string) {
  return value.trim().slice(0, 1).toUpperCase() || '#'
}

export default function ChannelsView({ userId, displayName='You', username='local', createKey = 0, initialChannelId, onChannelChange }: Props) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [posts, setPosts] = useState<ChannelPost[]>([])
  const [query, setQuery] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [draft, setDraft] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [linkDraft, setLinkDraft] = useState('')
  const [linkInputOpen, setLinkInputOpen] = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [localMode, setLocalMode] = useState(false)
  const [error, setError] = useState('')
  const [copiedChannel, setCopiedChannel] = useState('')
  const [studioOpen,setStudioOpen]=useState(false)
  const [postsLoading,setPostsLoading]=useState(false)

  const selected = channels.find(channel => channel.id === selectedId)
  const isOwner = selected?.ownerId === userId
  const filteredChannels = useMemo(() => channels.filter(channel =>
    `${channel.title} ${channel.handle} ${channel.description} ${channel.ownerUsername}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [channels, query])

  useEffect(() => {
    let active = true
    listChannels(userId).then(data => {
      if (!active) return
      setChannels(data)
      setLocalMode(isLocalChannelMode())
      setSelectedId(current => {
        const linked = data.find(channel => channel.id === initialChannelId || channel.handle === initialChannelId)
        const nextId = linked?.id ?? (data.some(channel => channel.id === current) ? current : data[0]?.id ?? '')
        return nextId
      })
    }).catch(requestError => {
      if (active) setError(requestError instanceof Error ? requestError.message : 'Failed to load channels.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [userId])

  useEffect(() => { if (createKey > 0) setCreateOpen(true) }, [createKey])

  useEffect(() => {
    if (!initialChannelId) return
    const channel = channels.find(item => item.id === initialChannelId || item.handle === initialChannelId)
    if (channel) {
      if (selectedId !== channel.id) setSelectedId(channel.id)
      // Canonicalize an ID link once; an inline parent callback can change on every render.
      if (initialChannelId !== channel.handle) onChannelChange?.(channel.handle)
    }
  }, [channels, initialChannelId, selectedId, onChannelChange])

  useEffect(() => {
    if (!selectedId) { setPosts([]); return }
    let active = true
    setPostsLoading(true); setPosts([]); setDraft(''); setAttachmentFile(null); setLinkDraft(''); setLinkInputOpen(false); setStudioOpen(false)
    getChannel(selectedId, userId).then(detail => {
      if (active) {
        setPosts(detail.posts)
        setChannels(current => current.map(channel => channel.id === detail.channel.id ? detail.channel : channel))
      }
    }).catch(requestError => {
      if (active) setError(requestError instanceof Error ? requestError.message : 'Failed to open channel.')
    })
    .finally(()=>{if(active)setPostsLoading(false)})
    return () => { active = false }
  }, [selectedId, userId])

  async function submitChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !title.trim()) return
    setSaving(true)
    setError('')
    try {
      const channel = await createChannel(title.trim(), description.trim(), userId)
      setChannels(current => [channel, ...current])
      setSelectedId(channel.id)
      onChannelChange?.(channel.handle)
      setTitle('')
      setDescription('')
      setCreateOpen(false)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create channel.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleFollow(channel: Channel) {
    if(channel.ownerId===userId) return
    setError('')
    try {
      const updated = channel.subscribed
        ? await unfollowChannel(channel.id, userId).then(() => ({ ...channel, subscribed: false, followers: Math.max(0, channel.followers - 1) }))
        : await followChannel(channel.id, userId)
      setChannels(current => current.map(item => item.id === updated.id ? updated : item))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to update subscription.')
    }
  }

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const link = linkDraft.trim()
    if (!selected || (!draft.trim() && !attachmentFile && !link) || saving) return
    if (link && !/^https?:\/\/\S+$/i.test(link)) {
      setError('Use a complete http:// or https:// link.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const post = await publishChannelPost(selected.id, draft.trim(), userId, attachmentFile ?? undefined, link)
      setPosts(current => [post, ...current])
      setDraft('')
      setAttachmentFile(null)
      setLinkDraft('')
      setLinkInputOpen(false)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to publish post.')
    } finally {
      setSaving(false)
    }
  }

  function chooseAttachment(file?: File) {
    if (!file) return
    if (!(CHANNEL_ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
      setAttachmentFile(null)
      setError('Channels accept images, PDF, and text files only.')
      return
    }
    if (file.size > CHANNEL_FILE_LIMIT_BYTES) {
      setError('Attachments must be smaller than 1 MB.')
      return
    }
    setError('')
    setAttachmentFile(file)
  }

  async function copyChannelLink(channel: Channel) {
    try {
      await navigator.clipboard.writeText(new URL(`/channels/${encodeURIComponent(channel.handle)}`, window.location.origin).toString())
      setCopiedChannel(channel.id)
      window.setTimeout(() => setCopiedChannel(current => current === channel.id ? '' : current), 1800)
    } catch {
      setError('Could not access the clipboard. Copy the channel URL from the address bar.')
    }
  }

  return <section className="channels-workspace" aria-label="Community channels">
    <aside className="channels-directory">
      <header className="channels-directory-heading">
        <div><p className="hub-kicker"><span /> COMMUNITY / CHANNELS</p><h1>Channels<span>.</span></h1><p>News, memes, and community voices.</p></div>
        <button className="channel-create-icon" aria-label="Create channel" title="Create channel" onClick={() => setCreateOpen(value => !value)}><Plus size={19} /></button>
      </header>
      {localMode && <p className="channels-mode-note">Local mode: channels are stored in this browser. Start the backend to share channels.</p>}
      {createOpen && <form className="channel-create-form" onSubmit={submitChannel}>
        <label>CHANNEL NAME<input value={title} onChange={event => setTitle(event.target.value)} maxLength={72} placeholder="For example, Night Shift News" required /></label>
        <label>DESCRIPTION <small>optional</small><textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={240} rows={2} placeholder="What is this channel about?" /></label>
        <button type="submit" disabled={saving || !title.trim()}>{saving ? 'Creating…' : 'Create channel'} <ArrowUpRight size={15} /></button>
      </form>}
      <label className="channels-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search channels…" aria-label="Search channels" /></label>
      <div className="channels-directory-list">
        {loading ? <p className="channels-empty">Loading channels…</p> : filteredChannels.length ? filteredChannels.map(channel =>
          <button key={channel.id} className={`channel-list-item ${selectedId === channel.id ? 'selected' : ''}`} onClick={() => { setSelectedId(channel.id); onChannelChange?.(channel.handle) }} aria-pressed={selectedId === channel.id}>
            <span className="channel-list-avatar">{firstLetter(channel.title)}</span>
            <span className="channel-list-copy"><strong>{channel.title}</strong><small>@{channel.handle}</small></span>
            <span className="channel-list-count"><UsersRound size={12} /> {channel.followers}</span>
          </button>
        ) : <div className="channels-empty-state"><Radio size={21} /><strong>No channels yet</strong><span>Create one or check back later.</span><button onClick={() => setCreateOpen(true)}>Create a channel</button></div>}
      </div>
      <div className="channels-directory-foot"><span>PUBLIC CHANNELS</span><span>{channels.length.toString().padStart(2, '0')} / INDEX</span></div>
    </aside>

    <main className="channel-detail">
      {error && <div className="channel-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
      {selected ? <>
        <header className="channel-detail-header">
          <div className="channel-detail-identity"><span className="channel-detail-avatar">{firstLetter(selected.title)}</span><div><p className="hub-kicker"><span /> COMMUNITY TRANSMISSION</p><h2>{selected.title}</h2><p>@{selected.handle} <i>·</i> {selected.followers} followers</p></div></div>
          <div className="channel-detail-actions">{isOwner && <span className="channel-owner-badge"><Check size={12} /> OWNER</span>}<button className="channel-follow" onClick={() => void copyChannelLink(selected)}><Copy size={14} /> {copiedChannel === selected.id ? 'Copied' : 'Share link'}</button>{isOwner?<button className="channel-follow following" aria-expanded={studioOpen} onClick={()=>setStudioOpen(value=>!value)}>Manage channel</button>:<button className={`channel-follow ${selected.subscribed ? 'following' : ''}`} onClick={() => void toggleFollow(selected)}>{selected.subscribed ? <><Check size={14} /> Following</> : <><Plus size={14} /> Follow</>}</button>}</div>
        </header>
        {isOwner&&studioOpen&&<ChannelOwnerPanel key={selected.id} channel={selected} posts={posts} userId={userId} localMode={localMode} onUpdate={detail=>{setChannels(current=>current.map(c=>c.id===detail.channel.id?detail.channel:c));setPosts(detail.posts);if(detail.channel.ownerId!==userId)setStudioOpen(false)}} onDelete={()=>{const remaining=channels.filter(c=>c.id!==selected.id);setChannels(remaining);setSelectedId(remaining[0]?.id??'');onChannelChange?.(remaining[0]?.handle??null)}}/>}
        {selected.description && <p className="channel-description">{selected.description}</p>}
        <div className="channel-posts-heading"><div><p className="hub-kicker">LATEST SIGNAL</p><h3>Channel feed</h3></div><span>POSTS / {posts.length.toString().padStart(2, '0')}</span></div>
        <div className="channel-posts">
          {postsLoading?<p role="status">Loading posts…</p>:posts.length ? [...posts].sort((a,b)=>Number(b.pinned)-Number(a.pinned)||Date.parse(b.createdAt)-Date.parse(a.createdAt)).map(post=><ChannelPostItem key={`${selected.id}-${post.id}`} channel={selected} post={post} user={{id:userId,name:displayName,username}} onUpdate={updated=>setPosts(current=>current.map(p=>p.id===updated.id?updated:p))} onDelete={()=>setPosts(current=>current.filter(p=>p.id!==post.id))}/>) : <div className="channel-post-empty"><PixelLandscape /><h3>Nothing in the feed</h3><p>{isOwner ? 'Kick off the channel with an update, discovery, or a good meme.' : 'This channel has no posts yet.'}</p></div>}
        </div>
        {isOwner && !postsLoading && <form className="channel-publisher" onSubmit={submitPost}>
          <label htmlFor="channel-post">NEW POST <span>OWNER MODE / TEXT + ATTACHMENTS</span></label>
          <textarea id="channel-post" value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} rows={3} placeholder="Share an update, meme, or thought…" />
          <input ref={attachmentInputRef} className="channel-attachment-input" type="file" accept={CHANNEL_ATTACHMENT_ACCEPT} onChange={event => { chooseAttachment(event.target.files?.[0]); event.currentTarget.value = '' }} />
          {attachmentFile && <div className="channel-attachment-chip"><FileText size={14} /><span>{attachmentFile.name}</span><small>{(attachmentFile.size / 1024).toFixed(0)} KB</small><button type="button" aria-label="Remove attachment" onClick={() => setAttachmentFile(null)}><X size={14} /></button></div>}
          {linkInputOpen && <input className="channel-link-input" type="url" value={linkDraft} onChange={event => setLinkDraft(event.target.value)} maxLength={2048} placeholder="https://example.com" aria-label="Post link" />}
          <div className="channel-publisher-actions">
            <div className="channel-publisher-tools">
              <button type="button" className="channel-attach-button" onClick={() => attachmentInputRef.current?.click()}><Paperclip size={14} /><span>File / image</span></button>
              <button type="button" className="channel-attach-button" onClick={() => { setLinkInputOpen(value => !value); if (linkInputOpen) setLinkDraft('') }}><Link size={14} /><span>{linkInputOpen ? 'Remove link' : 'Add link'}</span></button>
            </div>
            <small>{draft.length}/2000 · this post will reach all followers</small>
            <button type="submit" disabled={saving || (!draft.trim() && !attachmentFile && !linkDraft.trim())}>{saving ? 'Publishing…' : 'Publish'} <Send size={14} /></button>
          </div>
        </form>}
        {!isOwner && !selected.subscribed && <div className="channel-subscribe-callout"><ArrowDownLeft size={17} /> Follow this channel to stay up to date.</div>}
      </> : <div className="channel-no-selection"><PixelLandscape /><p className="hub-kicker">NO CHANNEL SELECTED</p><h2>Pick a channel<span>.</span></h2><p>Or create one to share updates and memes.</p><button onClick={() => setCreateOpen(true)}>Create channel <Plus size={15} /></button></div>}
    </main>
  </section>
}
