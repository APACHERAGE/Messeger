import { getChannel, listChannels } from './channelsApi'
import { deleteLocalMedia, isHubAttachment, mediaType, saveLocalMedia, validatePostFiles, type HubAttachment } from './hubMedia'
import { apiRequest } from './http'
import { browserStorageKey, isPublicPreview } from './runtime'

export type HubPost = {
  id: string
  authorId?: string
  wallOwnerId?: string
  wallOwnerName?: string
  audience?: 'friends'|'public'
  canEdit?: boolean
  canDelete?: boolean
  author: string
  username: string
  createdAt?: string
  time?: string
  body: string
  attachments?: HubAttachment[]
  likes: number
  comments: number
  liked?: boolean
  accent: 'cyan' | 'violet' | 'amber'
}

export type HubComment = {
  id: string
  postId: string
  author: string
  username: string
  body: string
  createdAt: string
}

export type HubState = {
  posts: HubPost[]
  likedPostIds: string[]
  savedRoomIds: string[]
  comments: HubComment[]
}

export type HubStorageMode = 'server' | 'local'

export const demoHubState: HubState = {
  posts: [],
  likedPostIds: [],
  savedRoomIds: [],
  comments: [],
}

type NewComment = { body: string }

let serverAvailable: boolean | null = isPublicPreview ? false : null

function storageKey(userId: string) {
  return `${browserStorageKey('hub')}-${userId}`
}

function isHubPost(value: unknown): value is HubPost {
  if (!value || typeof value !== 'object') return false
  const post = value as Record<string, unknown>
  return typeof post.id === 'string'
    && typeof post.author === 'string'
    && typeof post.username === 'string'
    && typeof post.body === 'string'
    && (post.attachments === undefined || Array.isArray(post.attachments) && post.attachments.every(isHubAttachment))
    && typeof post.likes === 'number'
    && typeof post.comments === 'number'
    && (post.accent === 'cyan' || post.accent === 'violet' || post.accent === 'amber')
}

function isHubComment(value: unknown): value is HubComment {
  if (!value || typeof value !== 'object') return false
  const comment = value as Record<string, unknown>
  return typeof comment.id === 'string'
    && typeof comment.postId === 'string'
    && typeof comment.author === 'string'
    && typeof comment.username === 'string'
    && typeof comment.body === 'string'
    && typeof comment.createdAt === 'string'
}

function isHubState(value: unknown): value is Omit<HubState, 'comments'> & { comments?: HubComment[] } {
  if (!value || typeof value !== 'object') return false
  const state = value as Record<string, unknown>
  return Array.isArray(state.posts)
    && state.posts.every(isHubPost)
    && Array.isArray(state.likedPostIds)
    && state.likedPostIds.every(id => typeof id === 'string')
    && Array.isArray(state.savedRoomIds)
    && state.savedRoomIds.every(id => typeof id === 'string')
    && (state.comments === undefined || (Array.isArray(state.comments) && state.comments.every(isHubComment)))
}

function readLocalState(userId: string): HubState {
  const saved = localStorage.getItem(storageKey(userId))
  if (!saved) return { ...demoHubState, posts: [], likedPostIds: [], savedRoomIds: [], comments: [] }

  const parsed: unknown = JSON.parse(saved)
  if (!isHubState(parsed)) throw new Error('Saved hub data has an invalid shape.')
  return {
    ...parsed,
    posts: parsed.posts.filter(post => !post.id.startsWith('seed-')).map(post => ({
      ...post,
      authorId: post.authorId ?? userId,
    })),
    comments: parsed.comments ?? [],
  }
}

function writeLocalState(userId: string, state: HubState) {
  localStorage.setItem(storageKey(userId), JSON.stringify(state))
}

async function useServer(userId?: string): Promise<boolean> {
  if (isPublicPreview || userId === 'local-demo') return false
  if (userId) return true
  if (serverAvailable !== null) return serverAvailable
  try {
    const response = await fetch('/api/health', { credentials: 'same-origin', signal: AbortSignal.timeout(3000) })
    serverAvailable = response.ok
  } catch {
    serverAvailable = false
  }
  return serverAvailable
}

export async function getHubStorageMode(userId?: string): Promise<HubStorageMode> {
  return await useServer(userId) ? 'server' : 'local'
}

export async function listHubPosts(userId: string, authorId?: string): Promise<HubPost[]> {
  if (await useServer(userId)) return apiRequest<HubPost[]>(`hub/posts${authorId ? `?authorId=${encodeURIComponent(authorId)}` : ''}`)
  if (authorId && authorId !== userId) throw new Error('Other people’s walls require a connected account and a confirmed friendship.')
  const state = readLocalState(userId)
  return state.posts.filter(post=>!authorId||(post.wallOwnerId??post.authorId)===authorId).map(post => ({ ...post, liked: state.likedPostIds.includes(post.id) }))
}

export async function createHubPost(body: string, user: { id: string; displayName: string; username: string }, files: File[] = [], options: {wallOwnerId?:string;audience?:'friends'|'public'} = {}): Promise<HubPost> {
  const wallOwnerId=options.wallOwnerId??user.id, audience=options.audience??'friends'
  if(!['friends','public'].includes(audience))throw new Error('Choose friends-only or public visibility.')
  body = body.trim()
  if (!body && !files.length) throw new Error('Add some text, a photo, a GIF, or a video to your post.')
  if (body.length > 500) throw new Error('Post text must be 500 characters or fewer.')
  await validatePostFiles(files)
  if (await useServer(user.id)) {
    if (!files.length) return apiRequest<HubPost>('hub/posts', { method: 'POST', body: JSON.stringify({ body,wallOwnerId,audience }) })
    const form = new FormData()
    form.set('body', body)
    form.set('wallOwnerId',wallOwnerId);form.set('audience',audience)
    files.forEach(file => form.append('files', file.slice(0, file.size, mediaType(file)), file.name))
    return apiRequest<HubPost>('hub/posts', { method: 'POST', body: form, signal: AbortSignal.timeout(90000) })
  }

  if(wallOwnerId!==user.id)throw new Error('Posting to someone else’s wall requires a connected account.')
  const attachments = files.length ? await saveLocalMedia(user.id, files) : []
  const post: HubPost = {
    id: crypto.randomUUID(),
    authorId: user.id,
    wallOwnerId,wallOwnerName:user.displayName,audience,canEdit:true,canDelete:true,
    author: user.displayName,
    username: user.username,
    createdAt: new Date().toISOString(),
    body,
    attachments,
    likes: 0,
    comments: 0,
    liked: false,
    accent: 'cyan',
  }
  try { const state = readLocalState(user.id); writeLocalState(user.id, { ...state, posts: [post, ...state.posts] }) }
  catch {
    await deleteLocalMedia(user.id, attachments).catch(() => {})
    throw new Error('Could not save your post on this device. Free browser storage and try again; your draft is kept.')
  }
  return post
}

export async function updateHubPost(postId: string, body: string, userId: string): Promise<HubPost> {
  body = body.trim()
  if (body.length > 500) throw new Error('Post text must be 500 characters or fewer.')
  if (await useServer(userId)) {
    return apiRequest<HubPost>(`hub/posts/${encodeURIComponent(postId)}`, {
      method: 'PUT',
      body: JSON.stringify({ body }),
    })
  }

  const state = readLocalState(userId)
  const post = state.posts.find(item => item.id === postId)
  if (!post) throw new Error('This post is no longer available in the local feed.')
  if (post.authorId !== userId) throw new Error('You can only edit your own posts.')
  if (!body && !post.attachments?.length) throw new Error('A text-only post cannot be empty.')
  const updated = { ...post, body }
  writeLocalState(userId, { ...state, posts: state.posts.map(item => item.id === postId ? updated : item) })
  return updated
}

export async function deleteHubPost(postId: string, userId: string): Promise<void> {
  if (await useServer(userId)) {
    return apiRequest<void>(`hub/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' })
  }

  const state = readLocalState(userId)
  const post = state.posts.find(item => item.id === postId)
  if (!post) throw new Error('This post is no longer available in the local feed.')
  if (post.authorId !== userId) throw new Error('You can only delete your own posts.')
  writeLocalState(userId, {
    ...state,
    posts: state.posts.filter(item => item.id !== postId),
    likedPostIds: state.likedPostIds.filter(id => id !== postId),
    comments: state.comments.filter(comment => comment.postId !== postId),
  })
  await deleteLocalMedia(userId, post.attachments ?? []).catch(() => { /* The post is removed even if browser media cleanup fails. */ })
}

export async function toggleHubReaction(postId: string, userId: string): Promise<HubPost> {
  if (await useServer(userId)) return apiRequest<HubPost>(`hub/posts/${encodeURIComponent(postId)}/reactions`, { method: 'POST' })

  const state = readLocalState(userId)
  const post = state.posts.find(item => item.id === postId)
  if (!post) throw new Error('This post is no longer available in the local feed.')
  const liked = !state.likedPostIds.includes(postId)
  const updated = { ...post, likes: Math.max(0, post.likes + (liked ? 1 : -1)), liked }
  writeLocalState(userId, {
    ...state,
    posts: state.posts.map(item => item.id === postId ? updated : item),
    likedPostIds: liked
      ? [...state.likedPostIds, postId]
      : state.likedPostIds.filter(id => id !== postId),
  })
  return updated
}

export async function listHubComments(postId: string, userId: string): Promise<HubComment[]> {
  if (await useServer(userId)) return apiRequest<HubComment[]>(`hub/posts/${encodeURIComponent(postId)}/comments`)
  const state = readLocalState(userId)
  if (!state.posts.some(post => post.id === postId)) throw new Error('This post is no longer available in the local feed.')
  return state.comments.filter(comment => comment.postId === postId)
}

export async function createHubComment(postId: string, body: string, user: { id: string; displayName: string; username: string }): Promise<HubComment> {
  if (await useServer(user.id)) {
    return apiRequest<HubComment>(`hub/posts/${encodeURIComponent(postId)}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    })
  }

  const state = readLocalState(user.id)
  const post = state.posts.find(item => item.id === postId)
  if (!post) throw new Error('This post is no longer available in the local feed.')
  const comment: HubComment = {
    id: crypto.randomUUID(),
    postId,
    author: user.displayName,
    username: user.username,
    body,
    createdAt: new Date().toISOString(),
  }
  writeLocalState(user.id, {
    ...state,
    posts: state.posts.map(item => item.id === postId ? { ...item, comments: item.comments + 1 } : item),
    comments: [...state.comments, comment],
  })
  return comment
}

export type FeedEntry={id:string;kind:'post'|'channel';reason:'you'|'friend'|'following'|'recommended'|'channel';createdAt:string;post:HubPost|null;channel:{id:string;title:string;handle:string;postId:string;body:string;createdAt:string;link?:string}|null}
export async function getGeneralFeed(userId:string,tab:'for-you'|'following'):Promise<FeedEntry[]> {
 if(await useServer(userId))return apiRequest<FeedEntry[]>(`hub/feed?tab=${tab}`)
 const posts=await listHubPosts(userId)
 const result:FeedEntry[]=posts.map(post=>({id:post.id,kind:'post',reason:'you',createdAt:post.createdAt??new Date(0).toISOString(),post,channel:null}))
 const channels=await listChannels(userId)
 for(const channel of channels.filter(item=>item.subscribed)){
  const detail=await getChannel(channel.id,userId)
  for(const post of detail.posts)result.push({id:`channel:${post.id}`,kind:'channel',reason:'channel',createdAt:post.createdAt,post:null,channel:{id:channel.id,title:channel.title,handle:channel.handle,postId:post.id,body:post.body,createdAt:post.createdAt,link:post.link}})
 }
 return result.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))
}
