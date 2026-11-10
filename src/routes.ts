export type View = 'home' | 'account' | 'chats' | 'contacts' | 'channels' | 'discussions' | 'mail'
export type RouteTarget = { threadId?: string; channelId?: string; personId?:string }

export function routeFromPath(pathname: string): { view: View; target: RouteTarget } {
  let parts: string[]
  try { parts = pathname.split('/').filter(Boolean).map(part => decodeURIComponent(part)) }
  catch { return { view: 'home', target: {} } }
  if (parts[0] === 'threads') return { view: 'discussions', target: { threadId: parts[1] } }
  if (parts[0] === 'channels') return { view: 'channels', target: { channelId: parts[1] } }
  if (parts[0] === 'messages' || parts[0] === 'chats') return { view: 'chats', target: {} }
  if(parts[0]==='people'&&parts[1])return {view:'contacts',target:{personId:parts[1]}}
  if (parts[0] === 'contacts' || parts[0] === 'friends') return { view: 'contacts', target: {} }
  if (parts[0] === 'mail') return { view: 'mail', target: {} }
  if (parts[0] === 'settings' || parts[0] === 'profile' && parts[1] === 'edit') return { view: 'account', target: {} }
  // /profile remains a compatible alias for the unified home page.
  return { view: 'home', target: {} }
}

export function pathForView(view: View, target: RouteTarget = {}): string {
  if(view==='contacts'&&target.personId)return `/people/${encodeURIComponent(target.personId)}`
  if (view === 'discussions' && target.threadId) return `/threads/${encodeURIComponent(target.threadId)}`
  if (view === 'channels' && target.channelId) return `/channels/${encodeURIComponent(target.channelId)}`
  return { home: '/', account: '/profile/edit', chats: '/messages', contacts: '/contacts', channels: '/channels', discussions: '/threads', mail: '/mail' }[view]
}
