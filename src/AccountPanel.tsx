import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Camera, Check, CircleUserRound, ExternalLink, GitBranch, ImageOff, LayoutPanelLeft, Plus, Save, Search, Trash2, X } from 'lucide-react'
import type { GitHubProject, Profile } from './api/profileApi'
import ProfileOverview from './ProfileOverview'
import SettingsPanel from './SettingsPanel'
import { useDialogFocus } from './useDialogFocus'
import { safeWebsite } from './api/profileApi'
import { skillCatalog } from './skillsCatalog'
import './account.css'

type Props = { profile: Profile; onClose: () => void; onSave: (profile: Profile) => Promise<void>; onLogout?: () => Promise<void>; initialTab?: 'profile' | 'preferences' | 'edit'; onTabChange: (tab: 'profile' | 'preferences') => void; onClearDrafts: () => void; onDirtyChange: (dirty: boolean) => void }

export default function AccountPanel({ profile, onClose, onSave, onLogout, initialTab = 'profile', onTabChange, onClearDrafts, onDirtyChange }: Props) {
  const [draft, setDraft] = useState(profile)
  const [tab, setTab] = useState<'profile' | 'preferences' | 'edit'>(initialTab)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [skillSelection, setSkillSelection] = useState<string[]>([])
  const [skillSearch, setSkillSearch] = useState('')
  const [customSkillDraft, setCustomSkillDraft] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false)
  useEffect(() => setDraft(profile), [profile])
  useEffect(() => setTab(current => initialTab === 'profile' && current === 'edit' ? current : initialTab), [initialTab])
  const fullName = [draft.firstName.trim(), draft.lastName.trim()].filter(Boolean).join(' ')
  const displayName = draft.displayName.trim() || fullName || draft.username
  const featuredProjects = draft.githubProjects.filter(project => project.name.trim() && isGitHubRepositoryUrl(project.url))
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile)
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false) }, [dirty, onDirtyChange])
  const skillDialogRef = useDialogFocus<HTMLElement>(() => setSkillsOpen(false), skillsOpen)
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  function changeTab(next: 'profile' | 'preferences' | 'edit') {
    setTab(next)
    onTabChange(next === 'preferences' ? 'preferences' : 'profile')
  }

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setDraft(value0 => ({ ...value0, [key]: value }))
    setSaved(false)
  }

  function updateProject(index: number, patch: Partial<GitHubProject>) {
    update('githubProjects', draft.githubProjects.map((project, itemIndex) => itemIndex === index ? { ...project, ...patch } : project))
  }

  function openSkillPicker() {
    setSkillSelection(draft.skills.split(',').map(skill => skill.trim()).filter(Boolean))
    setSkillSearch('')
    setCustomSkillDraft('')
    setSkillsOpen(true)
  }

  function toggleSkill(skill: string) {
    setSkillSelection(current => current.includes(skill) ? current.filter(item => item !== skill) : [...current, skill])
  }

  function addCustomSkill() {
    const skill = customSkillDraft.trim()
    if (!skill || skillSelection.some(item => item.toLowerCase() === skill.toLowerCase())) return
    setSkillSelection(current => [...current, skill])
    setCustomSkillDraft('')
  }

  function confirmSkills() {
    update('skills', skillSelection.join(', '))
    setSkillsOpen(false)
  }

  function addProject() {
    if (draft.githubProjects.length >= 6) return
    update('githubProjects', [...draft.githubProjects, { name: '', url: '', description: '' }])
  }

  function isGitHubRepositoryUrl(value: string) {
    return /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(value.trim())
  }

  function upload(file?: File) {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Choose a JPG, PNG, or WebP image.'); return }
    if (file.size > 700_000) { setError('Avatar must be smaller than 700 KB.'); return }
    const reader = new FileReader()
    reader.onload = () => { update('avatarDataUrl', String(reader.result)); setError('') }
    reader.onerror = () => setError('Could not read this image. Please try another file.')
    reader.readAsDataURL(file)
  }

  async function submit() {
    if (savingRef.current) return
    const username = draft.username.trim().replace(/^@/, '')
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) { setError('Username must be 3–24 letters, numbers, or underscores.'); return }
    if (draft.website.trim() && !safeWebsite(draft.website.trim())) { setError('Website must be a valid http:// or https:// address.'); return }
    if (draft.githubUsername.trim() && !/^[A-Za-z0-9-]{1,39}$/.test(draft.githubUsername.trim())) {setError('Enter a GitHub username without @ or a URL.');return}
    if (draft.skills.length > 2000) { setError('Skills must be 2000 characters or fewer.'); return }
    if (draft.githubProjects.some(project => !project.name.trim() || !isGitHubRepositoryUrl(project.url))) {
      setError('Each project needs a name and a valid https://github.com/owner/repository URL.')
      return
    }
    savingRef.current = true
    setSaving(true)
    try {
      await onSave({
        ...draft,
        displayName: draft.displayName.trim() || username,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        username,
        headline: draft.headline.trim(),
        bio: draft.bio.trim(),
        skills: draft.skills.split(',').map(skill => skill.trim()).filter(Boolean).join(', '),
        location: draft.location.trim(),
        website: draft.website.trim(),
        githubProjects: draft.githubProjects.map(project => ({ ...project, name: project.name.trim(), url: project.url.trim(), description: project.description.trim() })),
        status: draft.status.trim(),
      })
      setError('')
      setSaved(true)
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not save your profile.') }
    finally { savingRef.current = false; setSaving(false) }
  }

  return <section className="account-page" aria-label="Personal profile">
    <section className={`account-panel account-panel-${tab}`}>
      <header className="account-header"><div><span className="eyebrow">NIGHTFALL / IDENTITY</span><h2>{tab === 'preferences' ? 'Settings' : tab === 'edit' ? 'Edit profile' : 'Your profile'}</h2><p>Your identity, your space, your choices.</p></div><button className="account-back" onClick={onClose}><ArrowLeft size={15} /> Back to workspace</button></header>
      <nav className="account-tabs" aria-label="Account pages"><button className={tab === 'profile' ? 'active' : ''} onClick={onClose}><CircleUserRound size={16} /> My page</button><button className={tab === 'edit' ? 'active' : ''} onClick={() => changeTab('edit')}><Camera size={16} /> Edit profile</button><button className={tab === 'preferences' ? 'active' : ''} onClick={() => changeTab('preferences')}><LayoutPanelLeft size={16} /> Settings</button></nav>
      <div className={`account-content ${tab !== 'edit' ? 'account-content-full' : ''}`}>
        {tab === 'profile' ? <ProfileOverview profile={draft} onEdit={() => changeTab('edit')} onSettings={() => changeTab('preferences')} /> : tab === 'edit' ? <>
          <section className="account-hero" aria-label="Profile identity card">
            <svg className="account-hero-art" viewBox="0 0 900 190" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <defs>
                <linearGradient id="profile-sky" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#172a1d" /><stop offset=".58" stopColor="#101a14" /><stop offset="1" stopColor="#0b120e" /></linearGradient>
                <pattern id="profile-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#90c47b" strokeOpacity=".09" strokeWidth="1" /></pattern>
              </defs>
              <rect width="900" height="190" fill="url(#profile-sky)" />
              <rect width="900" height="190" fill="url(#profile-grid)" />
              <circle cx="690" cy="58" r="31" fill="#a7ed8e" fillOpacity=".1" />
              <circle cx="690" cy="58" r="21" fill="none" stroke="#a7ed8e" strokeOpacity=".42" />
              <path d="M0 151h104v-18h30v18h42v-38h26v38h57v-24h32v24h43v-49h26v49h37v-19h27v19h61v-31h31v31h50v-16h28v16h55v-44h29v44h54v-22h24v22h74v39H0z" fill="#203a28" />
              <path d="M0 166h75v-18h33v18h69v-28h29v28h66v-18h42v18h58v-30h31v30h65v-17h39v17h71v-28h33v28h60v-18h29v18h64v-30h28v30h68v24H0z" fill="#2c5237" />
              <path d="M0 182h900" stroke="#a7ed8e" strokeOpacity=".7" />
              <g fill="#c7ff9f">
                <rect x="114" y="130" width="5" height="5" /><rect x="241" y="139" width="5" height="5" />
                <rect x="350" y="112" width="5" height="5" /><rect x="512" y="139" width="5" height="5" />
                <rect x="610" y="121" width="5" height="5" /><rect x="799" y="137" width="5" height="5" />
                <circle cx="572" cy="35" r="2" /><circle cx="752" cy="28" r="2" /><circle cx="834" cy="74" r="2" />
              </g>
              <g transform="translate(735 88)">
                <rect width="126" height="47" rx="3" fill="#0b130e" fillOpacity=".9" stroke="#719968" strokeOpacity=".7" />
                <circle cx="10" cy="10" r="2" fill="#e5b970" /><circle cx="18" cy="10" r="2" fill="#a7ed8e" />
                <path d="M12 25h34m-34 7h66m-66 7h44" stroke="#8ebd80" strokeOpacity=".64" strokeWidth="2" />
                <path d="m6 24 4 3-4 3" fill="none" stroke="#c7ff9f" strokeWidth="1.5" />
              </g>
            </svg>
            <div className="account-hero-content">
              <button type="button" className="account-hero-avatar" onClick={() => fileRef.current?.click()} aria-label="Change profile avatar" title="Change profile avatar">
                {draft.avatarDataUrl ? <img src={draft.avatarDataUrl} alt="" /> : <span>{displayName.slice(0, 1).toUpperCase() || 'N'}</span>}
                <i><Camera size={15} /></i>
              </button>
              <div className="account-hero-copy">
                <span className="account-hero-kicker">DEVELOPER IDENTITY / 01</span>
                <strong>{displayName}</strong>
                <small>@{draft.username || 'username'}{draft.headline.trim() && ` · ${draft.headline.trim()}`}</small>
                {draft.showOnline && draft.status.trim() && <span className="account-hero-status"><i />{draft.status}</span>}
                {draft.bio.trim() && <p className="account-hero-bio">{draft.bio}</p>}
                <div className="account-hero-actions"><button type="button" onClick={() => fileRef.current?.click()}><Camera size={13} /> {draft.avatarDataUrl ? 'Change avatar' : 'Add avatar'}</button>{draft.avatarDataUrl && <button type="button" onClick={() => update('avatarDataUrl', '')}><ImageOff size={13} /> Remove</button>}</div>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => upload(event.target.files?.[0])} />
          </section>
          <label className="account-field">Display name <span className="field-optional">optional</span><input value={draft.displayName} onChange={event => update('displayName', event.target.value)} maxLength={48} placeholder="Name shown across Nightfall" /></label>
          <label className="account-field">First name <span className="field-optional">optional</span><input value={draft.firstName} onChange={event => update('firstName', event.target.value)} maxLength={48} placeholder="First name" /></label>
          <label className="account-field">Last name <span className="field-optional">optional</span><input value={draft.lastName} onChange={event => update('lastName', event.target.value)} maxLength={48} placeholder="Last name" /></label>
          <label className="account-field">Username <span className="field-optional">searchable</span><span className="username-input"><b>@</b><input value={draft.username} onChange={event => update('username', event.target.value)} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" title="3–24 letters, numbers, or underscores" /></span><small>Your unique username is how other developers can find you. Use 3–24 letters, numbers, or underscores.</small></label>
          <label className="account-field">Role / headline<input value={draft.headline} onChange={event => update('headline', event.target.value)} maxLength={80} placeholder="e.g. Platform engineer · Open source maintainer" /></label>
          <label className="account-field">Current status<input value={draft.status} onChange={event => update('status', event.target.value)} maxLength={60} placeholder="What are you working on?" /></label>
          <label className="account-field account-field-wide">About<textarea value={draft.bio} onChange={event => update('bio', event.target.value)} maxLength={240} rows={4} placeholder="A short intro: what you build, what you care about, or what you're learning." /><small>{draft.bio.length}/240</small></label>
          <label className="account-field">Location <span className="field-optional">optional</span><input value={draft.location} onChange={event => update('location', event.target.value)} maxLength={80} placeholder="City, region, or timezone" /></label>
          <label className="account-field">Website <span className="field-optional">optional</span><input value={draft.website} onChange={event => update('website', event.target.value)} maxLength={200} placeholder="https://your-site.dev" /></label>
          <h3 className="editor-group-title">More about you</h3>
          <label className="account-field">Pronouns<input value={draft.pronouns} onChange={event => update('pronouns', event.target.value)} maxLength={40} placeholder="e.g. she/her, he/him, they/them" /></label>
          <label className="account-field">Company / team<input value={draft.company} onChange={event => update('company', event.target.value)} maxLength={80} placeholder="Where you build things" /></label>
          <label className="account-field">Time zone<input value={draft.timezone} onChange={event => update('timezone', event.target.value)} maxLength={60} placeholder="e.g. Europe/Berlin" /></label>
          <label className="account-field">Interests<input value={draft.interests} onChange={event => update('interests', event.target.value)} maxLength={240} placeholder="What you love outside the terminal" /></label>
          <label className="account-field">Open to<input value={draft.lookingFor} onChange={event => update('lookingFor', event.target.value)} maxLength={160} placeholder="Collaborations, work, side projects…" /></label>
          <label className="account-field">GitHub username<input value={draft.githubUsername} onChange={event => update('githubUsername', event.target.value)} maxLength={39} placeholder="Your GitHub handle" /></label>
          <h3 className="editor-group-title">Your stack & work</h3>
          <div className="profile-feature-grid">
            <section className="account-field skills-field">
              <span>Skills <span className="field-optional">select all that apply</span></span>
              <button type="button" className="skills-open-button" onClick={openSkillPicker}><Plus size={14} /> Browse skills <span>{draft.skills ? draft.skills.split(',').filter(skill => skill.trim()).length : 0} selected</span></button>
              <div className="account-skills">{draft.skills.split(',').map(skill => skill.trim()).filter(Boolean).map(skill => <span key={skill}>{skill}</span>)}</div>
              <small>Choose technologies from the catalog or add your own. Selections appear on your profile.</small>
            </section>
            <div className="profile-project-column">
              <section className="github-projects-editor">
                <header><span><GitBranch size={16} /><strong>Featured GitHub projects</strong></span><small>Showcase up to 6 repositories on your profile.</small></header>
                {draft.githubProjects.map((project, index) => <article className="github-project-edit" key={`project-${index}`}>
                  <div className="github-project-edit-heading"><span>REPOSITORY {String(index + 1).padStart(2, '0')}</span><button type="button" className="project-remove" aria-label={`Remove project ${index + 1}`} onClick={() => update('githubProjects', draft.githubProjects.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></button></div>
                  <label className="account-field">Project name<input value={project.name} onChange={event => updateProject(index, { name: event.target.value })} maxLength={80} placeholder="e.g. infra-toolkit" /></label>
                  <label className="account-field">GitHub repository URL<input value={project.url} onChange={event => updateProject(index, { url: event.target.value })} type="url" pattern="https://github\.com/[^/]+/[^/]+/?"
                    title="Use a repository URL like https://github.com/owner/repository" maxLength={200} placeholder="https://github.com/you/project" /></label>
                  <label className="account-field account-field-wide">What does it do?<input value={project.description} onChange={event => updateProject(index, { description: event.target.value })} maxLength={160} placeholder="A short description of the project" /></label>
                </article>)}
                {draft.githubProjects.length < 6 && <button type="button" className="github-project-add" onClick={addProject}><Plus size={14} /> Add a project <span>{draft.githubProjects.length}/6</span></button>}
              </section>
              {featuredProjects.length > 0 && <section className="github-project-preview"><span className="preview-section-title">FEATURED REPOSITORIES</span><div>{featuredProjects.map((project, index) => <a key={`${project.url}-${index}`} href={project.url} target="_blank" rel="noreferrer"><GitBranch size={15} /><span><strong>{project.name}</strong>{project.description && <small>{project.description}</small>}</span><ExternalLink size={13} /></a>)}</div></section>}
            </div>
          </div>
        </> : <SettingsPanel draft={draft} onChange={next => { setDraft(next); setSaved(false) }} onEdit={() => changeTab('edit')} onLogout={onLogout} onClearDrafts={onClearDrafts} />}
      </div>
      {error && <p className="account-error account-save-error" role="alert">{error}</p>}
      {(tab !== 'profile' || dirty || saved || saving) && <footer className="account-footer"><span role="status">{saving ? 'Saving changes…' : saved ? <><Check size={14} /> Changes saved</> : dirty ? 'You have unsaved changes' : 'Your profile & preferences'}</span><div>{dirty && <button type="button" className="account-discard" disabled={saving} onClick={() => { setDraft(profile); setSaved(false); setError('') }}>Discard</button>}<button className="save-profile" type="button" disabled={saving || !dirty} onClick={() => void submit()}><Save size={16} /> {saving ? 'Saving…' : 'Save changes'}</button></div></footer>}
    </section>
    {skillsOpen && <div className="skill-picker-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSkillsOpen(false) }}>
      <section className="skill-picker" role="dialog" aria-modal="true" aria-labelledby="skill-picker-title" ref={skillDialogRef} tabIndex={-1}>
        <header className="skill-picker-header"><div><span className="account-hero-kicker">PROFILE / SKILLS</span><h2 id="skill-picker-title">Choose your stack</h2><p>Select what you know; add anything missing.</p></div><button type="button" className="skill-picker-close" aria-label="Close skill picker" onClick={() => setSkillsOpen(false)}><X size={17} /></button></header>
        <label className="skill-search"><Search size={16} /><input autoFocus value={skillSearch} onChange={event => setSkillSearch(event.target.value)} placeholder="Search languages, tools, practices…" /></label>
        <div className="skill-picker-selected"><span>SELECTED / {skillSelection.length}</span>{skillSelection.length ? <div>{skillSelection.map(skill => <button key={skill} type="button" onClick={() => toggleSkill(skill)}>{skill}<X size={11} /></button>)}</div> : <small>No skills selected yet.</small>}</div>
        <div className="skill-catalog-list">
          {skillCatalog.map(category => {
            const filteredSkills = category.skills.filter(skill => `${category.name} ${skill}`.toLowerCase().includes(skillSearch.trim().toLowerCase()))
            if (!filteredSkills.length) return null
            return <section className="skill-category" key={category.name}>
              <h3>{category.name}</h3>
              <div>{filteredSkills.map(skill => <label key={skill} className="skill-option"><input type="checkbox" checked={skillSelection.includes(skill)} onChange={() => toggleSkill(skill)} /><span>{skill}</span></label>)}</div>
            </section>
          })}
          {!skillCatalog.some(category => category.skills.some(skill => `${category.name} ${skill}`.toLowerCase().includes(skillSearch.trim().toLowerCase()))) && <p className="skill-no-results">No catalog matches. Add it as a custom skill below.</p>}
        </div>
        <div className="skill-custom-add"><input value={customSkillDraft} onChange={event => setCustomSkillDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addCustomSkill() } }} maxLength={64} placeholder="Add another skill…" aria-label="Custom skill" /><button type="button" disabled={!customSkillDraft.trim()} onClick={addCustomSkill}><Plus size={14} /> Add</button></div>
        <footer className="skill-picker-footer"><span>{skillSelection.length} selected</span><button type="button" className="skill-picker-cancel" onClick={() => setSkillsOpen(false)}>Cancel</button><button type="button" className="skill-picker-confirm" onClick={confirmSkills}><Check size={14} /> Confirm selection</button></footer>
      </section>
    </div>}
  </section>
}
