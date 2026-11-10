import { useId, useState } from 'react'
import { ChevronDown, ArrowUpRight, Eye, GitBranch, Globe, MapPin, Pencil, Plus, Settings, Sparkles } from 'lucide-react'
import { safeWebsite, type Profile } from './api/profileApi'
import { PixelArt } from './PixelArt'
import styles from './ProfileOverview.module.css'

type Props = { profile: Profile; onEdit?: () => void; onSettings?: () => void; collapsible?: boolean }

function NightLandscape() {
  return <svg className={styles.landscape} viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="nf-profile-sky" x2="0" y2="1"><stop stopColor="#112b27" /><stop offset="1" stopColor="#49624c" /></linearGradient><linearGradient id="nf-profile-haze" x2="1" y2="0"><stop stopColor="#b9ca8e" stopOpacity="0" /><stop offset=".6" stopColor="#d4cd95" stopOpacity=".18" /><stop offset="1" stopColor="#d4cd95" stopOpacity="0" /></linearGradient></defs>
    <rect width="1200" height="300" fill="url(#nf-profile-sky)" />
    <g fill="#e7ecc5" opacity=".6">{[[78,38],[198,82],[338,28],[482,62],[609,31],[718,83],[1062,46],[1137,110]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="1.3" />)}</g>
    <circle cx="920" cy="88" r="77" fill="none" stroke="#d7dcac" strokeOpacity=".08" /><circle cx="920" cy="88" r="62" fill="none" stroke="#d7dcac" strokeOpacity=".12" /><circle cx="920" cy="88" r="43" fill="#ded9a4" /><circle cx="908" cy="77" r="33" fill="#f0e9c5" opacity=".45" />
    <path d="M0 214 126 145 252 204 398 117 521 190 645 130 783 204 923 157 1071 197 1200 130V300H0Z" fill="#355647" />
    <path d="M0 254 141 202 255 245 394 175 529 229 674 176 850 239 988 195 1128 231 1200 202V300H0Z" fill="#25493c" />
    <path d="M0 245Q240 216 480 251T960 239T1440 250V300H0Z" fill="url(#nf-profile-haze)" />
    <g fill="#18382e">{[20,69,105,170,206,278,321,385,471,514,572,628,699,744,816,860,1015,1058,1115,1169].map((x,i) => { const height=48+(i*29)%64; return <path key={x} d={`M${x} ${290-height}l-${height*.3} ${height*.55}h${height*.14}l-${height*.28} ${height*.39}h${height*.88}l-${height*.28}-${height*.39}h${height*.14}z`} /> })}</g>
    <path d="M0 284Q200 264 370 284T760 279T1200 281V300H0Z" fill="#101f18" />
    <path d="m745 49 77 23" stroke="#e7e7bb" strokeWidth="1" opacity=".4" /><circle cx="822" cy="72" r="2" fill="#e7e7bb" />
  </svg>
}

export default function ProfileOverview({ profile: p, onEdit, onSettings, collapsible = false }: Props) {
  const [expanded, setExpanded] = useState(!collapsible)
  const detailsId = useId()
  const v=p.visibility, name=p.displayName||p.username
  const skills=[...new Set(p.skills.split(',').map(item=>item.trim()).filter(Boolean))]
  const projects=p.githubProjects.filter(project=>/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(project.url))
  const website=safeWebsite(p.website)
  const fullName=[v.firstName&&p.firstName,v.lastName&&p.lastName].filter(Boolean).join(' ')
  const showBio=v.bio&&!!p.bio.trim(),showSkills=v.skills&&skills.length>0,showProjects=v.githubProjects&&projects.length>0
  const showStatus=v.status&&p.showOnline&&!!p.status.trim()
  const extras=[['Pronouns',v.pronouns&&p.pronouns],['Company / team',v.company&&p.company],['Time zone',v.timezone&&p.timezone],['Interests',v.interests&&p.interests],['Open to',v.lookingFor&&p.lookingFor]].filter(([,value])=>!!value)
  return <div className={styles.root} data-cover={p.preferences.coverStyle} data-density={p.preferences.profileDensity}>
    <div className={styles.cover}>
      {p.preferences.coverStyle==='forest'&&<NightLandscape/>}
      {p.preferences.showDecorations&&<span className={styles.coverArt}><PixelArt id={p.preferences.artId} mode={p.preferences.artMode} size={96}/></span>}
      <div className={styles.coverLabel}><span className={styles.brandMark}>n<span>✦</span></span><span>NIGHTFALL / YOUR SPACE</span></div>
      <div className={styles.coverCaption}><span>A little corner of the internet.</span><small>GOOD PEOPLE. GOOD STORIES.</small></div>
    </div>
    <div className={styles.identity}>
      <div className={styles.identityCopy}><h1>{name}</h1><div className={styles.handle}>@{p.username}</div>{showStatus&&<div className={styles.status}><i/>{p.status}</div>}{v.headline&&p.headline&&<p className={styles.headline}>{p.headline}</p>}{fullName&&<p className={styles.realName}>{fullName}</p>}
      <div className={styles.metaLinks}>{v.location&&p.location&&<span><MapPin size={13}/>{p.location}</span>}{v.website&&website&&<a href={website} target="_blank" rel="noreferrer"><Globe size={13}/>{p.website.replace(/^https?:\/\//,'').replace(/\/$/,'')}<ArrowUpRight size={12}/></a>}{v.githubUsername&&/^[a-zA-Z0-9-]{1,39}$/.test(p.githubUsername)&&<a href={`https://github.com/${p.githubUsername}`} target="_blank" rel="noreferrer"><GitBranch size={13}/>{p.githubUsername}</a>}</div>
      </div>
      <div className={styles.avatarWrap}><div className={styles.avatar}>{v.avatar&&p.avatarDataUrl?<img src={p.avatarDataUrl} alt={`${name}'s avatar`}/>:<span className={styles.monogram}>{name.slice(0,1).toUpperCase()||'N'}</span>}</div></div>
      {onEdit&&<div className={styles.actions}><button type="button" className={styles.editButton} onClick={onEdit}><Pencil size={14}/><span>Edit profile</span></button>{onSettings&&<button type="button" className={styles.iconButton} onClick={onSettings} aria-label="Profile visibility settings" title="Profile visibility"><Eye size={16}/></button>}</div>}
    </div>
    {collapsible&&<div className={styles.summary}>{showBio&&<p className={styles.summaryBio}>{p.bio}</p>}{showSkills&&<div className={styles.summarySkills}>{skills.slice(0,4).map(skill=><span key={skill}>{skill}</span>)}</div>}<button type="button" className={styles.expandButton} aria-expanded={expanded} aria-controls={detailsId} onClick={()=>setExpanded(value=>!value)}>{expanded?'Show less':'More about '+name}<ChevronDown size={15} className={expanded?styles.rotated:''}/></button></div>}
    <div id={detailsId} hidden={!expanded} className={styles.profileContent}>
      {showBio&&<section className={styles.card}><div className={styles.sectionHeading}><Sparkles size={17}/><h2>About me</h2></div><p className={styles.biography}>{p.bio}</p></section>}
      <div className={styles.showcase}>
        {v.skills&&(showSkills||onEdit)&&<section className={`${styles.card} ${styles.skillsCard}`}><div className={styles.sectionHeading}><span className={styles.codeMark}>&lt;/&gt;</span><h2>Skills</h2><span className={styles.counter}>{skills.length}</span></div>{showSkills?<div className={styles.skills}>{skills.map(skill=><span key={skill}>{skill}</span>)}</div>:<button type="button" className={styles.inlineEmpty} onClick={onEdit}><Plus size={18}/><strong>Add your stack</strong><span>The languages, tools, and ideas you know.</span></button>}</section>}
        {v.githubProjects&&(showProjects||onEdit)&&<section className={`${styles.card} ${styles.reposCard}`}><div className={styles.sectionHeading}><GitBranch size={17}/><h2>GitHub repositories</h2><span className={styles.counter}>{projects.length}</span></div>{showProjects?<div className={styles.projects}>{projects.map((project,index)=><a className={styles.project} href={project.url} key={`${project.url}-${index}`} target="_blank" rel="noreferrer"><div className={styles.projectTop}><GitBranch size={14}/><h3>{project.name}</h3><ArrowUpRight size={15}/></div><p>{project.description||'Explore this project on GitHub.'}</p><span className={styles.projectOwner}>{project.url.split('/')[3]}</span></a>)}</div>:<button type="button" className={styles.inlineEmpty} onClick={onEdit}><GitBranch size={20}/><strong>Built something good?</strong><span>Your featured repositories will live here.</span></button>}</section>}
      </div>
      {onEdit&&v.githubProjects&&projects.length<6&&<button type="button" className={styles.addProject} onClick={onEdit}><span className={styles.addProjectIcon}><Plus size={19}/></span><span><strong>Your next great thing goes here.</strong><small>Add a project you’re proud of.</small></span><ArrowUpRight size={18}/></button>}
      {extras.length>0&&<dl className={styles.extraDetails}>{extras.map(([label,value])=><div key={String(label)}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
      {!showBio&&!showSkills&&!showProjects&&!onEdit&&<div className={styles.empty}><p>This person hasn’t shared more details yet.</p></div>}
    </div>
  </div>
}
