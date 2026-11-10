import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Archive, ArrowLeft, Bell, CheckCheck, ChevronDown, ContactRound, Download, Home, Mail, MessageCircle, MessageSquareText, MoreHorizontal, Paperclip, Pencil, Pin, Plus, Radio, Search, Send, Settings, Smile, Terminal, Trash2, UsersRound, X } from 'lucide-react'
import { CHAT_ATTACHMENT_ACCEPT, CHAT_ATTACHMENT_TYPES, CHAT_FILE_LIMIT_BYTES, createChat, createSelfChat, deleteMessage, getOrCreateSelfChat, isDemoMode, listChats, listMessages, postMessage, postMessageWithFile, readChat, updateMessage } from './api/chatApi'
import { defaultProfile, loadProfile, saveProfile, type Profile } from './api/profileApi'
import type { Person } from './api/peopleApi'
import type { Chat, Message } from './types'
import { useDialogFocus } from './useDialogFocus'
import { browserStorageKey, isPublicPreview } from './api/runtime'
import HomePage from './HomePage'
import AccountDialog from './AccountDialog'
import { configurePeopleSession } from './api/peopleApi'
import AuthPage from './AuthPage'
import { AuthCheckError, BackendUnavailableError, getAuthSession, logoutAccount } from './api/authApi'
import type { AuthUser } from './api/authApi'
import CommandCenter from './CommandCenter'
import { executeAppCommand } from './commands'
import { appearanceVariables, resolveTheme } from './appearance'
import { pathForView, routeFromPath, type View, type RouteTarget } from './routes'
import { shouldAlert, sortConversations } from './preferences'
import type { DiscussionSort } from './api/discussionsApi'

const AccountPanel = lazy(() => import('./AccountPanel'))
const ContactsPanel = lazy(() => import('./ContactsPanel'))
const ChannelsView = lazy(() => import('./ChannelsView'))
const DiscussionsView = lazy(() => import('./DiscussionsView'))
const MailView = lazy(() => import('./MailView'))

type Tab = 'All' | 'Unread' | 'Community' | 'Channels' | 'My Chat'
const tabs: Tab[] = ['All', 'Community', 'Channels', 'My Chat']
const emoji = ['🖤', '🔥', '🌹', '⚡', '✨', '🤘', '❤️', '🎲']
const draftsStoragePrefix = `${browserStorageKey('messenger')}-drafts`

function ChatAvatar({ chat, small = false }: { chat: Chat; small?: boolean }) {
  return <div className={`chat-avatar ${small ? 'small' : ''}`}>
    {chat.kind === 'self' ? <span className="self-chat-mark"><Archive size={small ? 16 : 20} /></span> : <span className="chat-avatar-mark">{chat.name.trim().slice(0, 1).toUpperCase() || '#'}</span>}
    {chat.online && <i className="online-dot" />}
  </div>
}

function ProfileAvatar({ profile, className = '' }: { profile: Profile; className?: string }) {
  return <span className={`profile-avatar ${className}`}>{profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" /> : profile.displayName.trim().slice(0, 1).toUpperCase() || 'N'}</span>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useDialogFocus<HTMLDivElement>(onClose)
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="dialog-panel" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
      <div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close" onClick={onClose}><X size={20} /></button></div>
      {children}
    </div>
  </div>
}

export default function App() {
  const [systemDark,setSystemDark]=useState(()=>window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(()=>{const media=window.matchMedia('(prefers-color-scheme: dark)');const listener=()=>setSystemDark(media.matches);media.addEventListener('change',listener);return()=>media.removeEventListener('change',listener)},[])
  const [initialRoute] = useState(() => routeFromPath(window.location.pathname))
  const [authMode, setAuthMode] = useState<'checking' | 'required' | 'offline' | 'online' | 'error'>(isPublicPreview ? 'offline' : 'checking')
  const [authError, setAuthError] = useState('')
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [chats, setChats] = useState<Chat[]>([])
  // Start empty: the real self-chat id is assigned after the chat list loads.
  // Requesting a hard-coded id first produced a 404 and a false error toast.
  const [selectedId, setSelectedId] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('All')
  const [view, setViewState] = useState<View>(initialRoute.view)
  const [routeTarget, setRouteTarget] = useState<RouteTarget>(initialRoute.target)
  const [draftsOwner, setDraftsOwner] = useState('')
  const [settingsRequested, setSettingsRequested] = useState(() => window.location.pathname === '/settings')
  const [commandOpen, setCommandOpen] = useState(false)
  const [forumSearchText, setForumSearchText] = useState('')
  const [forumSort, setForumSort] = useState<DiscussionSort>('active')
  const [forumSearchKey, setForumSearchKey] = useState(0)
  const [forumSortKey, setForumSortKey] = useState(0)
  const [newThreadKey, setNewThreadKey] = useState(0)
  const [newChannelKey, setNewChannelKey] = useState(0)
  const [query, setQuery] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [olderLoaded, setOlderLoaded] = useState<Record<string, boolean>>({})
  const [noMoreOlder, setNoMoreOlder] = useState<Record<string, boolean>>({})
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [mobileChatOpen, setMobileChatOpen] = useState(false)
  const [selfChatDialogOpen, setSelfChatDialogOpen] = useState(false)
  const [selfChatName, setSelfChatName] = useState('')
  const [creatingSelfChat, setCreatingSelfChat] = useState(false)
  const [notice, setNotice] = useState('')
  const [profile, setProfile] = useState<Profile>(defaultProfile)
  const resolvedTheme=resolveTheme(profile.preferences.theme,systemDark)
  useEffect(()=>{document.documentElement.dataset.theme=resolvedTheme},[resolvedTheme])
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState('')
  const [loadingChats, setLoadingChats] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [sending, setSending] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [messageSearchOpen, setMessageSearchOpen] = useState(false)
  const [messageQuery, setMessageQuery] = useState('')
  const [editingMessageId, setEditingMessageId] = useState('')
  const [editingMessageText, setEditingMessageText] = useState('')
  const messageEndRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sendingRef = useRef(false)
  const accountDirty = useRef(false)
  const syncErrorShown = useRef(false)
  const seenMessageIds = useRef(new Map<string, Set<string>>())
  const selected = chats.find(chat => chat.id === selectedId)
  const draft = drafts[selectedId] ?? ''
  const unreadCount = chats.reduce((sum, chat) => sum + (chat.unread ?? 0), 0)
  const currentMessages = messages[selectedId] ?? []
  const draftOwner = authUser?.id ?? 'local-demo'
  const draftsStorageKey = `${draftsStoragePrefix}-${draftOwner}`
  const displayedMessages = currentMessages.filter(message => `${message.text} ${message.author}`.toLowerCase().includes(messageQuery.trim().toLowerCase()))

  function navigate(nextView: View, target: RouteTarget = {}) {
    if (view === 'account' && nextView !== 'account' && accountDirty.current && !window.confirm('Discard unsaved profile and settings changes?')) return
    if (nextView !== 'account') setSettingsRequested(false)
    setViewState(nextView)
    setRouteTarget(target)
    const nextPath = pathForView(nextView, target)
    if (window.location.pathname !== nextPath) window.history.pushState(null, '', nextPath)
  }

  function setView(nextView: View) {
    navigate(nextView)
  }

  function openProfileEditor() {
    setSettingsRequested(false)
    navigate('account')
  }

  function openSettings() {
    setSettingsRequested(true)
    setViewState('account')
    setRouteTarget({})
    if (window.location.pathname !== '/settings') window.history.pushState(null, '', '/settings')
  }

  useEffect(() => {
    if (isPublicPreview) return
    let active = true
    getAuthSession().then(session => {
      if (active) {
        configurePeopleSession(session.user?.id ?? 'local-demo', session.authenticated)
        setAuthUser(session.user)
        setAuthMode(session.authenticated ? 'online' : 'required')
      }
    }).catch(error => {
      if (!active) return
      if (error instanceof BackendUnavailableError) {
        configurePeopleSession('local-demo', false)
        setAuthUser(null)
        setAuthMode('offline')
      } else {
        setAuthError(error instanceof AuthCheckError ? error.message : 'Failed to check your session.')
        setAuthMode('error')
      }
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    function onAuthRequired() {
      if (authMode !== 'online') return
      setAuthMode('required')
      setNotice('Your session expired. Sign in again.')
    }
    window.addEventListener('nightfall:auth-required', onAuthRequired)
    return () => window.removeEventListener('nightfall:auth-required', onAuthRequired)
  }, [authMode])

  useEffect(() => {
    if (authMode === 'checking' || authMode === 'required' || authMode === 'error') return
    let active = true
    listChats().then(async data => {
      if (!active) return
      const selfChat = await getOrCreateSelfChat()
      if (!active) return
      const allChats = [selfChat, ...data.filter(chat => chat.id !== selfChat.id)]
      setChats(allChats)
      setSelectedId(id => allChats.some(chat => chat.id === id) ? id : selfChat.id)
    }).catch(() => { if (active) setNotice('Failed to load chats.') }).finally(() => { if (active) setLoadingChats(false) })
    setProfileLoading(true)
    setProfileError('')
    loadProfile(authUser?.id ?? 'local-demo').then(data => { if (active) setProfile(data) }).catch(() => { if (active) setProfileError('Could not load your profile. Reload the page to retry.') }).finally(() => { if (active) setProfileLoading(false) })
    return () => { active = false }
  }, [authMode, authUser?.id])

  useEffect(() => {
    function restoreRoute() {
      const next = routeFromPath(window.location.pathname)
      if (next.view !== 'account' && accountDirty.current && !window.confirm('Discard unsaved profile and settings changes?')) { window.history.pushState(null, '', settingsRequested ? '/settings' : '/profile/edit'); return }
      setViewState(next.view)
      setRouteTarget(next.target)
      setSettingsRequested(window.location.pathname === '/settings')
      setMobileChatOpen(false)
    }
    window.addEventListener('popstate', restoreRoute)
    return () => window.removeEventListener('popstate', restoreRoute)
  }, [settingsRequested])

  useEffect(() => {
    let restored: Record<string, string> = {}
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(draftsStorageKey) ?? '{}')
      if (saved && typeof saved === 'object' && !Array.isArray(saved)
        && Object.values(saved).every(value => typeof value === 'string')) restored = saved as Record<string, string>
      else if (saved && typeof saved === 'object') setNotice('Saved drafts had an unexpected format and were not restored.')
    } catch { setNotice('Saved drafts could not be read and were not restored.') }
    setDrafts(restored)
    setDraftsOwner(draftOwner)
  }, [draftOwner, draftsStorageKey])

  useEffect(() => {
    if (draftsOwner !== draftOwner) return
    try { localStorage.setItem(draftsStorageKey, JSON.stringify(drafts)) }
    catch { setNotice('Could not save message drafts on this device.') }
  }, [draftOwner, drafts, draftsOwner, draftsStorageKey])

  useEffect(() => {
    if (!selectedId) { setLoadingMessages(false); return }
    let active = true
    setLoadingMessages(true)
    setLoadingOlder(false)
    setMessageQuery('')
    setMessageSearchOpen(false)
    setEmojiOpen(false)
    setAttachmentFile(null)
    listMessages(selectedId, { limit: 100 }).then(data => {
      if (active) {
        seenMessageIds.current.set(selectedId, new Set(data.map(message => message.id)))
        setMessages(all => ({ ...all, [selectedId]: data }))
      }
    }).catch(() => { if (active) setNotice('Failed to load messages.') }).finally(() => { if (active) setLoadingMessages(false) })
    return () => { active = false }
  }, [selectedId])

  useEffect(() => {
    if (authMode !== 'online') return
    let active = true
    let running = false
    async function synchronize() {
      if (running) return
      running = true
      try {
        const freshChats = await listChats()
        if (!active) return
        setChats(freshChats)
        const currentChat = freshChats.find(chat => chat.id === selectedId)
        if (view === 'chats' && currentChat?.unread && profile.autoMarkRead) {
          await readChat(selectedId)
          if (!active) return
          setChats(current => current.map(chat => chat.id === selectedId ? { ...chat, unread: 0 } : chat))
        }
        if (selectedId) {
          const freshMessages = await listMessages(selectedId, { limit: 100 })
          if (active) {
            const knownIds = seenMessageIds.current.get(selectedId) ?? new Set<string>()
            const incoming = freshMessages.filter(message => !knownIds.has(message.id) && !message.own)
            for (const message of freshMessages) knownIds.add(message.id)
            seenMessageIds.current.set(selectedId, knownIds)
            setMessages(current => {
              const existing = current[selectedId] ?? []
              if (!olderLoaded[selectedId]) return { ...current, [selectedId]: freshMessages }
              const freshIds = new Set(freshMessages.map(message => message.id))
              const oldestFresh = freshMessages[0]?.createdAt ?? Number.MAX_SAFE_INTEGER
              const older = existing.filter(message => !freshIds.has(message.id) && (message.createdAt ?? 0) < oldestFresh)
              return { ...current, [selectedId]: [...older, ...freshMessages] }
            })
            const latestIncoming = incoming[incoming.length - 1]
            if (latestIncoming) {
              const isMention = profile.username && latestIncoming.text.toLowerCase().includes(`@${profile.username.toLowerCase()}`)
              const preferences = profile.preferences
              if (shouldAlert(profile, currentChat?.kind, latestIncoming.text)) {
                const title = isMention ? 'You were mentioned on Nightfall' : 'New Nightfall message'
                const body = preferences.notificationPreview ? `${latestIncoming.author}: ${latestIncoming.text || 'Sent an attachment.'}` : 'Open Nightfall to read your message.'
                if (preferences.inAppNotifications) setNotice(body)
                if (preferences.desktopNotifications && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
                  new Notification(title, { body })
                }
              }
            }
          }
        }
        syncErrorShown.current = false
      } catch {
        if (active && !syncErrorShown.current) {
          syncErrorShown.current = true
          setNotice('Live updates are temporarily unavailable.')
        }
      } finally { running = false }
    }
    const timer = window.setInterval(() => { void synchronize() }, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [authMode, olderLoaded, profile.autoMarkRead, profile.preferences, profile.username, selectedId, view])

  useEffect(() => { if (profile.preferences.autoScroll) messageEndRef.current?.scrollIntoView({ behavior: profile.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'end' }) }, [currentMessages.length, selectedId, profile.reduceMotion, profile.preferences.autoScroll])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 6000)
    return () => clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    if (!emojiOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setEmojiOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [emojiOpen])
  useEffect(() => {
    function openCommandCenter(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(true)
      }
    }
    document.addEventListener('keydown', openCommandCenter)
    return () => document.removeEventListener('keydown', openCommandCenter)
  }, [])

  const filteredChats = useMemo(() => sortConversations(chats.filter(chat => {
    const match = `${chat.name} ${chat.handle ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())
    return match && (activeTab === 'All'
      || (activeTab === 'Unread' && !!chat.unread)
      || (activeTab === 'Community' && chat.kind === 'group')
      || (activeTab === 'Channels' && chat.kind === 'channel')
      || (activeTab === 'My Chat' && chat.kind === 'self'))
  }), profile.preferences.sortChats), [chats, activeTab, query, profile.preferences.sortChats])

  function setDraft(value: string) { setDrafts(all => ({ ...all, [selectedId]: value })) }

  async function openChat(chat: Chat) {
    setSelectedId(chat.id)
    setMobileChatOpen(true)
    if (chat.unread && profile.autoMarkRead) {
      try {
        await readChat(chat.id)
        setChats(all => all.map(item => item.id === chat.id ? { ...item, unread: 0 } : item))
      } catch { setNotice('Failed to mark chat as read.') }
    }
  }

  async function sendMessage() {
    const text = draft.trim()
    const file = attachmentFile
    if ((!text && !file) || !selected || sendingRef.current || loadingMessages) return
    const chatId = selected.id
    const submittedDraft = draft
    sendingRef.current = true
    setSending(true)
    try {
      const message = file ? await postMessageWithFile(chatId, text, file) : await postMessage(chatId, text)
      setMessages(all => ({ ...all, [chatId]: [...(all[chatId] ?? []), message] }))
      setChats(all => all.map(chat => chat.id === chatId ? { ...chat, lastMessage: text || (file ? `File: ${file.name}` : ''), time: message.time, updatedAt: new Date().toISOString() } : chat))
      setDrafts(all => all[chatId] === submittedDraft ? { ...all, [chatId]: '' } : all)
      setAttachmentFile(current => current === file ? null : current)
      if (file && fileInputRef.current) fileInputRef.current.value = ''
      setEmojiOpen(false)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Message was not sent. Please try again.')
    }
    finally { sendingRef.current = false; setSending(false); composerRef.current?.focus() }
  }

  async function loadOlderMessages() {
    if (!selectedId || loadingOlder) return
    const oldest = currentMessages[0]
    if (!oldest?.createdAt) return
    setLoadingOlder(true)
    try {
      const older = await listMessages(selectedId, { limit: 100, before: oldest.createdAt })
      const existingIds = new Set((messages[selectedId] ?? []).map(message => message.id))
      const additions = older.filter(message => !existingIds.has(message.id))
      if (older.length < 100) setNoMoreOlder(all => ({ ...all, [selectedId]: true }))
      setMessages(all => ({ ...all, [selectedId]: [...additions, ...(all[selectedId] ?? [])] }))
      setOlderLoaded(all => ({ ...all, [selectedId]: true }))
    } catch {
      setNotice('Could not load older messages. Please try again.')
    } finally {
      setLoadingOlder(false)
    }
  }

  async function saveMessageEdit(message: Message) {
    if (!selected || !editingMessageText.trim()) return
    try {
      const updated = await updateMessage(selected.id, message.id, editingMessageText)
      setMessages(all => ({ ...all, [selected.id]: (all[selected.id] ?? []).map(item => item.id === message.id ? updated : item) }))
      setEditingMessageId('')
      setEditingMessageText('')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not edit message.')
    }
  }

  async function removeMessage(message: Message) {
    if (!selected || (profile.preferences.confirmDelete && !window.confirm('Delete this message?'))) return
    try {
      await deleteMessage(selected.id, message.id)
      setMessages(all => ({ ...all, [selected.id]: (all[selected.id] ?? []).filter(item => item.id !== message.id) }))
      if (editingMessageId === message.id) setEditingMessageId('')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete message.')
    }
  }

  async function chatWithPerson(person: Person) {
    const existing = chats.find(chat => chat.peerId === person.id || (chat.id === person.id && chat.kind === 'dm'))
    if (existing) { await openChat(existing); setView('chats'); return }
    try {
      const chat = await createChat(person.displayName, person.id)
      setChats(all => [chat, ...all.filter(item => item.id !== chat.id)])
      setMessages(all => ({ ...all, [chat.id]: [] }))
      setSelectedId(chat.id)
      setMobileChatOpen(true)
      setView('chats')
    } catch { setNotice('Failed to open direct message.') }
  }

  async function createPrivateChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = selfChatName.trim()
    if (!name || creatingSelfChat) return
    setCreatingSelfChat(true)
    try {
      const chat = await createSelfChat(name)
      setChats(all => [chat, ...all.filter(item => item.id !== chat.id)])
      setMessages(all => ({ ...all, [chat.id]: [] }))
      setSelectedId(chat.id)
      setActiveTab('My Chat')
      setView('chats')
      setMobileChatOpen(true)
      setSelfChatName('')
      setSelfChatDialogOpen(false)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create your private chat.')
    } finally {
      setCreatingSelfChat(false)
    }
  }

  if (authMode === 'checking') {
    return <main className="auth-shell auth-loading"><div className="auth-loading-card"><span className="auth-brand-mark">N<span>✦</span></span><p>Checking your secure session…</p></div></main>
  }
  if (authMode === 'error') {
    return <main className="auth-shell auth-loading"><div className="auth-loading-card"><span className="auth-brand-mark">N<span>✦</span></span><p role="alert">{authError}</p><button className="auth-retry" onClick={() => { setAuthMode('checking'); getAuthSession().then(session => { configurePeopleSession(session.user?.id ?? 'local-demo', session.authenticated); setAuthUser(session.user); setAuthMode(session.authenticated ? 'online' : 'required') }).catch(error => { if (error instanceof BackendUnavailableError) { configurePeopleSession('local-demo', false); setAuthMode('offline') } else { setAuthError(error instanceof AuthCheckError ? error.message : 'Failed to check your session.'); setAuthMode('error') } }) }}>Retry</button></div></main>
  }
  if (authMode === 'required') {
    return <AuthPage onAuthenticated={user => { configurePeopleSession(user.id, true); setAuthUser(user); setAuthMode('online') }} />
  }

  async function signOut() {
    try {
      await logoutAccount()
      configurePeopleSession('local-demo', false)
      setChats([])
      setMessages({})
      setProfile(defaultProfile)
      setAuthUser(null)
      setAuthMode('required')
    } catch {
      setNotice('Failed to sign out. Please try again.')
    }
  }

  function runAppCommand(input: string) {
    return executeAppCommand(input, {
      navigate: destination => {
        setView(destination)
        if (destination === 'chats') setActiveTab('All')
        setMobileChatOpen(false)
      },
      openProfile: () => setView('home'),
      createThread: () => {
        setView('discussions')
        setNewThreadKey(value => value + 1)
      },
      createChannel: () => {
        setView('channels')
        setNewChannelKey(value => value + 1)
      },
      searchThreads: search => {
        setForumSearchText(search)
        setForumSearchKey(value => value + 1)
        setView('discussions')
      },
      sortThreads: order => {
        setForumSort(order)
        setForumSortKey(value => value + 1)
        setView('discussions')
      },
      status: () => `Status: ${authMode === 'online' ? 'account connected' : authMode === 'offline' ? 'local mode' : 'checking API'}; chats: ${loadingChats ? 'loading' : chats.length}.`,
      logout: () => {
        if (authMode === 'online') void signOut()
        else setNotice('You are using local mode — there is no server account to sign out from.')
      },
    })
  }

  return <main data-theme={resolvedTheme} style={appearanceVariables(profile.preferences,resolvedTheme)} className={`app-shell ${view === 'home' || view === 'account' ? 'hub-mode' : ''} ${profile.pixelGrid ? '' : 'no-pixel-grid'} ${profile.reduceMotion ? 'reduced-motion' : ''} ${profile.preferences.highContrast ? 'higher-contrast' : ''} ${profile.preferences.largeControls ? 'large-controls' : ''} ${profile.preferences.showAvatars ? '' : 'hide-message-avatars'} ${profile.preferences.showTimestamps ? '' : 'hide-message-times'} ${profile.preferences.showReactions ? '' : 'hide-message-reactions'} ${profile.preferences.showChatTimes ? '' : 'hide-chat-times'} ${profile.preferences.showOnlineIndicators ? '' : 'hide-online-indicators'} ${profile.preferences.showComposerHints ? '' : 'hide-composer-hints'}`} data-accent={profile.preferences.accent} data-message-size={profile.preferences.fontSize} data-chat-background={profile.preferences.chatBackground} data-bubble-style={profile.preferences.bubbleStyle}>
    <header className="masthead">
      <button className="wordmark" type="button" aria-label="Open your profile" title="Open your profile" onClick={() => setView('home')}><span className="wordmark-mark" aria-hidden="true">{profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" /> : 'N'}</span><div><strong>NIGHTFALL<span>®</span></strong><small>DEVOPS · CODE · COMMUNITY</small></div></button>
      <div className="masthead-edition"><span>✦</span> DEV BOARD <span>✦</span></div>
      <div className="masthead-actions"><span className="session-badge"><i />{isPublicPreview ? 'Demo preview' : loadingChats ? 'Connecting' : isDemoMode() ? 'Local mode' : 'API connected'}</span><button className="command-mobile-launch" aria-label="Open commands" title="Commands · Ctrl+K" onClick={() => setCommandOpen(true)}><Terminal size={18} /></button><button className={`unread-launch ${view === 'chats' && activeTab === 'Unread' ? 'active' : ''}`} aria-label={`Unread messages${unreadCount ? `: ${unreadCount}` : ''}`} title="Unread messages" onClick={() => { setView('chats'); setActiveTab('Unread'); setMobileChatOpen(false) }}><Bell size={17} /><span>Unread</span>{profile.notifications && unreadCount > 0 && <b>{unreadCount > 99 ? '99+' : unreadCount}</b>}</button><button className="settings-launch" aria-label="Settings" title="Settings" onClick={openSettings}><Settings size={17} /><span>Settings</span></button><button className="user-menu" aria-label="Open profile" onClick={() => setView('home')}><ProfileAvatar profile={profile} /><span>{profile.displayName}<small>{profile.showOnline ? profile.status || 'No status' : 'Status hidden'}</small></span><ChevronDown size={14} /></button></div>
    </header>

    <div className={`workspace-grid ${view === 'home' || view === 'account' ? 'hub-grid' : view === 'channels' ? 'channels-grid' : view === 'discussions' ? 'discussions-grid' : view === 'mail' ? 'mail-grid' : view === 'contacts' ? 'people-grid' : view === 'chats' ? 'chat-grid' : ''}`}>
      <aside className="rail">
        <nav className="rail-nav" aria-label="Navigation">
          <button className={`rail-button ${view === 'home' ? 'active' : ''}`} aria-label="Home feed" title="Home feed" onClick={() => { setView('home'); setMobileChatOpen(false) }}><Home size={21} /><span>My page</span></button>
          <button className={`rail-button ${view === 'chats' && activeTab !== 'Community' ? 'active' : ''}`} aria-label="Messages" title="Messages" onClick={() => { setView('chats'); setActiveTab('All'); setMobileChatOpen(false) }}><MessageCircle size={21} /><span>Messages</span></button>
          <button className={`rail-button ${view === 'discussions' ? 'active' : ''}`} aria-label="Threads" title="Threads" onClick={() => { setView('discussions'); setMobileChatOpen(false) }}><MessageSquareText size={21} /><span>Threads</span></button>
          <button className={`rail-button ${view === 'channels' ? 'active' : ''}`} aria-label="Channels" title="Channels" onClick={() => { setView('channels'); setMobileChatOpen(false) }}><Radio size={20} /><span>Channels</span></button>
          <button className={`rail-button ${view === 'mail' ? 'active' : ''}`} aria-label="Mail" title="Nightfall Mail" onClick={() => setView('mail')}><Mail size={20} /><span>Mail</span></button>
          <button className={`rail-button ${view === 'contacts' ? 'active' : ''}`} aria-label="Contacts" title="Contacts" onClick={() => { setView('contacts'); setMobileChatOpen(false) }}><ContactRound size={21} /><span>Contacts</span></button>
          <button className={`rail-button ${view === 'chats' && activeTab === 'Community' ? 'active' : ''}`} aria-label="Community conversations" title="Community" onClick={() => { setView('chats'); setActiveTab('Community'); setMobileChatOpen(false) }}><UsersRound size={21} /><span>Community</span></button>
        </nav>
        <div className="rail-bottom">

          <button className="rail-button" aria-label="Command center" title="Commands · Ctrl+K" onClick={() => setCommandOpen(true)}><Terminal size={21} /><span>Commands</span></button>
        </div>
      </aside>

      <Suspense fallback={<div className="workspace-loading" role="status">Loading workspace…</div>}>
      {view === 'home' || view === 'account' ? profileLoading || profileError ? <div className="workspace-loading" role={profileError?'alert':'status'}>{profileError||'Loading your page…'}{profileError&&<button onClick={()=>window.location.reload()}>Reload</button>}</div> : <>
        <HomePage userId={authUser?.id??'local-demo'} profile={profile} onEdit={openProfileEditor} onSettings={openSettings} onOpenThreads={()=>setView('discussions')} onNotice={setNotice} onOpenPerson={id=>navigate('contacts',{personId:id})} onOpenChannel={id=>navigate('channels',{channelId:id})} />
        {view==='account'&&<AccountDialog title={settingsRequested?'Settings':'Edit profile'} onClose={()=>setView('home')}><AccountPanel key={view} profile={profile} initialTab={settingsRequested ? 'preferences' : 'edit'} onTabChange={tab => { setSettingsRequested(tab === 'preferences'); const path = tab === 'preferences' ? '/settings' : tab === 'profile' ? '/' : '/profile/edit'; if (window.location.pathname !== path) window.history.pushState(null, '', path) }} onClearDrafts={() => setDrafts({})} onDirtyChange={dirty => { accountDirty.current = dirty }} onClose={() => setView('home')} onSave={async next => { const saved = await saveProfile(next); setProfile(saved); setAuthUser(current => current ? { ...current, firstName: saved.firstName, lastName: saved.lastName, username: saved.username } : current) }} onLogout={authMode === 'online' ? signOut : undefined} /></AccountDialog>}
      </> : view === 'mail' ? <MailView /> : view === 'channels' ? <ChannelsView displayName={profile.displayName} username={profile.username} userId={authUser?.id ?? 'local-demo'} createKey={newChannelKey} initialChannelId={routeTarget.channelId} onChannelChange={channelId => navigate('channels', { channelId: channelId ?? undefined })} /> : view === 'contacts' ? <ContactsPanel initialPersonId={routeTarget.personId} userId={authUser?.id ?? 'local-demo'} displayName={profile.displayName} username={profile.username} onChat={chatWithPerson} onOpenThreads={() => setView('discussions')} onNotice={setNotice} /> : view === 'discussions' ? <DiscussionsView userId={authUser?.id ?? 'local-demo'} displayName={profile.displayName} username={profile.username} initialSearch={forumSearchText} initialSort={forumSort} searchKey={forumSearchKey} sortKey={forumSortKey} createKey={newThreadKey} initialThreadId={routeTarget.threadId} onThreadChange={threadId => navigate('discussions', { threadId: threadId ?? undefined })} /> : <>
      <section className="chat-list-panel" aria-label="Chat list">
        <header className="list-header"><div><p className="eyebrow">{'DISCUSSION / MESSAGES'}</p><h1>{'Messages'}<span>.</span></h1></div>{view === 'chats' && activeTab === 'My Chat' && <button className="create-self-chat-button" onClick={() => setSelfChatDialogOpen(true)}><Plus size={15} /><span>New private chat</span></button>}</header>
        <nav className="list-view-tabs" aria-label="List view"><button className={view === 'chats' ? 'active' : ''} onClick={() => setView('chats')}><MessageCircle size={14} /> Messages</button><button className="" onClick={() => setView('contacts')}><ContactRound size={14} /> Contacts</button><button className="mobile-channel-tab" onClick={() => setView('channels')}><Radio size={14} /> Channels</button></nav>
        {<>
          <div className="search-box"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search conversations…" aria-label="Search conversations" />{query && <button className="clear-search" aria-label="Clear conversation search" onClick={() => setQuery('')}><X size={14} /></button>}</div>
          <div className="tabs">{tabs.map(tab => <button key={tab} className={activeTab === tab ? 'selected' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>
          <div className={`conversation-list ${profile.compactMode ? 'compact' : ''}`}>
            {loadingChats ? <p className="empty-list">Loading messages…</p> : filteredChats.length ? filteredChats.map(chat => <button key={chat.id} className={`conversation ${selectedId === chat.id ? 'current' : ''}`} aria-pressed={selectedId === chat.id} onClick={() => void openChat(chat)}>
              <ChatAvatar chat={chat} /><span className="conversation-copy"><strong>{chat.name}{chat.pinned && <Pin size={10} />}</strong><small>{profile.showMessagePreview ? chat.lastMessage : 'Open conversation to view messages'}</small></span><span className="conversation-meta"><time>{chat.time}</time>{!!chat.unread ? <b>{chat.unread}</b> : <span className="read-indicator">✦</span>}</span>
            </button>) : <div className="empty-list"><Search size={24} /><strong>No messages found</strong><span>Try another search or start a new conversation.</span></div>}
          </div>
        </>}
        <div className="sidebar-flash"><pre className="sidebar-ascii-art" aria-hidden="true">{`     .----.      .----.
    / .--. \\    / .--. \\
   | | [] | |  | | [] | |
   | |____| |  | |____| |
    \\______/    \\______/
       ||   NIGHTFALL   ||
   ____||______________||____
  /  DEVOPS  //  COMMUNITY  /`}</pre><p>Debug <em>together.</em></p><span>DEVOPS / CODE / TEAM CHAT</span></div>
      </section>

      <section className={`conversation-view ${mobileChatOpen ? 'mobile-chat-open' : ''}`} aria-label="Conversation">
        {selected ? <>
          <header className={`conversation-header ${selected.kind === 'channel' ? 'channel-header' : ''}`}><button className="icon-button mobile-menu" onClick={() => setMobileChatOpen(false)} aria-label="Back to messages"><ArrowLeft size={21} /></button><ChatAvatar chat={selected} /><div className="header-title"><strong>{selected.name}</strong><span><i />{selected.kind === 'self' ? 'Private notes · files stay in your account' : selected.kind === 'channel' ? 'Channel · owner posts' : selected.kind === 'group' ? 'Community conversation' : selected.online ? 'Online' : selected.handle ? `@${selected.handle}` : 'Direct message'}</span></div><div className="header-actions"><button className={`icon-button ${messageSearchOpen ? 'is-active' : ''}`} aria-label="Search messages" aria-expanded={messageSearchOpen} onClick={() => { setMessageSearchOpen(value => !value); setMessageQuery('') }}><Search size={19} /></button><button className="icon-button" aria-label="Chat info" onClick={() => setInfoOpen(true)}><MoreHorizontal size={22} /></button></div></header>
          {messageSearchOpen && <div className="message-search"><Search size={16} /><input autoFocus value={messageQuery} onChange={event => setMessageQuery(event.target.value)} placeholder="Search this conversation…" aria-label="Search message text" /><button className="icon-button" aria-label="Close message search" onClick={() => { setMessageSearchOpen(false); setMessageQuery('') }}><X size={17} /></button></div>}
          <div className="message-stage" aria-busy={loadingMessages}>
            <div className="date-divider"><span /> <span>MESSAGE HISTORY</span> <span /></div>
            {!loadingMessages && currentMessages.length >= 100 && !noMoreOlder[selectedId] && <button type="button" className="load-older-messages" onClick={() => void loadOlderMessages()} disabled={loadingOlder}>{loadingOlder ? 'Loading older…' : 'Load older messages'}</button>}
            {loadingMessages ? <p className="loading-copy">Loading messages…</p> : currentMessages.length === 0 ? <div className="empty-conversation"><pre className="conversation-ascii-art" aria-hidden="true">{`   .------.
  /  ____  \\
 |  |    |  |
 |  |____|  |
 |  NIGHT   |
 '----------'`}</pre><h3>{selected.kind === 'self' ? 'Your private space.' : 'Start the conversation.'}</h3><p>{selected.kind === 'self' ? 'Keep notes, links, and useful files here.' : 'Send the first message.'}</p></div> : displayedMessages.length === 0 ? <p className="loading-copy">No messages match this query.</p> : displayedMessages.map(message => <article className={`message-row ${message.own ? 'own' : ''}`} key={message.id}>
              {message.own ? <ProfileAvatar profile={profile} /> : <div className="message-avatar"><span>{message.author.trim().slice(0, 1).toUpperCase() || '?'}</span></div>}
              <div className="message-content"><div className="message-meta"><strong>{message.own ? profile.displayName : message.author}</strong><time>{message.time}</time>{message.edited && <small className="message-edited">edited</small>}{message.own && <CheckCheck size={13} aria-label="Sent" />}{message.own && selected.kind !== 'channel' && <span className="message-actions"><button type="button" aria-label="Edit message" title="Edit message" onClick={() => { setEditingMessageId(message.id); setEditingMessageText(message.text) }}><Pencil size={12} /></button><button type="button" aria-label="Delete message" title="Delete message" onClick={() => void removeMessage(message)}><Trash2 size={12} /></button></span>}</div>{editingMessageId === message.id ? <form className="message-edit-form" onSubmit={event => { event.preventDefault(); void saveMessageEdit(message) }}><textarea value={editingMessageText} onChange={event => setEditingMessageText(event.target.value)} maxLength={4000} autoFocus /><button type="submit" disabled={!editingMessageText.trim()}>Save</button><button type="button" onClick={() => setEditingMessageId('')}>Cancel</button></form> : message.text && <div className="bubble">{message.text}</div>}{message.attachmentData && <a className="message-file" href={message.attachmentData} download={message.attachmentName || 'download'}><Download size={15} /><span>{message.attachmentName || 'Attached file'}</span><small>{message.attachmentType || 'FILE'}</small></a>}{message.reactions && <div className="reactions">{message.reactions.map(reaction => <span key={reaction}>{reaction}</span>)}</div>}</div>
            </article>)}<div ref={messageEndRef} />
          </div>
          <div className={`composer-area ${selected.kind === 'channel' ? 'channel-composer-area' : ''}`}><form className="composer" onSubmit={event => { event.preventDefault(); void sendMessage() }}><span className="composer-mark" aria-hidden="true">{selected.kind === 'channel' ? '#' : selected.kind === 'self' ? '$' : '>'}</span>          <textarea rows={1} spellCheck={profile.preferences.spellCheck} ref={composerRef} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && ((profile.sendOnEnter && !event.shiftKey) || event.ctrlKey || event.metaKey)) { event.preventDefault(); void sendMessage() } }} placeholder={selected.kind === 'channel' ? 'Publish an update or link…' : selected.kind === 'self' ? 'Write a note or attach a file…' : 'Write a message…'} aria-label={selected.kind === 'channel' ? 'Channel post' : selected.kind === 'self' ? 'Private note' : 'Message'} maxLength={4000} disabled={loadingMessages} />{selected.kind === 'self' && <><input ref={fileInputRef} hidden type="file" accept={CHAT_ATTACHMENT_ACCEPT} onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (!(CHAT_ATTACHMENT_TYPES as readonly string[]).includes(file.type)) { setAttachmentFile(null); setNotice('This file type is not supported. Choose an image, PDF, text, video, or audio file.'); event.target.value = ''; return } if (file.size > CHAT_FILE_LIMIT_BYTES) { setAttachmentFile(null); setNotice('Files must be 1 MB or smaller.'); event.target.value = ''; return } setAttachmentFile(file); event.target.value = '' }} /><button type="button" className={`icon-button ${attachmentFile ? 'is-active' : ''}`} aria-label={attachmentFile ? `Selected file: ${attachmentFile.name}` : 'Attach a file'} title={attachmentFile?.name ?? 'Attach a file · 1 MB max'} onClick={() => fileInputRef.current?.click()}><Paperclip size={19} /></button></>}{attachmentFile && <span className="composer-file-name" title={attachmentFile.name}>{attachmentFile.name}<button type="button" aria-label="Remove attached file" onClick={() => { setAttachmentFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}><X size={12} /></button></span>}<div className="emoji-anchor"><button type="button" className={`icon-button ${emojiOpen ? 'is-active' : ''}`} aria-label="Choose emoji" aria-expanded={emojiOpen} onClick={() => setEmojiOpen(value => !value)}><Smile size={21} /></button>{emojiOpen && <div className="emoji-picker" role="group" aria-label="Emoji picker">{emoji.map(item => <button key={item} type="button" aria-label={`Add ${item}`} onClick={() => { setDraft(`${draft}${item}`); setEmojiOpen(false); composerRef.current?.focus() }}>{item}</button>)}</div>}</div><button type="submit" className="send-button" aria-label={selected.kind === 'channel' ? 'Publish' : selected.kind === 'self' ? `Save to ${selected.name}` : 'Send'} disabled={(!draft.trim() && !attachmentFile) || sending || loadingMessages}><Send size={18} /><span>{sending ? 'Saving…' : selected.kind === 'channel' ? 'Publish' : selected.kind === 'self' ? 'Save' : 'Send'}</span></button></form><div className="composer-footnote"><span>{selected.kind === 'channel' ? 'CHANNEL POST' : selected.kind === 'self' ? 'PRIVATE STORAGE · 1 MB FILE LIMIT' : profile.sendOnEnter ? 'ENTER — SEND' : 'CTRL/⌘ + ENTER — SEND'}</span><span>{selected.kind === 'channel' ? 'OWNER PUBLISH MODE' : selected.kind === 'self' ? 'VISIBLE ONLY TO YOU' : 'DIRECT MESSAGE'}</span></div></div>
        </> : <div className="empty-conversation empty-main"><pre className="conversation-ascii-art" aria-hidden="true">{`  [ NIGHTFALL ]
  > messages_
  > contacts_
  > community_`}</pre><h2>{loadingChats ? 'Loading messages…' : 'Select a conversation.'}</h2><p>{loadingChats ? 'Loading your workspace.' : 'Choose My Chat or start a conversation from Contacts.'}</p></div>}
      </section>

      </>}
      </Suspense>
    </div>
    <footer className="app-footer"><span>NIGHTFALL DEV BOARD</span><span>DEVOPS / PROGRAMMING / OPEN DISCUSSION <i>✦</i> SYSTEM ONLINE</span></footer>
    {notice && <div className="toast" role="status">{notice}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={16} /></button></div>}
    {commandOpen && <CommandCenter onClose={() => setCommandOpen(false)} onExecute={runAppCommand} />}
    {selfChatDialogOpen && <Modal title="Create a private chat" onClose={() => { if (!creatingSelfChat) setSelfChatDialogOpen(false) }}><form className="create-self-chat-form" onSubmit={event => void createPrivateChat(event)}><p>Name this private space for notes, links, or files. Only you can see its contents.</p><label>CHAT NAME<input autoFocus value={selfChatName} onChange={event => setSelfChatName(event.target.value)} maxLength={80} placeholder="e.g. Project ideas" required /></label><div><button type="button" onClick={() => setSelfChatDialogOpen(false)} disabled={creatingSelfChat}>Cancel</button><button type="submit" disabled={creatingSelfChat || !selfChatName.trim()}>{creatingSelfChat ? 'Creating…' : 'Create chat'} <Plus size={14} /></button></div></form></Modal>}
    {infoOpen && selected && <Modal title="Chat details" onClose={() => setInfoOpen(false)}><div className="chat-info"><ChatAvatar chat={selected} /><h3>{selected.name}</h3><p>{selected.kind === 'self' ? 'Private notes and file storage' : selected.kind === 'dm' ? 'Direct message' : selected.kind === 'group' ? 'Group chat' : 'Channel'}{selected.handle ? ` · @${selected.handle}` : ''}</p><div><span>Messages in history</span><strong>{currentMessages.length}</strong></div><div><span>Storage</span><strong>{isDemoMode() ? 'This browser' : 'Server'}</strong></div></div></Modal>}
  </main>
}
