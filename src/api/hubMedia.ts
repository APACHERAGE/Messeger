import { browserStorageKey } from './runtime'

export type HubAttachment = { id: string; name: string; type: string; size: number }
export const MAX_POST_FILES = 4
export const MAX_POST_BYTES = 30 * 1024 * 1024
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'
export const VIDEO_ACCEPT = 'video/mp4,video/webm'
const supported = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']

export function isHubAttachment(value: unknown): value is HubAttachment {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && typeof item.name === 'string' && typeof item.type === 'string'
    && supported.includes(item.type) && typeof item.size === 'number' && item.size > 0 && item.size <= MAX_VIDEO_BYTES
}

export function mediaType(file: File): string {
  if (supported.includes(file.type)) return file.type
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm' } as Record<string, string>)[extension] ?? ''
}

export async function validatePostFiles(files: File[]): Promise<void> {
  if (files.length > MAX_POST_FILES) throw new Error('You can add up to 4 photos, GIFs, or videos per post.')
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_POST_BYTES) throw new Error('Attachments must total 30 MB or less.')
  for (const file of files) {
    const type = mediaType(file)
    if (!type) throw new Error('Choose a JPG, PNG, WebP, GIF, MP4, or WebM file.')
    if (!file.size) throw new Error(`${file.name} is empty. Choose another file.`)
    if (file.size > (type.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) throw new Error(`${file.name} is too large. Photos and GIFs: up to 5 MB. Videos: up to 20 MB.`)
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
    const ascii = (start: number, count: number) => String.fromCharCode(...bytes.slice(start, start + count))
    const signature = type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : type === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
      : type === 'image/gif' ? ['GIF87a', 'GIF89a'].includes(ascii(0, 6))
      : type === 'image/webp' ? ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP'
      : type === 'video/mp4' ? ascii(4, 4) === 'ftyp'
      : [26, 69, 223, 163].every((byte, index) => bytes[index] === byte)
    if (!signature) throw new Error(`${file.name} does not match its file type. Choose a valid image, GIF, or video.`)
  }
}

let database: Promise<IDBDatabase> | undefined
function openDatabase() {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Media storage is unavailable in this browser.')); return }
    const request = indexedDB.open(`${browserStorageKey('hub')}-media`, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('files')
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); database = undefined }; resolve(request.result) }
    request.onerror = () => reject(new Error('Could not open media storage on this device.'))
    request.onblocked = () => reject(new Error('Close other Nightfall tabs and try adding media again.'))
  }).catch(error => { database = undefined; throw error })
  return database
}

export async function saveLocalMedia(userId: string, files: File[]): Promise<HubAttachment[]> {
  const db = await openDatabase()
  const attachments = files.map(file => ({ id: crypto.randomUUID(), name: file.name.slice(0, 255), type: mediaType(file), size: file.size }))
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite')
    const store = tx.objectStore('files')
    attachments.forEach((item, index) => store.put(files[index].slice(0, files[index].size, item.type), `${userId}/${item.id}`))
    tx.oncomplete = () => resolve()
    tx.onerror = tx.onabort = () => reject(new Error('Could not save media on this device. Free browser storage and try again.'))
  })
  return attachments
}

export async function readLocalMedia(userId: string, id: string): Promise<Blob> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readonly')
    const request = tx.objectStore('files').get(`${userId}/${id}`)
    request.onsuccess = () => request.result instanceof Blob ? resolve(request.result) : reject(new Error('This attachment is no longer stored on this device.'))
    request.onerror = () => reject(new Error('Could not load this attachment.'))
  })
}

export async function deleteLocalMedia(userId: string, attachments: HubAttachment[]): Promise<void> {
  if (!attachments.length) return
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite')
    attachments.forEach(item => tx.objectStore('files').delete(`${userId}/${item.id}`))
    tx.oncomplete = () => resolve()
    tx.onerror = tx.onabort = () => reject(new Error('Could not remove saved media from this device.'))
  })
}
