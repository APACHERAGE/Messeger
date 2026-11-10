import AppearanceSettings from './AppearanceSettings'
import { useEffect, useState } from 'react'
import { Bell, CircleUserRound, Download, Eye, HardDrive, Keyboard, MessageSquare, Palette, RotateCcw, Search, Shield, Trash2 } from 'lucide-react'
import { defaultPreferences, defaultProfile, type Audience, type Profile } from './api/profileApi'
import { listBlockedPeople, searchPeople, unblockPerson } from './api/peopleApi'
import { browserStorageKey } from './api/runtime'
import { categories, settings, visibilityLabels, type Category } from './settingsCatalog'

type Props = { draft: Profile; onChange: (profile: Profile) => void; onEdit: () => void; onLogout?: () => Promise<void>; onClearDrafts: () => void }
const icons = [Eye, Shield, Bell, MessageSquare, Palette, Keyboard, HardDrive, CircleUserRound]

export default function SettingsPanel({ draft, onChange, onEdit, onLogout, onClearDrafts }: Props) {
  const [section, setSection] = useState<Category>('Profile visibility')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [blocked, setBlocked] = useState<{ id: string; name: string }[]>([])
  const [blocksLoading, setBlocksLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [permission, setPermission] = useState(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  const [storageSize, setStorageSize] = useState(0)
  const normalized = query.trim().toLowerCase()
  const matches = (value: string) => !normalized || value.toLowerCase().includes(normalized)
  const update = <K extends keyof Profile,>(key: K, value: Profile[K]) => onChange({ ...draft, [key]: value })

  useEffect(() => {
    if (section !== 'Privacy' || normalized) return
    let active = true
    setBlocksLoading(true)
    Promise.all([listBlockedPeople(), searchPeople('')]).then(([ids, people]) => {
      if (active) setBlocked(ids.map(id => ({ id, name: people.find(p => p.id === id)?.displayName ?? id })))
    }).catch(() => { if (active) setNotice('Could not load blocked accounts. Reopen Privacy to retry.') })
      .finally(() => { if (active) setBlocksLoading(false) })
    return () => { active = false }
  }, [section, normalized])

  useEffect(() => {
    try {
      let bytes = 0
      const prefix = browserStorageKey('profile').replace(/profile-v1$/, '')
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(prefix)) bytes += new Blob([key, localStorage.getItem(key) ?? '']).size
      }
      setStorageSize(bytes)
    } catch { setStorageSize(0) }
  }, [section])

  async function requestNotifications() {
    try {
      if (typeof Notification === 'undefined') { setNotice('This browser does not support desktop notifications.'); return }
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === 'denied') setNotice('Notifications are blocked. Change the permission in your browser’s site settings.')
    } catch { setNotice('Could not request notification permission.') }
  }

  function exportProfile() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url; link.download = `${draft.username || 'nightfall'}-profile.json`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice('Profile exported, including hidden fields. Keep the file private.')
  }

  const visibleCategories = normalized ? categories.filter(category =>
    matches(category) || category === 'Privacy' && matches('Who can view profile details Who can message me everyone friends nobody wall access') || settings.some(setting => setting.section === category && matches(`${setting.label} ${setting.description}`)) ||
    category === 'Profile visibility' && Object.values(visibilityLabels).some(matches)) : [section]

  return <div className="settings-workspace">
    <aside className="preferences-sidebar"><div className="preferences-title"><SettingsMark /><strong>Make it yours.</strong><span>Your space. Your preferences.</span></div>
      <label className="settings-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search settings…" aria-label="Search settings" />{query && <button onClick={() => setQuery('')} aria-label="Clear settings search">×</button>}</label>
      <nav aria-label="Settings categories">{categories.map((category, i) => { const Icon = icons[i]; return <button key={category} className={section === category && !normalized ? 'active' : ''} onClick={() => { setSection(category); setQuery(''); setNotice('') }}><Icon size={17} /><span>{category}</span></button> })}</nav>
      <span className="preferences-sidebar-note">Changes apply after you save.</span>
    </aside>
    <div className="preferences-main">
      {normalized && <p className="settings-search-summary" role="status">{visibleCategories.length ? `Results for “${query}”` : `No settings found for “${query}”. Try “photo”, “message”, or “notification”.`}</p>}
      {visibleCategories.map(category => <section className="preferences-category" key={category} aria-label={category}>
        <header><span className="eyebrow">PREFERENCES / {String(categories.indexOf(category) + 1).padStart(2, '0')}</span><h3>{category}</h3><p>{category === 'Profile visibility' ? 'Choose what appears on your public profile. Hidden fields stay saved for you.' : 'Adjust Nightfall to the way you work.'}</p></header>
        {category === 'Profile visibility' && <><div className="visibility-summary"><Eye size={18} /><div><strong>{Object.values(draft.visibility).filter(Boolean).length} of {Object.keys(draft.visibility).length} fields visible</strong><span>Display name and @username are always public.</span></div><button onClick={onEdit}>Edit details</button></div>{Object.entries(visibilityLabels).filter(([, label]) => matches(`${category} ${label}`)).map(([key, label]) => <label className="preference-row" key={key}><span><strong>{label}</strong><small>{draft.visibility[key as keyof typeof draft.visibility] ? 'Shown on your profile' : 'Hidden from your profile'}</small></span><input type="checkbox" role="switch" checked={draft.visibility[key as keyof typeof draft.visibility]} onChange={e => update('visibility', { ...draft.visibility, [key]: e.target.checked })} /></label>)}</>}
        {category === 'Privacy' && <><label className="preference-row"><span><strong>Who can view my profile details</strong><small>Your name and @username remain discoverable. Individual field visibility still applies.</small></span><select value={draft.profileAudience} onChange={event => update('profileAudience', event.target.value as Audience)} aria-label="Who can view my profile details"><option value="everyone">Everyone</option><option value="friends">Friends</option><option value="nobody">Only me</option></select></label><label className="preference-row"><span><strong>Who can message me</strong><small>Applies to new and existing direct conversations.</small></span><select value={draft.messageAudience} onChange={event => update('messageAudience', event.target.value as Audience)} aria-label="Who can message me"><option value="everyone">Everyone</option><option value="friends">Friends</option><option value="nobody">Nobody</option></select></label><label className="preference-row"><span><strong>Who can post on my wall</strong><small>Other people can publish on your wall only if you allow it.</small></span><select value={draft.wallPostingAudience} onChange={event=>update('wallPostingAudience',event.target.value as 'friends'|'nobody')}><option value="friends">Friends</option><option value="nobody">Only me</option></select></label><label className="preference-row"><span><strong>Default visibility for new posts</strong><small>Public posts may appear in recommendations. You can change this for each post.</small></span><select value={draft.preferences.defaultPostAudience} onChange={event=>update('preferences',{...draft.preferences,defaultPostAudience:event.target.value})}><option value="friends">Friends</option><option value="public">Public</option></select></label><div className="settings-action-block"><p>Friends-only posts stay private. Public posts can appear in the general feed. Saving a contact does not create a friendship.</p></div></>}
        {category === 'Appearance' && <AppearanceSettings preferences={draft.preferences} onChange={value => update('preferences', value)} />}
        {settings.filter(setting => setting.section === category && matches(`${category} ${setting.label} ${setting.description}`)).map(setting => {
          const value = setting.scope === 'profile' ? draft[setting.key] : draft.preferences[setting.key]
          const change = (next: string | boolean) => setting.scope === 'profile' ? update(setting.key, next as boolean) : update('preferences', { ...draft.preferences, [setting.key]: next })
          return <label className="preference-row" key={setting.key}><span><strong>{setting.label}</strong><small>{setting.description}</small></span>{setting.scope === 'preferences' && setting.options ? <select value={String(value)} onChange={e => change(e.target.value)}>{setting.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : setting.scope === 'preferences' && setting.type === 'time' ? <input type="time" value={String(value)} onChange={e => change(e.target.value)} required /> : <input type="checkbox" role="switch" checked={Boolean(value)} onChange={e => change(e.target.checked)} />}</label>
        })}
        {category === 'Privacy' && !normalized && <div className="settings-action-block"><h4>Blocked accounts <span>{blocked.length}</span></h4><p>Manage accounts blocked from direct messaging. Add blocks from Contacts.</p>{blocksLoading ? <p>Loading…</p> : blocked.length ? blocked.map(person => <div className="blocked-setting" key={person.id}><span>{person.name}</span><button disabled={busy === person.id} onClick={async () => { setBusy(person.id); try { await unblockPerson(person.id); setBlocked(current => current.filter(p => p.id !== person.id)) } catch { setNotice('Could not unblock this account.') } finally { setBusy('') } }}>Unblock</button></div>) : <p>No blocked accounts.</p>}</div>}
        {category === 'Notifications' && <div className="settings-action-block"><h4>Browser permission <span>{permission}</span></h4><p>Alerts work while Nightfall is open and check the selected conversation. Background push delivery is not available yet.</p><button onClick={() => void requestNotifications()} disabled={permission === 'unsupported' || permission === 'granted'}><Bell size={14} />{permission === 'granted' ? 'Permission granted' : 'Allow browser notifications'}</button></div>}
        {category === 'Data & Storage' && <div className="settings-action-block"><div className="storage-meter"><HardDrive size={25} /><div><strong>{storageSize < 1024 ? `${storageSize} B` : `${(storageSize / 1024).toFixed(1)} KB`}</strong><span>Nightfall data in this browser · approximate</span></div></div><h4>Profile export</h4><p>Download your current profile and preferences as JSON, including hidden fields. Messages and account credentials are excluded.</p><button onClick={exportProfile}><Download size={14} /> Export profile & settings</button><h4>Message drafts</h4><p>Remove unsent text drafts for the current account on this device.</p><button onClick={() => { if (window.confirm('Clear all unsent message drafts for this account on this device?')) { onClearDrafts(); setNotice('Message drafts cleared.') } }}><Trash2 size={14} /> Clear unsent drafts</button><h4>Reset preferences</h4><p>Restore chat, appearance, accessibility, and notification defaults. Profile details and field visibility are kept. Save to apply.</p><button onClick={() => { if (window.confirm('Restore default preferences? Your profile and visibility choices will be kept.')) { const next = { ...draft, preferences: { ...defaultPreferences } }; for (const setting of settings) if (setting.scope === 'profile' && setting.section !== 'Privacy') Object.assign(next, { [setting.key]: defaultProfile[setting.key] }); onChange(next) } }}><RotateCcw size={14} /> Restore default preferences</button></div>}
        {category === 'Account' && <div className="settings-action-block"><div className="settings-account-card"><CircleUserRound size={32} /><div><strong>{draft.displayName}</strong><span>@{draft.username} · {onLogout ? 'Signed-in account' : 'Local browser profile'}</span></div></div><button onClick={onEdit}>Edit account details</button><h4>Session</h4><p>{onLogout ? 'You are signed in through a server-managed session. Sign out to end this session on this browser.' : 'This profile is stored on this browser. Shared accounts require the Nightfall API.'}</p>{onLogout && <button className="settings-danger" disabled={busy === 'logout'} onClick={async () => { if (!window.confirm('Sign out of Nightfall on this browser?')) return; setBusy('logout'); try { await onLogout() } finally { setBusy('') } }}>Sign out</button>}<h4>Account security</h4><p>Two-step verification, password changes, and device session management are not available in this version.</p></div>}
      </section>)}
      {notice && <p className="settings-feedback" role="status">{notice}</p>}
    </div>
  </div>
}
function SettingsMark() { return <span className="settings-mark"><Palette size={22} /></span> }
