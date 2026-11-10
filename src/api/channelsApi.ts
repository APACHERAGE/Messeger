import { apiRequest } from './http'
import { browserStorageKey, isPublicPreview } from './runtime'

export type Channel = {
  id: string
  title: string
  handle: string
  description: string
  ownerId: string
  ownerName: string
  ownerUsername: string
  followers: number
  subscribed: boolean
  createdAt: string
  commentsEnabled: boolean
}

export type ChannelPost = {
  id: string
  author: string
  username: string
  body: string
  createdAt: string
  link?: string
  attachmentName?: string
  attachmentType?: string
  attachmentData?: string
  pinned: boolean
  commentsEnabled: boolean
  commentCount: number
  editedAt?: string | null
}

export type ChannelDetail = { channel: Channel; posts: ChannelPost[] }

export type ChannelComment = {
  id: string; authorId: string; author: string; username: string; body: string; parentId: string | null
  parentAuthor: string | null; parentBody: string | null; createdAt: string; removed: boolean
  photoUrl: string | null; reactions: { emoji: string; count: number; mine: boolean }[]; canDelete: boolean
}
export type CommentPage = { items: ChannelComment[]; hasMore: boolean; nextPage: number; total: number }
export type ChannelSubscriber = { id: string; name: string; username: string }
export const commentEmoji = ['👍', '❤️', '😂', '🔥', '🎉', '👀'] as const

type LocalChannelStore = { channels: Channel[]; posts: Record<string, ChannelPost[]>; comments?: Record<string, ChannelComment[]> }

let serverAvailable: boolean | null = isPublicPreview ? false : null

export function isLocalChannelMode() {
  return serverAvailable === false
}

function localStorageKey(userId: string) {
  return `${browserStorageKey('channels')}-${userId}`
}

function isLocalChannelStore(value: unknown): value is LocalChannelStore {
  if (!value || typeof value !== 'object') return false
  const store = value as Record<string, unknown>
  return Array.isArray(store.channels)
    && store.channels.every(channel => channel && typeof channel === 'object' && typeof (channel as Channel).id === 'string')
    && !!store.posts
    && typeof store.posts === 'object'
}

function readLocalStore(userId: string): LocalChannelStore {
  const saved = localStorage.getItem(localStorageKey(userId))
  if (!saved) return { channels: [], posts: {} }
  const parsed: unknown = JSON.parse(saved)
  if (!isLocalChannelStore(parsed)) throw new Error('Saved local channels are corrupted.')
  parsed.channels=parsed.channels.map(c=>({...c,commentsEnabled:c.commentsEnabled??true}))
  parsed.posts=Object.fromEntries(Object.entries(parsed.posts).map(([id,posts])=>[id,posts.map(p=>({...p,pinned:p.pinned??false,commentsEnabled:p.commentsEnabled??true,commentCount:p.commentCount??0}))]))
  return parsed
}

function writeLocalStore(userId: string, store: LocalChannelStore) {
  localStorage.setItem(localStorageKey(userId), JSON.stringify(store))
}

async function useServer(): Promise<boolean> {
  if (serverAvailable !== null) return serverAvailable
  try {
    const response = await fetch('/api/health', { credentials: 'same-origin', signal: AbortSignal.timeout(3000) })
    serverAvailable = response.ok
  } catch {
    serverAvailable = false
  }
  return serverAvailable
}

function localChannel(store: LocalChannelStore, channelId: string): Channel {
  const channel = store.channels.find(item => item.id === channelId)
  if (!channel) throw new Error('Channel not found.')
  return channel
}

export async function listChannels(userId: string) {
  if (await useServer()) return apiRequest<Channel[]>('channels')
  return readLocalStore(userId).channels
}

export async function getChannel(channelId: string, userId: string) {
  if (await useServer()) return apiRequest<ChannelDetail>(`channels/${encodeURIComponent(channelId)}`)
  const store = readLocalStore(userId)
  return { channel: localChannel(store, channelId), posts: store.posts[channelId] ?? [] }
}

export async function createChannel(title: string, description: string, userId: string) {
  if (await useServer()) return apiRequest<Channel>('channels', { method: 'POST', body: JSON.stringify({ title, description }) })
  const store = readLocalStore(userId)
  const id = crypto.randomUUID()
  const channel: Channel = {
    id,
    title,
    handle: `channel-${id.slice(0, 8)}`,
    description,
    ownerId: userId,
    ownerName: 'You',
    ownerUsername: 'local',
    followers: 1,
    subscribed: true,
    createdAt: new Date().toISOString(),
    commentsEnabled: true,
  }
  store.channels = [channel, ...store.channels]
  store.posts[id] = []
  writeLocalStore(userId, store)
  return channel
}

export async function followChannel(channelId: string, userId: string) {
  if (await useServer()) return apiRequest<Channel>(`channels/${encodeURIComponent(channelId)}/follow`, { method: 'POST' })
  const store = readLocalStore(userId)
  const channel = localChannel(store, channelId)
  if (!channel.subscribed) {
    channel.subscribed = true
    channel.followers += 1
  }
  writeLocalStore(userId, store)
  return channel
}

export async function unfollowChannel(channelId: string, userId: string) {
  if (await useServer()) return apiRequest<void>(`channels/${encodeURIComponent(channelId)}/follow`, { method: 'DELETE' })
  const store = readLocalStore(userId)
  const channel = localChannel(store, channelId)
  if (channel.ownerId===userId) throw new Error('Transfer ownership before leaving, or delete the channel.')
  if (channel.subscribed) {
    channel.subscribed = false
    channel.followers = Math.max(0, channel.followers - 1)
  }
  writeLocalStore(userId, store)
}

export const CHANNEL_ATTACHMENT_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain',
] as const
export const CHANNEL_ATTACHMENT_ACCEPT = CHANNEL_ATTACHMENT_TYPES.join(',')
export const CHANNEL_FILE_LIMIT_BYTES = 1_000_000

export async function publishChannelPost(channelId: string, body: string, userId: string, file?: File, link = '') {
  let attachmentData: string | undefined
  if (file) {
    if (file.size > CHANNEL_FILE_LIMIT_BYTES) throw new Error('Attachments must be smaller than 1 MB.')
    if (!(CHANNEL_ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
      throw new Error('Channels accept images, PDF, and text files only.')
    }
    attachmentData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Could not read the selected file.'))
      reader.readAsDataURL(file)
    })
  }
  const attachment = file ? {
    attachmentName: file.name,
    attachmentType: file.type,
    attachmentData,
  } : {}
  const payload = { body, link: link || undefined, ...attachment }
  if (await useServer()) return apiRequest<ChannelPost>(`channels/${encodeURIComponent(channelId)}/posts`, { method: 'POST', body: JSON.stringify(payload) })
  const store = readLocalStore(userId)
  const channel = localChannel(store, channelId)
  if (channel.ownerId !== userId) throw new Error('Only the channel owner can publish.')
  const post: ChannelPost = {
    id: crypto.randomUUID(),
    author: channel.ownerName,
    username: channel.ownerUsername,
    body,
    createdAt: new Date().toISOString(),
    link: link || undefined,
    ...attachment,
    pinned: false, commentsEnabled: true, commentCount: 0,
  }
  store.posts[channelId] = [post, ...(store.posts[channelId] ?? [])]
  writeLocalStore(userId, store)
  return post
}


function owned(store: LocalChannelStore, channelId: string, userId: string) {
  const channel=localChannel(store,channelId)
  if(channel.ownerId!==userId) throw new Error('Only the channel owner can do this.')
  return channel
}
function localPost(store: LocalChannelStore,channelId: string,postId: string) {
  localChannel(store,channelId)
  const post=store.posts[channelId]?.find(p=>p.id===postId)
  if(!post) throw new Error('Post not found in this channel.')
  return post
}
const channelPath=(channelId:string)=>`channels/${encodeURIComponent(channelId)}`
const postPath=(channelId:string,postId:string)=>`${channelPath(channelId)}/posts/${encodeURIComponent(postId)}`

export async function updateChannel(channelId:string,userId:string,input:Pick<Channel,'title'|'description'|'commentsEnabled'>) {
  if(!input.title.trim()||input.title.length>72||input.description.length>240) throw new Error('Check the channel name and description.')
  if(await useServer()) await apiRequest<void>(channelPath(channelId),{method:'PUT',body:JSON.stringify(input)})
  else { const store=readLocalStore(userId); Object.assign(owned(store,channelId,userId),input,{title:input.title.trim(),description:input.description.trim()}); writeLocalStore(userId,store) }
  return getChannel(channelId,userId)
}
export async function listChannelSubscribers(channelId:string,userId:string) {
  if(await useServer()) return apiRequest<ChannelSubscriber[]>(`${channelPath(channelId)}/subscribers`)
  const store=readLocalStore(userId),channel=owned(store,channelId,userId)
  return [{id:userId,name:channel.ownerName,username:channel.ownerUsername}]
}
export async function transferChannel(channelId:string,userId:string,newOwnerId:string) {
  if(!newOwnerId||newOwnerId===userId) throw new Error('Choose another subscriber.')
  if(!await useServer()) throw new Error('Ownership transfer requires the shared API and another subscriber.')
  await apiRequest<void>(`${channelPath(channelId)}/transfer`,{method:'POST',body:JSON.stringify({newOwnerId})})
  return getChannel(channelId,userId)
}
export async function deleteChannel(channelId:string,userId:string,confirmation:string) {
  if(await useServer()) return apiRequest<void>(channelPath(channelId),{method:'DELETE',body:JSON.stringify({confirmation})})
  const store=readLocalStore(userId),channel=owned(store,channelId,userId)
  if(confirmation!==channel.title) throw new Error('Type the channel name to confirm deletion.')
  for(const post of store.posts[channelId]??[]) delete store.comments?.[post.id]
  store.channels=store.channels.filter(c=>c.id!==channelId); delete store.posts[channelId]; writeLocalStore(userId,store)
}
export async function updateChannelPost(channelId:string,postId:string,userId:string,input:Partial<Pick<ChannelPost,'body'|'pinned'|'commentsEnabled'>>) {
  if(await useServer()) await apiRequest<void>(postPath(channelId,postId),{method:'PATCH',body:JSON.stringify(input)})
  else {
    const store=readLocalStore(userId); owned(store,channelId,userId); const post=localPost(store,channelId,postId)
    if(input.body!==undefined&&((!input.body.trim()&&!post.link&&!post.attachmentData)||input.body.length>2000)) throw new Error('A post needs text, a link or an attachment (text up to 2000 characters).')
    Object.assign(post,input,input.body!==undefined?{body:input.body.trim(),editedAt:new Date().toISOString()}:{})
    writeLocalStore(userId,store)
  }
  return (await getChannel(channelId,userId)).posts.find(p=>p.id===postId)!
}
export async function deleteChannelPost(channelId:string,postId:string,userId:string) {
  if(await useServer()) return apiRequest<void>(postPath(channelId,postId),{method:'DELETE'})
  const store=readLocalStore(userId); owned(store,channelId,userId); localPost(store,channelId,postId)
  store.posts[channelId]=store.posts[channelId].filter(p=>p.id!==postId); delete store.comments?.[postId]; writeLocalStore(userId,store)
}
export async function listChannelComments(channelId:string,postId:string,userId:string,page=0):Promise<CommentPage> {
  if(await useServer()) return apiRequest<CommentPage>(`${postPath(channelId,postId)}/comments?page=${page}`)
  const store=readLocalStore(userId); localPost(store,channelId,postId); const all=store.comments?.[postId]??[]
  return {items:all.slice(page*50,(page+1)*50),hasMore:all.length>(page+1)*50,nextPage:page+1,total:all.filter(c=>!c.removed).length}
}
async function readCommentPhoto(file:File) {
  if(!['image/png','image/jpeg','image/gif','image/webp'].includes(file.type)||file.size===0||file.size>1_000_000) throw new Error('Choose a PNG, JPG, GIF or WebP photo, up to 1 MB.')
  return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Could not read the photo.'));reader.readAsDataURL(file)})
}
export async function addChannelComment(channelId:string,postId:string,user:{id:string;name:string;username:string},body:string,parentId:string|null,photo?:File) {
  if(body.length>2000||(!body.trim()&&!photo)) throw new Error('Write a comment or add a photo (text up to 2000 characters).')
  const photoData=photo?await readCommentPhoto(photo):undefined
  if(await useServer()) return apiRequest<ChannelComment>(`${postPath(channelId,postId)}/comments`,{method:'POST',body:JSON.stringify({body,parentId,photoData})})
  const store=readLocalStore(user.id),channel=localChannel(store,channelId),post=localPost(store,channelId,postId)
  if(!channel.commentsEnabled||!post.commentsEnabled) throw new Error('Comments are closed for this post.')
  const all=store.comments?.[postId]??[],parent=parentId?all.find(c=>c.id===parentId):undefined
  if(parentId&&(!parent||parent.removed)) throw new Error('Reply target is no longer available.')
  const comment:ChannelComment={id:crypto.randomUUID(),authorId:user.id,author:user.name,username:user.username,body:body.trim(),parentId,parentAuthor:parent?.author??null,parentBody:parent?.body.slice(0,160)??null,createdAt:new Date().toISOString(),removed:false,photoUrl:photoData??null,reactions:[],canDelete:true}
  store.comments??={};store.comments[postId]=[...all,comment];post.commentCount=all.filter(c=>!c.removed).length+1;writeLocalStore(user.id,store);return comment
}
export async function deleteChannelComment(channelId:string,postId:string,commentId:string,userId:string) {
  if(await useServer()) return apiRequest<void>(`${postPath(channelId,postId)}/comments/${encodeURIComponent(commentId)}`,{method:'DELETE'})
  const store=readLocalStore(userId),channel=localChannel(store,channelId),post=localPost(store,channelId,postId),all=store.comments?.[postId]??[],comment=all.find(c=>c.id===commentId)
  if(!comment||(comment.authorId!==userId&&channel.ownerId!==userId)) throw new Error('Only the author or channel owner can remove this comment.')
  Object.assign(comment,{removed:true,body:'',photoUrl:null,reactions:[],canDelete:false})
  for(const reply of all) if(reply.parentId===commentId) reply.parentBody='Comment removed'
  post.commentCount=all.filter(c=>!c.removed).length;writeLocalStore(userId,store)
}
export async function reactChannelComment(channelId:string,postId:string,commentId:string,userId:string,emoji:string) {
  if(!commentEmoji.includes(emoji as typeof commentEmoji[number])) throw new Error('Unsupported reaction.')
  if(await useServer()) return apiRequest<ChannelComment>(`${postPath(channelId,postId)}/comments/${encodeURIComponent(commentId)}/reactions`,{method:'POST',body:JSON.stringify({emoji})})
  const store=readLocalStore(userId);localPost(store,channelId,postId);const c=store.comments?.[postId]?.find(c=>c.id===commentId)
  if(!c||c.removed) throw new Error('Comment not found.')
  const reaction=c.reactions.find(r=>r.emoji===emoji)
  if(reaction) {reaction.count+=reaction.mine?-1:1;reaction.mine=!reaction.mine;c.reactions=c.reactions.filter(r=>r.count>0)}
  else c.reactions.push({emoji,count:1,mine:true})
  writeLocalStore(userId,store);return c
}
