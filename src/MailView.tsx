import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, Inbox, Mail as MailIcon, PenLine, Plus, RefreshCw, Send } from 'lucide-react'
import { getMailbox, getMailboxes, isLocalMailMode, listMail, registerMailbox, sendMail, type MailFolder, type MailMessage, type MailboxAccount } from './api/mailApi'
import { getAuthConfig, sendInvitation } from './api/authApi'
import './mail.css'

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function MailView() {
  const [folder, setFolder] = useState<MailFolder>('inbox')
  const [mailbox, setMailbox] = useState('')
  const [mailboxes, setMailboxes] = useState<MailboxAccount[]>([])
  const [messages, setMessages] = useState<MailMessage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [composing, setComposing] = useState(false)
  const [showMailboxForm, setShowMailboxForm] = useState(false)
  const [error, setError] = useState('')
  const [recipient, setRecipient] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [newMailboxLabel, setNewMailboxLabel] = useState('Nightfall Site')
  const [newMailboxAddress, setNewMailboxAddress] = useState('nf@gmail.com')
  const [localMode, setLocalMode] = useState(isLocalMailMode())
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [noMoreOlder, setNoMoreOlder] = useState(false)
  const [inviteAvailable, setInviteAvailable] = useState(false)
  const [inviteFormOpen, setInviteFormOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteNotice, setInviteNotice] = useState('')

  const refresh = useCallback(async (targetFolder: MailFolder = folder, activeMailbox = mailbox) => {
    setLoading(true)
    setError('')
    try {
      const [account, accounts, items] = await Promise.all([
        getMailbox(activeMailbox),
        getMailboxes(),
        listMail(targetFolder, activeMailbox),
      ])
      setMailbox(account.address)
      setMailboxes(accounts)
      setMessages(items)
      setLocalMode(isLocalMailMode())
      setNoMoreOlder(items.length < 100)
      setSelectedId(current => items.some(item => item.id === current) ? current : items[0]?.id ?? null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load Nightfall Mail.')
    } finally {
      setLoading(false)
    }
  }, [folder])

  useEffect(() => { void refresh(folder) }, [folder, refresh])
  useEffect(() => {
    if (localMode) return
    let active = true
    getAuthConfig().then(config => { if (active) setInviteAvailable(config.invitationsAvailable) }).catch(() => {})
    return () => { active = false }
  }, [localMode])

  const selected = useMemo(() => messages.find(message => message.id === selectedId) ?? null, [messages, selectedId])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)
    setError('')
    try {
      await sendMail({ recipient: recipient.trim(), subject: subject.trim(), body }, mailbox)
      setRecipient('')
      setSubject('')
      setBody('')
      setComposing(false)
      if (folder === 'sent') await refresh('sent', mailbox)
      else setFolder('sent')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send this message.')
    } finally {
      setSending(false)
    }
  }

  async function addMailbox(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      const registered = await registerMailbox(newMailboxLabel.trim() || 'Nightfall Site', newMailboxAddress)
      const nextMailboxes = [registered, ...mailboxes.filter(item => item.id !== registered.id)]
      setMailboxes(nextMailboxes)
      setMailbox(registered.address)
      setShowMailboxForm(false)
      setNewMailboxLabel('Nightfall Site')
      setNewMailboxAddress('nf@gmail.com')
      await refresh('inbox', registered.address)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not attach this mailbox.')
    }
  }

  async function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inviteSending) return
    setInviteSending(true)
    setInviteNotice('')
    setError('')
    try {
      const result = await sendInvitation(inviteEmail.trim())
      setInviteNotice(result.message)
      setInviteEmail('')
      setInviteFormOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send this invitation.')
    } finally {
      setInviteSending(false)
    }
  }

  async function loadOlder() {
    const oldest = messages[messages.length - 1]
    if (!oldest || loadingOlder) return
    setLoadingOlder(true)
    setError('')
    try {
      const older = await listMail(folder, mailbox, { limit: 100, before: oldest.sentAt })
      if (older.length === 0) setNoMoreOlder(true)
      setMessages(current => [...current, ...older.filter(item => !current.some(existing => existing.id === item.id))])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load older messages.')
    } finally {
      setLoadingOlder(false)
    }
  }

  const isInbox = folder === 'inbox'

  return (
    <section className="mail-view" aria-label="Nightfall Mail">
      <header className="mail-header">
        <div>
          <p className="mail-eyebrow">PRIVATE IN-APP MESSAGING</p>
          <h1>Nightfall <span>Mail</span></h1>
          <p className="mail-address">Your mailbox <strong>{mailbox || 'Loading…'}</strong></p>
        </div>
        <div className="mail-header-actions">
          {inviteAvailable && <button className="mail-secondary-button" onClick={() => { setInviteFormOpen(value => !value); setInviteNotice(''); setError('') }} type="button">
            <MailIcon size={15} /> Invite by email
          </button>}
          {localMode && <button className="mail-secondary-button" onClick={() => setShowMailboxForm(value => !value)} type="button">
            <Plus size={15} /> Add mailbox
          </button>}
          <button className="mail-compose-button" onClick={() => { setError(''); setComposing(true) }} type="button">
            <PenLine size={15} /> Compose
          </button>
        </div>
      </header>

      {inviteAvailable && inviteFormOpen && <form className="mail-invite-form" onSubmit={submitInvitation}>
        <label>FRIEND'S EMAIL<input type="email" autoComplete="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} maxLength={254} placeholder="friend@example.com" required /></label>
        <p>Nightfall sends a welcome invitation from the configured Gmail address. The link opens registration with the invite code filled in.</p>
        <button type="submit" className="mail-send-button" disabled={inviteSending}>{inviteSending ? 'Sending…' : 'Send invitation'}</button>
      </form>}
      {inviteNotice && <div className="mail-notice" role="status"><MailIcon size={16} /><span>{inviteNotice}</span></div>}

      {localMode && showMailboxForm && (
        <form className="mail-mailbox-form" onSubmit={addMailbox}>
          <label>
            Label
            <input value={newMailboxLabel} onChange={event => setNewMailboxLabel(event.target.value)} maxLength={64} placeholder="Nightfall Site" />
          </label>
          <label>
            Address
            <input value={newMailboxAddress} onChange={event => setNewMailboxAddress(event.target.value)} placeholder="nf@gmail.com" maxLength={64} required />
          </label>
          <button type="submit" className="mail-send-button">Attach mailbox</button>
        </form>
      )}

      <div className="mail-accounts" aria-label="Attached mailboxes">
        {mailboxes.map(account => (
          <button
            key={account.id}
            type="button"
            className={`mail-account-pill ${mailbox === account.address ? 'active' : ''}`}
            onClick={async () => {
              if (mailbox === account.address) return
              setMailbox(account.address)
              await refresh(folder, account.address)
            }}
          >
            <span>{account.label}</span>
            <small>{account.address}</small>
          </button>
        ))}
      </div>

      <aside className="mail-notice">
        <MailIcon size={16} />
        <span>{localMode ? 'Local demo mail: attach extra inboxes, register a site address such as nf@gmail.com, and send within this browser.' : 'Nightfall Mail stays inside this app. Your verified server mailbox is username@nf.com; messages are delivered to other registered accounts.'}</span>
      </aside>

      {error && <div className="mail-error" role="alert">{error}</div>}

      {composing ? (
        <form className="mail-compose" onSubmit={submit}>
          <div className="mail-compose-title">
            <h2>New message</h2>
            <button type="button" className="mail-back" onClick={() => setComposing(false)} aria-label="Back to mailbox"><ArrowLeft size={17} /></button>
          </div>
          <label>To <span>Nightfall or attached mailbox</span>
            <input autoComplete="email" type="text" value={recipient} onChange={event => setRecipient(event.target.value)} placeholder={localMode ? 'username@nf.com or nf@gmail.com' : 'username@nf.com'} maxLength={64} required />
          </label>
          <div className="mail-recipient-suggestions" aria-label="Mailbox suggestions">
            {mailboxes.map(account => (
              <button type="button" key={account.id} onClick={() => setRecipient(account.address)}>{account.label}</button>
            ))}
          </div>
          <label>Subject
            <input value={subject} onChange={event => setSubject(event.target.value)} placeholder="What’s this about?" maxLength={160} required />
          </label>
          <label>Message
            <textarea value={body} onChange={event => setBody(event.target.value)} placeholder="Write a short message…" maxLength={20000} rows={10} required />
            <span className="mail-counter">{body.length.toLocaleString()} / 20,000</span>
          </label>
          <div className="mail-compose-footer">
            <p>{localMode ? 'Local mode accepts any mailbox address in this browser. Server mode delivers only to registered, verified Nightfall mailboxes.' : 'Only registered, verified Nightfall mailboxes can receive messages. Use username@nf.com.'}</p>
            <button type="submit" className="mail-send-button" disabled={sending}>
              <Send size={14} /> {sending ? 'Sending…' : 'Send message'}
            </button>
          </div>
        </form>
      ) : (
        <div className="mail-workspace">
          <nav className="mail-folders" aria-label="Mail folders">
            <button type="button" className={isInbox ? 'active' : ''} onClick={() => setFolder('inbox')}><Inbox size={16} /> Inbox <span>{isInbox ? messages.length : ''}</span></button>
            <button type="button" className={!isInbox ? 'active' : ''} onClick={() => setFolder('sent')}><Send size={15} /> Sent <span>{!isInbox ? messages.length : ''}</span></button>
            <button type="button" className="mail-refresh" onClick={() => void refresh(folder, mailbox)} disabled={loading} aria-label="Refresh mailbox"><RefreshCw size={15} /></button>
          </nav>
          <div className="mail-content">
            <div className="mail-list" aria-label={isInbox ? 'Inbox messages' : 'Sent messages'}>
              {loading ? <p className="mail-empty">Loading messages…</p> : messages.length === 0 ? (
                <p className="mail-empty">{isInbox ? 'Your inbox is quiet for now.' : 'Messages you send will appear here.'}</p>
              ) : messages.map(message => {
                const otherName = isInbox ? message.senderName : message.recipientName
                const otherAddress = isInbox ? message.senderAddress : message.recipientAddress
                return (
                  <button type="button" key={message.id} className={`mail-list-item${selectedId === message.id ? ' selected' : ''}`} onClick={() => setSelectedId(message.id)}>
                    <span className="mail-list-top"><strong>{otherName}</strong><time>{formatDate(message.sentAt)}</time></span>
                    <span className="mail-list-address">{otherAddress}</span>
                    <span className="mail-list-subject">{message.subject}</span>
                    <span className="mail-list-preview">{message.body}</span>
                  </button>
                )
              })}
              {messages.length >= 100 && !noMoreOlder && (
                <button type="button" className="mail-load-older" onClick={() => void loadOlder()} disabled={loadingOlder}>
                  {loadingOlder ? 'Loading older…' : 'Load older messages'}
                </button>
              )}
            </div>
            <article className="mail-detail">
              {selected ? (
                <>
                  <div className="mail-detail-header">
                    <h2>{selected.subject}</h2>
                    <time>{formatDate(selected.sentAt)}</time>
                  </div>
                  <div className="mail-detail-addresses">
                    <p><span>From</span> {selected.senderName} <small>&lt;{selected.senderAddress}&gt;</small></p>
                    <p><span>To</span> {selected.recipientName} <small>&lt;{selected.recipientAddress}&gt;</small></p>
                  </div>
                  <div className="mail-detail-body">{selected.body}</div>
                </>
              ) : <p className="mail-empty mail-detail-empty">{loading ? 'Loading messages…' : 'Select a message to read it.'}</p>}
            </article>
          </div>
        </div>
      )}
    </section>
  )
}
