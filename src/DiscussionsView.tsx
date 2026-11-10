import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowDownWideNarrow, ArrowUpRight, Bookmark, Check, CheckCircle2, Copy, MessageSquareText, Plus, Reply, Search, Send, Sparkles, Tag, X } from 'lucide-react'
import {
  addDiscussionComment,
  createDiscussion,
  getDiscussion,
  isLocalDiscussionMode,
  listDiscussions,
  setAcceptedAnswer,
  setDiscussionResolved,
  setDiscussionSaved,
  type DiscussionComment,
  type DiscussionDetail,
  type DiscussionSort,
  type DiscussionThread,
} from './api/discussionsApi'
import DiscussionMarkdown from './DiscussionMarkdown'
import './discussions.css'

type Props = {
  userId: string
  displayName: string
  username: string
  initialSearch?: string
  initialSort?: DiscussionSort
  searchKey?: number
  sortKey?: number
  createKey?: number
  initialThreadId?: string
  onThreadChange?: (threadId: string | null) => void
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

const suggestedTags = ['Linux', 'React', 'Docker', 'JavaScript', 'TypeScript', 'Python', 'DevOps', 'Database']

export default function DiscussionsView({
  userId,
  displayName,
  username,
  initialSearch = '',
  initialSort = 'active',
  searchKey = 0,
  sortKey = 0,
  createKey = 0,
  initialThreadId,
  onThreadChange,
}: Props) {
  const [threads, setThreads] = useState<DiscussionThread[]>([])
  const [expandedId, setExpandedId] = useState(initialThreadId ?? '')
  const [detail, setDetail] = useState<DiscussionDetail | null>(null)
  const [query, setQuery] = useState(initialSearch)
  const [sort, setSort] = useState<DiscussionSort>(initialSort)
  const [threadTitle, setThreadTitle] = useState('')
  const [threadBody, setThreadBody] = useState('')
  const [threadTags, setThreadTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [savedOnly, setSavedOnly] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [replyTo, setReplyTo] = useState<DiscussionComment | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [localMode, setLocalMode] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [copiedThreadId, setCopiedThreadId] = useState('')

  useEffect(() => { setQuery(initialSearch) }, [initialSearch, searchKey])
  useEffect(() => { setSort(initialSort) }, [initialSort, sortKey])
  useEffect(() => { if (createKey > 0) setCreateOpen(true) }, [createKey])
  useEffect(() => {
    setExpandedId(initialThreadId ?? '')
    if (initialThreadId) onThreadChange?.(initialThreadId)
  }, [initialThreadId])

  function selectThread(threadId: string | null) {
    setExpandedId(threadId ?? '')
    onThreadChange?.(threadId)
  }

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      setLoading(true)
      listDiscussions(userId, query, sort, tagFilter, savedOnly).then(data => {
        if (!active) return
        setThreads(data)
        setLocalMode(isLocalDiscussionMode())
        setExpandedId(current => data.some(thread => thread.id === current) || current === initialThreadId ? current : '')
        if (initialThreadId && !data.some(thread => thread.id === initialThreadId)) {
          getDiscussion(initialThreadId, userId).then(deepLinked => {
            if (active) setThreads(current => current.some(thread => thread.id === initialThreadId) ? current : [deepLinked.thread, ...current])
          }).catch(requestError => {
            if (active) setError(requestError instanceof Error ? requestError.message : 'Failed to load the linked thread.')
          })
        }
      }).catch(requestError => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Failed to load Threads.')
      }).finally(() => { if (active) setLoading(false) })
    }, query ? 180 : 0)
    return () => { active = false; clearTimeout(timer) }
  }, [initialThreadId, query, refreshKey, savedOnly, sort, tagFilter, userId])

  useEffect(() => {
    if (!expandedId) { setDetail(null); return }
    let active = true
    getDiscussion(expandedId, userId).then(data => {
      if (active) setDetail(data)
    }).catch(requestError => {
      if (active) setError(requestError instanceof Error ? requestError.message : 'Failed to open thread.')
    })
    return () => { active = false }
  }, [expandedId, refreshKey, userId])

  const repliesByParent = useMemo(() => {
    const grouped = new Map<string | null, DiscussionComment[]>()
    for (const comment of detail?.comments ?? []) {
      const parent = comment.parentCommentId
      grouped.set(parent, [...(grouped.get(parent) ?? []), comment])
    }
    return grouped
  }, [detail])
  const availableTags = useMemo(() => [...new Set([...suggestedTags, ...threads.flatMap(thread => thread.tags)])].sort(), [threads])

  function addTagDraft() {
    const tag = tagDraft.trim().replace(/\s+/g, ' ')
    if (!tag) return
    if (tag.length > 32 || !/^[\p{L}\p{N}+#.-]+(?: [\p{L}\p{N}+#.-]+)*$/u.test(tag)) {
      setError('Tags can contain up to 32 letters, numbers, spaces, or +#.- characters.')
      return
    }
    if (!threadTags.some(item => item.toLocaleLowerCase() === tag.toLocaleLowerCase())) {
      if (threadTags.length >= 8) {
        setError('A discussion can have up to 8 tags.')
        return
      }
      setThreadTags(current => [...current, tag])
    }
    setError('')
    setTagDraft('')
  }

  function renderComments(parentId: string | null, depth = 0): ReactNode {
    return (repliesByParent.get(parentId) ?? []).map(comment => <article className={`threads-comment ${depth ? 'nested' : ''}`} key={comment.id}>
      <header><strong>{comment.author}</strong><span>@{comment.username}</span><time>{formatDate(comment.createdAt)}</time></header>
      {detail?.thread.acceptedAnswerId === comment.id && <span className="discussion-accepted-label"><CheckCircle2 size={13} /> Accepted answer</span>}
      <DiscussionMarkdown source={comment.body} />
      {detail?.thread.username === username && <button
        className={`discussion-accept-answer ${detail.thread.acceptedAnswerId === comment.id ? 'accepted' : ''}`}
        onClick={() => updateAcceptedAnswer(detail.thread.id, detail.thread.acceptedAnswerId === comment.id ? null : comment.id)}
      >{detail.thread.acceptedAnswerId === comment.id ? <><Check size={13} /> Accepted</> : 'Accept answer'}</button>}
      {depth < 3 && <><button className="threads-reply-link" onClick={() => setReplyTo(comment)}><Reply size={13} /> Reply</button>{renderComments(comment.id, depth + 1)}</>}
    </article>)
  }

  async function updateSaved(thread: DiscussionThread) {
    setError('')
    try {
      const saved = await setDiscussionSaved(thread.id, userId, !thread.saved)
      setThreads(current => current.map(item => item.id === thread.id ? { ...item, saved } : item))
      setDetail(current => current?.thread.id === thread.id ? { ...current, thread: { ...current.thread, saved } } : current)
      if (savedOnly && !saved) setRefreshKey(value => value + 1)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to update saved discussion.')
    }
  }

  async function updateResolved(thread: DiscussionThread) {
    setError('')
    try {
      const updated = await setDiscussionResolved(thread.id, { id: userId, displayName, username }, !thread.resolved)
      setThreads(current => current.map(item => item.id === thread.id ? updated : item))
      setDetail(current => current?.thread.id === thread.id ? { ...current, thread: updated } : current)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to update discussion status.')
    }
  }

  async function updateAcceptedAnswer(threadId: string, commentId: string | null) {
    setError('')
    try {
      const updated = await setAcceptedAnswer(threadId, commentId, { id: userId, displayName, username })
      setThreads(current => current.map(item => item.id === threadId ? updated : item))
      setDetail(current => current?.thread.id === threadId ? { ...current, thread: updated } : current)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to update accepted answer.')
    }
  }

  async function copyThreadLink(threadId: string) {
    try {
      await navigator.clipboard.writeText(new URL(`/threads/${encodeURIComponent(threadId)}`, window.location.origin).toString())
      setCopiedThreadId(threadId)
      window.setTimeout(() => setCopiedThreadId(current => current === threadId ? '' : current), 1800)
    } catch {
      setError('Could not access the clipboard. Copy the thread URL from the address bar.')
    }
  }

  async function submitThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !threadTitle.trim() || !threadBody.trim()) return
    setSaving(true)
    setError('')
    try {
      const thread = await createDiscussion(
        { title: threadTitle.trim(), body: threadBody.trim(), tags: threadTags },
        { id: userId, displayName, username },
      )
      setThreadTitle('')
      setThreadBody('')
      setThreadTags([])
      setTagDraft('')
      setCreateOpen(false)
      selectThread(thread.id)
      setRefreshKey(value => value + 1)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create thread.')
    } finally {
      setSaving(false)
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!detail || saving || !commentBody.trim()) return
    setSaving(true)
    setError('')
    try {
      const comment = await addDiscussionComment(
        detail.thread.id,
        { body: commentBody.trim(), parentCommentId: replyTo?.id ?? null },
        { id: userId, displayName, username },
      )
      setDetail(current => current ? {
        thread: { ...current.thread, commentCount: current.thread.commentCount + 1, updatedAt: comment.createdAt },
        comments: [...current.comments, comment],
      } : current)
      setCommentBody('')
      setReplyTo(null)
      setRefreshKey(value => value + 1)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to post reply.')
    } finally {
      setSaving(false)
    }
  }

  return <main className="threads-page" aria-label="Threads developer discussions">
    <div className="threads-content">
      <header className="threads-topbar">
        <div className="threads-brand"><span><MessageSquareText size={21} /></span><div><h1>Threads</h1><p>Developer discussions</p></div></div>
        <label className="threads-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search threads and solutions" aria-label="Search Threads" />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button>}</label>
        <button className="threads-create-button" onClick={() => setCreateOpen(value => !value)}><Plus size={16} /> New thread</button>
      </header>

      {localMode && <div className="threads-mode-note">Local mode · posts are only visible in this browser. Start the backend to share with the community.</div>}
      {error && <div className="channel-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}

      {createOpen && <form className="threads-composer" onSubmit={submitThread}>
        <div className="threads-composer-heading"><div className="threads-avatar">{displayName.trim().slice(0, 1).toUpperCase()}</div><div><strong>Start a discussion</strong><span>Describe the issue and get help from the community</span></div><button type="button" aria-label="Close form" onClick={() => setCreateOpen(false)}><X size={17} /></button></div>
        <input className="threads-title-input" value={threadTitle} onChange={event => setThreadTitle(event.target.value)} maxLength={140} placeholder="Title: summarize your question" aria-label="Thread title" required />
        <textarea value={threadBody} onChange={event => setThreadBody(event.target.value)} maxLength={5000} rows={4} placeholder="Add context: what happened, what you tried, relevant logs…" aria-label="Thread details" required />
        <div className="discussion-tag-picker" aria-label="Discussion tags">
          {suggestedTags.map(tag => <button key={tag} type="button" className={threadTags.includes(tag) ? 'selected' : ''} aria-pressed={threadTags.includes(tag)} onClick={() => setThreadTags(current => current.includes(tag) ? current.filter(item => item !== tag) : current.length < 8 ? [...current, tag] : current)}><Tag size={12} /> {tag}</button>)}
          <label className="discussion-custom-tag"><input value={tagDraft} maxLength={32} placeholder="Custom tag" aria-label="Custom discussion tag" onChange={event => setTagDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addTagDraft() } }} /><button type="button" onClick={addTagDraft}>Add</button></label>
        </div>
        <div className="threads-composer-footer"><small>{threadBody.length}/5000 · Never post passwords or secret keys</small><button type="submit" disabled={saving || !threadTitle.trim() || !threadBody.trim()}>{saving ? 'Publishing…' : 'Publish'} <ArrowUpRight size={15} /></button></div>
      </form>}

      <nav className="threads-feed-toolbar" aria-label="Sort threads">
        <div><Sparkles size={16} /><strong>Community feed</strong><span>{threads.length} threads</span></div>
        <div className="threads-sort-tabs">
          <button className={sort === 'active' ? 'active' : ''} onClick={() => setSort('active')}><ArrowDownWideNarrow size={14} /> Active</button>
          <button className={sort === 'new' ? 'active' : ''} onClick={() => setSort('new')}>New</button>
          <button className={savedOnly ? 'active' : ''} onClick={() => setSavedOnly(value => !value)}><Bookmark size={13} /> Saved</button>
        </div>
      </nav>
      <label className="discussion-tag-filter"><Tag size={14} /><span>Filter by tag</span><select value={tagFilter} onChange={event => setTagFilter(event.target.value)} aria-label="Filter discussions by tag"><option value="">All tags</option>{availableTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}</select></label>

      <div className="threads-feed" aria-busy={loading}>
        {loading ? <div className="threads-empty">Loading threads…</div> : threads.length ? threads.map(thread => {
          const expanded = thread.id === expandedId
          const threadDetail = expanded ? detail : null
          return <article className={`threads-card ${expanded ? 'expanded' : ''}`} key={thread.id}>
            <div className="threads-count-rail" aria-label={`${thread.commentCount} comments`}><MessageSquareText size={15} /><strong>{thread.commentCount}</strong></div>
            <div className="threads-card-main">
              <header className="threads-card-meta"><span className="threads-community-mark">N</span><strong>THREADS</strong><span>·</span><span>@{thread.username}</span><span>·</span><time>{formatDate(thread.createdAt)}</time></header>
              <h2>{thread.title}</h2>
              <DiscussionMarkdown source={thread.body} />
              <div className="discussion-thread-badges">
                {thread.resolved && <span className="discussion-resolved-badge"><CheckCircle2 size={13} /> Resolved</span>}
                {thread.tags.map(tag => <button key={tag} onClick={() => setTagFilter(tag)}><Tag size={11} /> {tag}</button>)}
              </div>
              <footer className="threads-card-actions">
                <button onClick={() => { selectThread(expanded ? null : thread.id); setReplyTo(null) }} aria-expanded={expanded}><MessageSquareText size={15} /> {thread.commentCount} comments</button>
                <button onClick={() => { selectThread(thread.id); setReplyTo(null); setCommentBody('') }}><Reply size={15} /> Reply</button>
                <button className={thread.saved ? 'saved' : ''} onClick={() => updateSaved(thread)} aria-pressed={thread.saved}><Bookmark size={14} /> {thread.saved ? 'Saved' : 'Save'}</button>
                <button onClick={() => void copyThreadLink(thread.id)}><Copy size={14} /> {copiedThreadId === thread.id ? 'Copied' : 'Copy link'}</button>
                <span>updated {formatDate(thread.updatedAt)}</span>
              </footer>
              {expanded && <section className="threads-expanded" aria-label="Thread comments">
                {threadDetail ? <>
                  <button className="discussion-return-to-list" onClick={() => selectThread(null)}>← Back to discussions</button>
                  {threadDetail.thread.username === username && <button className={`discussion-resolve-control ${threadDetail.thread.resolved ? 'resolved' : ''}`} onClick={() => updateResolved(threadDetail.thread)}>{threadDetail.thread.resolved ? <><CheckCircle2 size={14} /> Mark as open</> : 'Mark discussion resolved'}</button>}
                  {threadDetail.comments.length ? renderComments(null) : <p className="threads-no-comments">No comments yet — start the discussion.</p>}
                  <form className="threads-comment-form" onSubmit={submitComment}>
                    {replyTo && <div className="threads-replying"><span>Replying to @{replyTo.username}</span><button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X size={13} /></button></div>}
                    <textarea value={commentBody} onChange={event => setCommentBody(event.target.value)} maxLength={2000} rows={2} placeholder="Write a comment or suggest a fix…" aria-label="Thread comment" />
                    <div><small>{commentBody.length}/2000</small><button type="submit" disabled={saving || !commentBody.trim()}>{saving ? 'Sending…' : 'Reply'} <Send size={13} /></button></div>
                  </form>
                </> : <p className="threads-empty">Loading comments…</p>}
              </section>}
            </div>
          </article>
        }) : <section className="threads-empty-state"><MessageSquareText size={30} /><h2>{query ? 'No results found' : 'No threads yet'}</h2><p>{query ? 'Try another search query.' : 'Start a discussion: describe a technical issue and invite the community to help.'}</p><button onClick={() => setCreateOpen(true)}><Plus size={15} /> New thread</button></section>}
      </div>
    </div>

    <aside className="threads-sidebar">
      <section className="threads-about-card"><p className="threads-sidebar-kicker">WELCOME TO THREADS</p><h2>Debug the hard stuff together.</h2><p>Ask about software, DevOps, and infrastructure. Share context, discuss fixes, and help other developers.</p><button onClick={() => setCreateOpen(true)}><Plus size={14} /> New thread</button></section>
      <section className="threads-guidelines"><h3>How to get a useful answer</h3><ol><li>Use a specific, descriptive title.</li><li>Include your environment, logs, or a minimal repro.</li><li>Explain what you have already tried.</li><li>Never share passwords or private keys.</li></ol></section>
      <section className="threads-sidebar-footer"><span>THREADS / DEV COMMUNITY</span><span>TECHNICAL · PRACTICAL · COLLABORATIVE</span></section>
    </aside>
  </main>
}
