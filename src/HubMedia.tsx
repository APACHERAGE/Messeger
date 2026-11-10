import { useEffect, useState } from 'react'
import { Download, Film, X } from 'lucide-react'
import { readLocalMedia, mediaType, type HubAttachment } from './api/hubMedia'
import type { HubStorageMode } from './api/hubApi'

type Props = { attachment: HubAttachment; postId: string; userId: string; storageMode: HubStorageMode | null }

export default function HubMedia({ attachment, postId, userId, storageMode }: Props) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    let objectUrl = ''
    setUrl(''); setError('')
    if (storageMode === 'server') setUrl(`/api/hub/posts/${encodeURIComponent(postId)}/media/${encodeURIComponent(attachment.id)}`)
    else if (storageMode === 'local') readLocalMedia(userId, attachment.id).then(blob => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }).catch(error => { if (active) setError(error instanceof Error ? error.message : 'Could not load this attachment.') })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [attachment.id, postId, storageMode, userId])
  const video = attachment.type.startsWith('video/')
  return <figure className="hub-published-media">
    {url && (video ? <video src={url} controls playsInline preload="metadata" aria-label={attachment.name} onError={() => setError('This video cannot be previewed in your browser. You can download it below.')} /> : <img src={url} alt={attachment.name} loading="lazy" onError={() => setError('This image could not be displayed.')} />)}
    {!url && !error && <span className="hub-media-loading">Loading attachment…</span>}
    {error && <p className="hub-media-error" role="status">{error}</p>}
    <figcaption><span>{attachment.type === 'image/gif' ? 'GIF' : video ? 'VIDEO' : 'PHOTO'}</span><span title={attachment.name}>{attachment.name}</span>{url && <a href={url} download={attachment.name} aria-label={`Download ${attachment.name}`}><Download size={14} /></a>}</figcaption>
  </figure>
}

export function DraftMedia({ file, onRemove, disabled }: { file: File; onRemove: () => void; disabled: boolean }) {
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => { const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next) }, [file])
  const video = mediaType(file).startsWith('video/')
  return <figure className="hub-draft-media">
    {url && !failed && (video ? <video src={url} controls playsInline preload="metadata" onError={() => setFailed(true)} /> : <img src={url} alt={file.name} onError={() => setFailed(true)} />)}
    {failed && <div className="hub-draft-unavailable"><Film size={24} /><span>Preview unavailable</span></div>}
    {mediaType(file) === 'image/gif' && <span className="hub-gif-badge">GIF</span>}
    <button type="button" className="hub-remove-media" onClick={onRemove} disabled={disabled} aria-label={`Remove ${file.name}`}><X size={15} /></button>
    <figcaption title={file.name}>{file.name}<small>{(file.size / (1024 * 1024)).toFixed(1)} MB</small></figcaption>
  </figure>
}
