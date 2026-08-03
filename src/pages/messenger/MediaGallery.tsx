/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ImgHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../components/Icon'
import { useBodyInteractionLock } from '../../lib/bodyInteractionLock'
import { MessengerAudioPlayer } from './MessengerAudioPlayer'

/**
 * The upload service currently returns a MediaUpload.  Messenger only stores
 * the URL today, so a message loaded from the API may have partial metadata.
 * Keeping the renderer's input a small structural type lets us consume the
 * current contract and richer attachment snapshots added later without
 * coupling the component to either service's DTO.
 */
export interface MediaAttachment {
  url: string
  type?: string | null
  contentType?: string | null
  name?: string | null
  originalName?: string | null
  size?: number | null
  sizeBytes?: number | null
  assetId?: string | null
  state?: string | null
  expiresAt?: string | null
  mediaType?: string | null
  thumbnailUrl?: string | null
  width?: number | null
  height?: number | null
  durationMs?: number | null
  duration?: number | null
}

export type MediaKind = 'image' | 'video' | 'audio' | 'file'

export interface MediaViewerItem extends MediaAttachment {
  galleryKey: string
}

interface MediaGalleryProps {
  attachments?: readonly MediaAttachment[] | null
  className?: string
  compact?: boolean
  ariaLabel?: string
  messageId?: string
  loadConversationMedia?: () => Promise<readonly MediaViewerItem[]>
  onForward?: () => void
  mine?: boolean
  senderName?: string
}

const IMAGE_EXTENSIONS = /\.(?:png|jpe?g|gif|webp|avif|bmp|svg)$/i
const VIDEO_EXTENSIONS = /\.(?:mp4|webm|mov|m4v|mkv|ogv)$/i
const AUDIO_EXTENSIONS = /\.(?:mp3|wav|ogg|oga|m4a|aac|flac|opus|webm)$/i
const FILE_EXTENSIONS = /\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv)$/i

function fileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url, 'http://localhost').pathname
    const value = decodeURIComponent(pathname.split('/').pop() ?? '')
    return value || 'Attachment'
  } catch {
    return url.split('/').pop()?.split('?')[0] || 'Attachment'
  }
}

function extensionOf(attachment: MediaAttachment): string {
  const name = attachment.originalName || attachment.name || fileNameFromUrl(attachment.url)
  return name.split('?')[0].toLowerCase()
}

/** Resolve media type using trusted metadata first, then MIME/URL fallback. */
export function resolveMediaKind(attachment: MediaAttachment): MediaKind {
  const declared = (attachment.type || attachment.mediaType)?.toLowerCase()
  const mime = attachment.contentType?.toLowerCase() ?? ''
  const extension = extensionOf(attachment)

  // Legacy voice messages used ?kind=audio on the URL.
  try {
    if (new URL(attachment.url, 'http://localhost').searchParams.get('kind') === 'audio') return 'audio'
  } catch {
    // Ignore malformed relative URLs and continue with the other hints.
  }

  const mimeKind: MediaKind | null = mime.startsWith('image/')
    ? 'image'
    : mime.startsWith('video/')
      ? 'video'
      : mime.startsWith('audio/')
        ? 'audio'
        : mime === 'application/pdf' || mime.startsWith('application/') || mime.startsWith('text/')
          ? 'file'
          : null

  const extensionKind: MediaKind | null = IMAGE_EXTENSIONS.test(extension)
    ? 'image'
    : VIDEO_EXTENSIONS.test(extension)
      ? 'video'
      : AUDIO_EXTENSIONS.test(extension)
        ? 'audio'
        : FILE_EXTENSIONS.test(extension)
          ? 'file'
        : null

  // A known MIME type is more reliable than a stale legacy `type` field.
  if (mimeKind) return mimeKind
  if (extensionKind) return extensionKind
  if (declared === 'image' || declared === 'video' || declared === 'audio' || declared === 'file') return declared
  return 'file'
}

export function mediaDisplayName(attachment: MediaAttachment): string {
  return attachment.originalName || attachment.name || fileNameFromUrl(attachment.url)
}

interface MessengerMediaImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  attachment: MediaAttachment
  preferThumbnail?: boolean
}

/**
 * A thumbnail is only an optimization; the attachment URL remains the source
 * of truth. Older messages can contain an expired thumbnail while their
 * committed media URL is still valid, so every compact renderer must fall
 * back instead of leaving an apparently black image tile behind.
 */
export function MessengerMediaImage({ attachment, preferThumbnail = false, alt, className, onError, ...props }: MessengerMediaImageProps) {
  const originalUrl = attachment.url.trim()
  const thumbnailUrl = attachment.thumbnailUrl?.trim() ?? ''
  const candidates = Array.from(new Set(
    (preferThumbnail ? [thumbnailUrl, originalUrl] : [originalUrl, thumbnailUrl]).filter(Boolean),
  ))
  const sourceKey = candidates.join('\n')
  const [candidateIndex, setCandidateIndex] = useState(0)

  useEffect(() => setCandidateIndex(0), [sourceKey])

  const source = candidates[candidateIndex]
  if (!source) {
    return <span className={['messenger-media-image-unavailable', className].filter(Boolean).join(' ')} role="img" aria-label={alt || mediaDisplayName(attachment)}><Icon name="photo" size={18} /></span>
  }

  return <img
    {...props}
    className={className}
    src={source}
    alt={alt ?? mediaDisplayName(attachment)}
    onError={(event) => {
      onError?.(event)
      setCandidateIndex((current) => current + 1)
    }}
  />
}

function safeDownloadName(value: string): string {
  return [...value].map((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || /[\\/:*?"<>|]/.test(character) ? '_' : character
  }).join('') || 'media'
}

export function formatMediaSize(size: number | null | undefined): string {
  if (!Number.isFinite(size) || !size || size < 0) return ''
  if (size < 1024) return `${size} B`
  const units = ['KB', 'MB', 'GB']
  let value = size / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[unit]}`
}

function imageLayoutClass(count: number): string {
  if (count <= 1) return 'layout-single'
  if (count === 2) return 'layout-double'
  if (count === 3) return 'layout-triple'
  return 'layout-many'
}

function imageAspectRatio(attachment: MediaAttachment): string | undefined {
  if (!attachment.width || !attachment.height || attachment.width <= 0 || attachment.height <= 0) return undefined
  return `${attachment.width} / ${attachment.height}`
}

function DownloadMediaIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3.5v10.2m-4-3.4 4 4 4-4" /><path d="M5 15.7v2.15A2.15 2.15 0 0 0 7.15 20h9.7A2.15 2.15 0 0 0 19 17.85V15.7" /></svg>
}

function ForwardMediaIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V4m-4 4 4-4 4 4" /><path d="M5 12.8v5.05A2.15 2.15 0 0 0 7.15 20h9.7A2.15 2.15 0 0 0 19 17.85V12.8" /></svg>
}

function MediaChevronIcon({ direction }: { direction: 'previous' | 'next' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.15" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={direction === 'previous' ? 'm15 5.5-6.5 6.5 6.5 6.5' : 'm9 5.5 6.5 6.5L9 18.5'} /></svg>
}

function FileAttachment({ attachment, kind, compact, onOpen }: { attachment: MediaAttachment; kind: MediaKind; compact: boolean; onOpen?: () => void }) {
  const name = mediaDisplayName(attachment)
  const size = formatMediaSize(attachment.size ?? attachment.sizeBytes)
  if (kind === 'video') {
    return (
      <figure className="media-gallery-item media-gallery-video" data-media-kind="video">
        <button type="button" className="media-gallery-video-open" aria-label={`Open ${name}`} onClick={onOpen}>
          <video
            muted
            playsInline
            preload="metadata"
            src={attachment.url}
            poster={attachment.thumbnailUrl || undefined}
            aria-hidden="true"
          />
          <span className="media-gallery-video-play" aria-hidden="true"><Icon name="play" size={20} /></span>
        </button>
        <figcaption><a href={attachment.url} target="_blank" rel="noreferrer">{name}</a>{size && <small>{size}</small>}</figcaption>
      </figure>
    )
  }
  if (kind === 'audio') {
    return <MessengerAudioPlayer
      src={attachment.url}
      name={name}
      durationMs={attachment.durationMs ?? (attachment.duration ? attachment.duration * 1_000 : null)}
      compact={compact}
    />
  }
  return (
    <a className="media-gallery-item media-gallery-file" data-media-kind="file" href={attachment.url} target="_blank" rel="noreferrer">
      <span className="media-gallery-file-icon" aria-hidden="true">FILE</span>
      <span className="media-gallery-file-copy"><strong>{name}</strong>{size && <small>{size}</small>}</span>
    </a>
  )
}

/** Small non-interactive preview used while an upload is still pending. */
export function MediaAttachmentPreview({ attachment }: { attachment: MediaAttachment }) {
  const kind = resolveMediaKind(attachment)
  const name = mediaDisplayName(attachment)
  if (kind === 'image') return <MessengerMediaImage className="media-upload-preview-image" attachment={attachment} alt={name} />
  if (kind === 'video') return <video className="media-upload-preview-video" src={attachment.url} muted playsInline preload="metadata" aria-label={name} />
  return <span className={`media-upload-preview-label ${kind}`} aria-label={name}>{kind === 'audio' ? 'AUDIO' : 'FILE'}</span>
}

/**
 * Render message attachments in a Messenger-like collage. Images are grouped
 * into one gallery while video/audio/file attachments remain individually
 * playable/downloadable below it.
 */
export function MediaGallery({
  attachments,
  className = '',
  compact = false,
  ariaLabel = 'Message attachments',
  messageId,
  loadConversationMedia,
  onForward,
  mine = false,
  senderName = 'Người dùng',
}: MediaGalleryProps) {
  const normalized = (attachments ?? [])
    .map((attachment, attachmentIndex) => ({ attachment, attachmentIndex }))
    .filter(({ attachment }) => Boolean(attachment?.url))
  const imageItems = normalized.filter(({ attachment }) => resolveMediaKind(attachment) === 'image')
  const other = normalized.filter(({ attachment }) => resolveMediaKind(attachment) !== 'image')
  const visualItems = normalized.filter(({ attachment }) => {
    const kind = resolveMediaKind(attachment)
    return kind === 'image' || kind === 'video'
  })
  const visibleImages = imageItems.slice(0, 4)
  const audioOnly = normalized.length > 0 && normalized.every(({ attachment }) => resolveMediaKind(attachment) === 'audio')
  const rootClass = ['media-gallery', compact ? 'compact' : '', audioOnly ? 'audio-only' : '', className].filter(Boolean).join(' ')
  const [viewerMedia, setViewerMedia] = useState<MediaViewerItem[]>([])
  const [activeMediaKey, setActiveMediaKey] = useState<string | null>(null)
  const [loadingConversationMedia, setLoadingConversationMedia] = useState(false)
  const [downloadBusy, setDownloadBusy] = useState(false)
  const loadRequestId = useRef(0)
  const thumbnailStripRef = useRef<HTMLDivElement>(null)
  const activeThumbnailRef = useRef<HTMLButtonElement>(null)
  const activeMediaIndex = activeMediaKey === null
    ? -1
    : viewerMedia.findIndex((item) => item.galleryKey === activeMediaKey)
  const activeMedia = activeMediaIndex < 0 ? null : viewerMedia[activeMediaIndex]

  useBodyInteractionLock(Boolean(activeMedia), ['messenger-media-viewer-open'])

  function localGalleryMedia(attachment: MediaAttachment, attachmentIndex: number): MediaViewerItem {
    return {
      ...attachment,
      galleryKey: `${messageId ?? 'message'}:${attachmentIndex}`,
    }
  }

  const closeViewer = useCallback(() => {
    loadRequestId.current += 1
    setLoadingConversationMedia(false)
    setDownloadBusy(false)
    setActiveMediaKey(null)
  }, [])

  const moveViewer = useCallback((direction: -1 | 1) => {
    if (activeMediaIndex < 0 || viewerMedia.length < 2) return
    const nextIndex = (activeMediaIndex + direction + viewerMedia.length) % viewerMedia.length
    setActiveMediaKey(viewerMedia[nextIndex].galleryKey)
  }, [activeMediaIndex, viewerMedia])

  function openMedia(attachment: MediaAttachment, attachmentIndex: number) {
    const selected = localGalleryMedia(attachment, attachmentIndex)
    const localMedia = visualItems.map((item) => localGalleryMedia(item.attachment, item.attachmentIndex))
    window.dispatchEvent(new Event('messenger-media-viewer-open'))
    setViewerMedia(localMedia)
    setActiveMediaKey(selected.galleryKey)
    if (!loadConversationMedia) return

    const requestId = loadRequestId.current + 1
    loadRequestId.current = requestId
    setLoadingConversationMedia(true)
    void loadConversationMedia()
      .then((items) => {
        if (loadRequestId.current !== requestId) return
        const conversationMedia = items.filter((item) => {
          const kind = resolveMediaKind(item)
          return Boolean(item.url) && (kind === 'image' || kind === 'video')
        })
        setViewerMedia(conversationMedia.some((item) => item.galleryKey === selected.galleryKey)
          ? [...conversationMedia]
          : [...conversationMedia, selected])
      })
      .catch(() => undefined)
      .finally(() => {
        if (loadRequestId.current === requestId) setLoadingConversationMedia(false)
      })
  }

  useEffect(() => {
    if (activeMediaKey === null) return
    if (!activeMedia) {
      setActiveMediaKey(null)
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeViewer()
      if (event.target instanceof HTMLVideoElement) return
      if (event.key === 'ArrowLeft') moveViewer(-1)
      if (event.key === 'ArrowRight') moveViewer(1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeMedia, activeMediaKey, closeViewer, moveViewer])

  useEffect(() => {
    if (!activeMediaKey) return
    const strip = thumbnailStripRef.current
    const thumbnail = activeThumbnailRef.current
    if (!strip || !thumbnail) return
    const maxLeft = Math.max(0, strip.scrollWidth - strip.clientWidth)
    const desiredLeft = thumbnail.offsetLeft - (strip.clientWidth - thumbnail.offsetWidth) / 2
    const nextLeft = Math.max(0, Math.min(desiredLeft, maxLeft))
    if (typeof strip.scrollTo === 'function') strip.scrollTo({ left: nextLeft, behavior: 'smooth' })
    else strip.scrollLeft = nextLeft
  }, [activeMediaKey, viewerMedia.length])

  async function downloadActiveMedia() {
    if (!activeMedia || downloadBusy) return
    let parsed: URL
    try {
      parsed = new URL(activeMedia.url, window.location.origin)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return
    } catch {
      return
    }

    setDownloadBusy(true)
    try {
      const response = await fetch(parsed.href, { credentials: 'same-origin', referrerPolicy: 'no-referrer' })
      if (!response.ok) throw new Error(`Media download failed (${response.status})`)
      const blobUrl = URL.createObjectURL(await response.blob())
      const anchor = document.createElement('a')
      anchor.href = blobUrl
      anchor.download = safeDownloadName(mediaDisplayName(activeMedia))
      anchor.rel = 'noopener noreferrer'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0)
    } catch {
      const anchor = document.createElement('a')
      anchor.href = parsed.href
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
      anchor.referrerPolicy = 'no-referrer'
      anchor.click()
    } finally {
      setDownloadBusy(false)
    }
  }

  if (normalized.length === 0) return null

  return (
    <div className={rootClass} aria-label={ariaLabel} data-attachment-count={normalized.length}>
      {imageItems.length > 0 && (
        <>
          {imageItems.length >= 4 && <small className="media-gallery-count-label">{mine ? 'Bạn' : senderName} đã gửi {imageItems.length} ảnh</small>}
          <div
            className={`media-gallery-images ${imageLayoutClass(imageItems.length)}`}
            data-image-count={imageItems.length}
            data-visible-count={visibleImages.length}
          >
            {visibleImages.map(({ attachment, attachmentIndex }) => {
              const name = mediaDisplayName(attachment)
              return (
                <button
                  type="button"
                  className="media-gallery-image"
                  data-media-kind="image"
                  key={`${attachment.url}-${attachmentIndex}`}
                  aria-label={`Open ${name}`}
                  onClick={() => openMedia(attachment, attachmentIndex)}
                  style={imageItems.length === 1 ? { aspectRatio: imageAspectRatio(attachment) } : undefined}
                >
                  <MessengerMediaImage attachment={attachment} alt={name} loading="lazy" />
                </button>
              )
            })}
          </div>
        </>
      )}
      {other.length > 0 && (
        <div className="media-gallery-other">
          {other.map(({ attachment, attachmentIndex }) => {
            const kind = resolveMediaKind(attachment)
            return <FileAttachment key={`${attachment.url}-${attachmentIndex}`} attachment={attachment} kind={kind} compact={compact} onOpen={kind === 'video' ? () => openMedia(attachment, attachmentIndex) : undefined} />
          })}
        </div>
      )}
      {activeMedia && activeMediaIndex >= 0 && createPortal(
        <div
          className="media-lightbox"
          role="dialog"
          aria-modal="true"
          aria-busy={loadingConversationMedia}
          aria-label={`${mediaDisplayName(activeMedia)} (${activeMediaIndex + 1}/${viewerMedia.length})`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeViewer()
          }}
        >
          <div className="media-lightbox-ambient" aria-hidden="true">
            {resolveMediaKind(activeMedia) === 'video' && !activeMedia.thumbnailUrl
              ? <video src={activeMedia.url} muted playsInline preload="metadata" />
              : <MessengerMediaImage attachment={activeMedia} alt="" />}
          </div>
          <span className="media-lightbox-shade" aria-hidden="true" />
          <div className="media-lightbox-tools">
            <button type="button" aria-label="Tải xuống" title="Tải xuống" disabled={downloadBusy} onClick={() => void downloadActiveMedia()}><DownloadMediaIcon /></button>
            <button type="button" aria-label="Chuyển tiếp" title="Chuyển tiếp" disabled={!onForward} onClick={() => { closeViewer(); onForward?.() }}><ForwardMediaIcon /></button>
            <button type="button" className="media-lightbox-close" aria-label="Close image viewer" onClick={closeViewer}><Icon name="close" size={22} /></button>
          </div>
          <button type="button" className="media-lightbox-nav previous" aria-label="Previous media" disabled={viewerMedia.length < 2} onClick={() => moveViewer(-1)}><MediaChevronIcon direction="previous" /></button>
          <figure className={resolveMediaKind(activeMedia) === 'video' ? 'is-video' : 'is-image'}>
            {resolveMediaKind(activeMedia) === 'video'
              ? <video key={activeMedia.galleryKey} src={activeMedia.url} poster={activeMedia.thumbnailUrl || undefined} controls playsInline preload="metadata" aria-label={mediaDisplayName(activeMedia)} />
              : <MessengerMediaImage attachment={activeMedia} alt={mediaDisplayName(activeMedia)} />}
          </figure>
          <button type="button" className="media-lightbox-nav next" aria-label="Next media" disabled={viewerMedia.length < 2} onClick={() => moveViewer(1)}><MediaChevronIcon direction="next" /></button>
          <div ref={thumbnailStripRef} className="media-lightbox-thumbnails">
            <div className="media-lightbox-thumbnails-track" role="list" aria-label="Conversation media">
              {viewerMedia.map((item, index) => {
                const active = index === activeMediaIndex
                const name = mediaDisplayName(item)
                const kind = resolveMediaKind(item)
                return <button
                  type="button"
                  role="listitem"
                  className={`media-lightbox-thumbnail${active ? ' active' : ''}`}
                  key={item.galleryKey}
                  ref={active ? activeThumbnailRef : undefined}
                  aria-label={`View ${name}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => setActiveMediaKey(item.galleryKey)}
                >
                  {kind === 'video' && !item.thumbnailUrl
                    ? <video src={item.url} muted playsInline preload="metadata" aria-hidden="true" />
                    : <MessengerMediaImage attachment={item} preferThumbnail alt="" />}
                  {kind === 'video' && <span className="media-lightbox-thumbnail-play" aria-hidden="true"><Icon name="play" size={12} /></span>}
                </button>
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
