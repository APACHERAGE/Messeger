import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Ban, Check, ContactRound, Flag, LockKeyhole, MessageCircle, Plus, Search, UserPlus, UsersRound, X } from 'lucide-react'
import { acceptFriend, addContact, followPerson, unfollowPerson, blockPerson, dismissFriendRequest, getPerson, listContacts, listFriends, removeContact, removeFriend, reportPerson, requestFriend, searchPeople, type FriendsState, type Person } from './api/peopleApi'
import { normalizeProfile } from './api/profileApi'
import ProfileOverview from './ProfileOverview'
import UserWall from './UserWall'
import { useDialogFocus } from './useDialogFocus'
import './people.css'

type Props = { initialPersonId?:string; userId: string; displayName: string; username: string; onChat: (person: Person) => Promise<void>; onOpenThreads: () => void; onNotice: (message: string) => void }
type PeopleTab = 'contacts' | 'friends' | 'requests' | 'discover'
const emptyFriends: FriendsState = { friends: [], incoming: [], outgoing: [] }

export default function ContactsPanel({ initialPersonId,userId, displayName, username, onChat, onOpenThreads, onNotice }: Props) {
  const [tab, setTab] = useState<PeopleTab>('contacts')
  const [query, setQuery] = useState('')
  const [contacts, setContacts] = useState<Person[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [friends, setFriends] = useState<FriendsState>(emptyFriends)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const busyRef = useRef(false)
  const [selectedId, setSelectedId] = useState(initialPersonId??'')
  useEffect(()=>{setSelectedId(initialPersonId??'')},[initialPersonId])
  const [selected, setSelected] = useState<Person | null>(null)
  const [profileError, setProfileError] = useState('')
  const profileDialog = useDialogFocus<HTMLDivElement>(() => setSelectedId(''), !!selectedId)
  const refresh = useCallback(async () => {
    const [saved, social] = await Promise.all([listContacts(), listFriends()])
    setContacts(saved); setFriends(social)
  }, [userId])
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    Promise.all([listContacts(), listFriends()]).then(([saved, social]) => { if (active) { setContacts(saved); setFriends(social) } })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Could not load your people.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [userId])
  useEffect(() => {
    if (tab === 'friends' || tab === 'requests') void refresh().catch(() => setError('Could not refresh your connections.'))
  }, [tab, refresh])
  useEffect(() => {
    if (tab !== 'discover') return
    let active = true
    setSearching(true)
    const timer = window.setTimeout(() => searchPeople(query).then(result => { if (active) setPeople(result) })
      .catch(() => { if (active) setError('Could not search the directory.') }).finally(() => { if (active) setSearching(false) }), 200)
    return () => { active = false; window.clearTimeout(timer) }
  }, [query, tab, userId])
  useEffect(() => {
    if (!selectedId) return
    let active = true
    setSelected(null); setProfileError('')
    getPerson(selectedId).then(person => { if (active) setSelected(person) })
      .catch(error => { if (active) setProfileError(error instanceof Error ? error.message : 'Could not load this profile.') })
    return () => { active = false }
  }, [selectedId])

  async function perform(id: string, action: () => Promise<unknown>) {
    if (busyRef.current) return
    busyRef.current = true; setBusy(id); setError('')
    try {
      await action(); await refresh()
      if (tab === 'discover') setPeople(await searchPeople(query))
      if (selectedId) setSelected(await getPerson(selectedId))
    } catch (error) { const message = error instanceof Error ? error.message : 'Could not update this connection.'; setError(message); onNotice(message) }
    finally { busyRef.current = false; setBusy('') }
  }
  function friendAction(person: Person) {
    if (person.relationship === 'friends') {
      if (window.confirm(`Remove ${person.displayName} from friends? You will no longer have access to each other’s walls.`)) void perform(person.id, () => removeFriend(person.id))
    } else if (person.relationship === 'incoming') void perform(person.id, () => acceptFriend(person.id))
    else if (person.relationship === 'outgoing') void perform(person.id, () => dismissFriendRequest(person.id))
    else void perform(person.id, () => requestFriend(person.id))
  }
  const contactIds = new Set(contacts.map(person => person.id))
  const matches = (person: Person) => `${person.displayName} ${person.username}`.toLowerCase().includes(query.trim().toLowerCase())
  const friendLabel = (person: Person) => person.relationship === 'friends' ? 'Friends' : person.relationship === 'incoming' ? 'Accept request' : person.relationship === 'outgoing' ? 'Cancel request' : 'Add friend'
  function card(person: Person, incoming = false) {
    return <article className="people-card" key={person.id}>
      <button type="button" className="people-card-identity" onClick={() => setSelectedId(person.id)} aria-label={`Open ${person.displayName}'s profile`}><span className="people-avatar">{person.avatarDataUrl && person.canViewProfile !== false ? <img src={person.avatarDataUrl} alt="" /> : person.displayName.slice(0,1).toUpperCase()}</span><span><strong>{person.displayName}</strong><small>@{person.username}</small></span><ArrowUpRight size={16} /></button>
      <div className="people-card-copy">{person.canViewProfile === false ? <p className="people-locked"><LockKeyhole size={13} /> Profile details are private</p> : <><p>{person.status || person.headline || 'Part of the Nightfall community.'}</p>{person.skills && <span>{person.skills}</span>}</>}</div>
      <div className="people-card-actions"><button type="button" className={person.relationship === 'friends' ? 'is-friend' : ''} disabled={busy === person.id} onClick={() => friendAction(person)}>{person.relationship === 'friends' ? <Check size={14} /> : <UserPlus size={14} />}{friendLabel(person)}</button><button type="button" className="people-icon-action" aria-label={`Message ${person.displayName}`} title={person.canMessage === false ? 'Messages restricted by privacy settings' : 'Message'} disabled={busy === person.id || person.canMessage === false} onClick={() => void perform(person.id, () => onChat(person))}><MessageCircle size={16} /></button><button type="button" className="people-icon-action" aria-label={`${contactIds.has(person.id) ? 'Remove' : 'Save'} ${person.displayName} ${contactIds.has(person.id) ? 'from' : 'to'} contacts`} title={contactIds.has(person.id) ? 'Remove from contacts' : 'Save contact'} disabled={busy === person.id} onClick={() => void perform(person.id, () => contactIds.has(person.id) ? removeContact(person.id) : addContact(person.id))}>{contactIds.has(person.id) ? <ContactRound size={16} /> : <Plus size={16} />}</button></div>
      {incoming && <button type="button" className="people-decline" disabled={busy === person.id} onClick={() => void perform(person.id, () => dismissFriendRequest(person.id))}>Decline request</button>}
    </article>
  }
  const list = (tab === 'contacts' ? contacts : tab === 'friends' ? friends.friends : people).filter(matches)
  return <section className="people-page" aria-label="Contacts and friends"><div className="people-page-inner">
    <header className="people-heading"><div><span>YOUR PEOPLE / YOUR CIRCLE</span><h1>Good company.</h1><p>Keep contacts close. Let friends into your world.</p></div><span className="people-heading-mark"><UsersRound size={30} /></span></header>
    <nav className="people-tabs" aria-label="People categories">{(['contacts','friends','requests','discover'] as PeopleTab[]).map(value => <button type="button" key={value} aria-pressed={tab === value} onClick={() => { setTab(value); setQuery(''); setError('') }}>{value === 'contacts' ? 'Contacts' : value === 'friends' ? 'Friends' : value === 'requests' ? 'Requests' : 'Find people'}{value !== 'discover' && <span>{value === 'contacts' ? contacts.length : value === 'friends' ? friends.friends.length : friends.incoming.length}</span>}</button>)}</nav>
    <div className="people-toolbar"><label><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={tab === 'discover' ? 'Search by name or @username…' : 'Search your people…'} aria-label="Search people" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear people search"><X size={15} /></button>}</label><p>{tab === 'contacts' ? 'An address book. Saving a contact doesn’t grant wall access.' : tab === 'friends' ? 'Confirmed friends can see your posts. Friendship is mutual.' : tab === 'requests' ? 'You decide who becomes part of your circle.' : 'Discover people and choose how to connect.'}</p></div>
    {error && <p className="people-error" role="alert">{error}<button type="button" onClick={() => void perform('retry', refresh)}>Retry</button></p>}
    {loading || searching ? <p className="people-empty" role="status">Loading your people…</p> : tab === 'requests' ? <><h2 className="people-section-title">Incoming <span>{friends.incoming.length}</span></h2><div className="people-cards">{friends.incoming.filter(matches).map(person => card(person,true))}</div>{!friends.incoming.length && <p className="people-empty">No incoming requests.</p>}<h2 className="people-section-title">Sent requests <span>{friends.outgoing.length}</span></h2><div className="people-cards">{friends.outgoing.filter(matches).map(person => card(person))}</div>{!friends.outgoing.length && <p className="people-empty">No pending sent requests.</p>}</> : list.length ? <div className="people-cards">{list.map(person => card(person))}</div> : <div className="people-empty"><UsersRound size={28} /><h2>{query ? 'No matches yet.' : tab === 'friends' ? 'Your circle starts with a hello.' : 'A little room for good people.'}</h2><p>{tab === 'friends' ? 'Send a request. They become your friend when they accept.' : 'Find someone by name or username and save their contact.'}</p><button type="button" onClick={() => { setTab('discover'); setQuery('') }}>Find people <ArrowUpRight size={14} /></button></div>}
    {userId === 'local-demo' && <p className="people-local-note">Local demo: contacts and requests stay on this device. Connecting with real friends requires a signed-in account.</p>}
  </div>
  {selectedId && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedId('') }}><div className="public-profile-dialog people-profile-dialog" role="dialog" aria-modal="true" aria-label={selected ? `${selected.displayName}'s profile` : 'Loading profile'} tabIndex={-1} ref={profileDialog}><button className="public-profile-close" type="button" aria-label="Close profile" onClick={() => setSelectedId('')}><X size={20} /></button>{profileError ? <p className="people-error" role="alert">{profileError}</p> : !selected ? <p className="people-empty" role="status">Loading profile…</p> : <>
    {selected.canViewProfile === false ? <section className="people-private-profile"><LockKeyhole size={32} /><h2>{selected.displayName}</h2><span>@{selected.username}</span><p>This person limits who can view their profile details.</p></section> : <ProfileOverview profile={normalizeProfile({ ...selected, firstName: selected.firstName ?? '', lastName: selected.lastName ?? '', bio: selected.bio ?? '', location: selected.location ?? '', website: selected.website ?? '', preferences:selected.appearance, pronouns:selected.pronouns??'',company:selected.company??'',timezone:selected.timezone??'',interests:selected.interests??'',lookingFor:selected.lookingFor??'',githubUsername:selected.githubUsername??'',status: selected.status ?? '', avatarDataUrl: selected.avatarDataUrl ?? '' })} collapsible />}
    <div className="people-profile-actions"><button type="button" disabled={busy===selected.id} onClick={()=>void perform(selected.id,()=>selected.isFollowing?unfollowPerson(selected.id):followPerson(selected.id))}>{selected.isFollowing?'Following':'Follow'}</button><button type="button" disabled={busy === selected.id} onClick={() => friendAction(selected)}><UserPlus size={15} />{friendLabel(selected)}</button><button type="button" disabled={busy === selected.id || selected.canMessage === false} onClick={() => void perform(selected.id, () => onChat(selected))}><MessageCircle size={15} /> Message</button><button type="button" disabled={busy === selected.id} onClick={() => { if (window.confirm(`Block ${selected.displayName}? Friendship and wall access will be removed.`)) void perform(selected.id, () => blockPerson(selected.id)) }}><Ban size={14} />Block</button><button type="button" disabled={busy === selected.id} onClick={() => { const reason=window.prompt('Describe the reason for reporting this account (5–500 characters).'); if (reason?.trim()) void perform(selected.id, () => reportPerson(selected.id,reason.trim())) }}><Flag size={14} />Report</button></div>
    {selected.canViewWall && <UserWall userId={userId} ownerId={selected.id} ownerName={selected.displayName} canPostToWall={selected.canPostToWall} displayName={displayName} username={username} onOpenThreads={onOpenThreads} onNotice={onNotice} />}
    {!selected.canViewWall && <p className="people-wall-locked"><LockKeyhole size={15} />This wall is visible only to its owner and confirmed friends.</p>}
  </>}</div></div>}
  </section>
}
