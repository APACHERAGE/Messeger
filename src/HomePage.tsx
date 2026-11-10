import { useState } from 'react'
import { Globe, UserRound } from 'lucide-react'
import ProfileOverview from './ProfileOverview'
import UserWall from './UserWall'
import GeneralFeed from './GeneralFeed'
import type { Profile } from './api/profileApi'
import './home.css'
import './stream.css'

type Props={userId:string;profile:Profile;onEdit:()=>void;onSettings:()=>void;onOpenThreads:()=>void;onNotice:(message:string)=>void;onOpenPerson?:(id:string)=>void;onOpenChannel?:(id:string)=>void}
export default function HomePage({userId,profile,onEdit,onSettings,onOpenThreads,onNotice,onOpenPerson=()=>{},onOpenChannel=()=>{}}:Props){
 const [wall,setWall]=useState<'mine'|'general'>('mine'),[generalVisited,setGeneralVisited]=useState(false)
 const p=profile.preferences,user={id:userId,displayName:profile.displayName,username:profile.username}
 return <section className="home-profile-page" aria-label="Your home and profile"><div className="home-profile-inner">
  <ProfileOverview profile={profile} onEdit={onEdit} onSettings={onSettings}/>
  <nav className="wall-switcher" aria-label="Wall view"><button type="button" aria-pressed={wall==='mine'} onClick={()=>setWall('mine')}><UserRound size={15}/>My wall</button><button type="button" aria-pressed={wall==='general'} onClick={()=>{setGeneralVisited(true);setWall('general')}}><Globe size={15}/>General feed</button></nav>
  <div hidden={wall!=='mine'}><UserWall userId={userId} displayName={profile.displayName} username={profile.username} defaultAudience={p.defaultPostAudience as 'friends'|'public'} artId={p.artId} artMode={p.showDecorations?p.artMode:'off'} onOpenThreads={onOpenThreads} onNotice={onNotice} onOpenPerson={onOpenPerson}/></div>
  {generalVisited&&<div hidden={wall!=='general'}><GeneralFeed user={user} defaultAudience={p.defaultPostAudience as 'friends'|'public'} artId={p.artId} artMode={p.showDecorations?p.artMode:'off'} onOpenThreads={onOpenThreads} onOpenPerson={onOpenPerson} onOpenChannel={onOpenChannel}/></div>}
 </div></section>
}
