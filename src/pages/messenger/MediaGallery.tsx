/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
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

export interface MediaViewerImage extends MediaAttachment {
  galleryKey: string
}

interface MediaGalleryProps {
  attachments?: readonly MediaAttachment[] | null
  className?: string
  compact?: boolean
  ariaLabel?: string
  messageId?: string
  loadConversationImages?: () => Promise<readonly MediaViewerImage[]>
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

function FileAttachment({ attachment, kind, compact }: { attachment: MediaAttachment; kind: MediaKind; compact: boolean }) {
  const name = mediaDisplayName(attachment)
  const size = formatMediaSize(attachment.size ?? attachment.sizeBytes)
  if (kind === 'video') {
    return (
      <figure className="media-gallery-item media-gallery-video" data-media-kind="video">
        <video
          controls
          preload="metadata"
          src={attachment.url}
          poster={attachment.thumbnailUrl || undefined}
          aria-label={name}
        />
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
  if (kind === 'image') return <img className="media-upload-preview-image" src={attachment.thumbnailUrl || attachment.url} alt={name} />
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
  loadConversationImages,
  mine = false,
  senderName = 'Người dùng',
}: MediaGalleryProps) {
  const normalized = (attachments ?? [])
    .map((attachment, attachmentIndex) => ({ attachment, attachmentIndex }))
    .filter(({ attachment }) => Boolean(attachment?.url))
  const imageItems = normalized.filter(({ attachment }) => resolveMediaKind(attachment) === 'image')
  const other = normalized.filter(({ attachment }) => resolveMediaKind(attachment) !== 'image')
  const visibleImages = imageItems.slice(0, 4)
  const audioOnly = normalized.length > 0 && normalized.every(({ attachment }) => resolveMediaKind(attachment) === 'audio')
  const rootClass = ['media-gallery', compact ? 'compact' : '', audioOnly ? 'audio-only' : '', className].filter(Boolean).join(' ')
  const [viewerImages, setViewerImages] = useState<MediaViewerImage[]>([])
  const [activeImageKey, setActiveImageKey] = useState<string | null>(null)
  const [loadingConversationImages, setLoadingConversationImages] = useState(false)
  const loadRequestId = useRef(0)
  const activeThumbnailRef = useRef<HTMLButtonElement>(null)
  const activeImageIndex = activeImageKey === null
    ? -1
    : viewerImages.findIndex((image) => image.galleryKey === activeImageKey)
  const activeImage = activeImageIndex < 0 ? null : viewerImages[activeImageIndex]

  function localGalleryImage(attachment: MediaAttachment, attachmentIndex: number): MediaViewerImage {
    return {
      ...attachment,
      galleryKey: `${messageId ?? 'message'}:${attachmentIndex}`,
    }
  }

  const closeViewer = useCallback(() => {
    loadRequestId.current += 1
    setLoadingConversationImages(false)
    setActiveImageKey(null)
  }, [])

  const moveViewer = useCallback((direction: -1 | 1) => {
    if (activeImageIndex < 0 || viewerImages.length < 2) return
    const nextIndex = (activeImageIndex + direction + viewerImages.length) % viewerImages.length
    setActiveImageKey(viewerImages[nextIndex].galleryKey)
  }, [activeImageIndex, viewerImages])

  function openImage(attachment: MediaAttachment, attachmentIndex: number) {
    const selected = localGalleryImage(attachment, attachmentIndex)
    const localImages = imageItems.map((item) => localGalleryImage(item.attachment, item.attachmentIndex))
    setViewerImages(localImages)
    setActiveImageKey(selected.galleryKey)
    if (!loadConversationImages) return

    const requestId = loadRequestId.current + 1
    loadRequestId.current = requestId
    setLoadingConversationImages(true)
    void loadConversationImages()
      .then((items) => {
        if (loadRequestId.current !== requestId) return
        const conversationImages = items.filter((item) => Boolean(item.url) && resolveMediaKind(item) === 'image')
        setViewerImages(conversationImages.some((item) => item.galleryKey === selected.galleryKey)
          ? [...conversationImages]
          : [...conversationImages, selected])
      })
      .catch(() => undefined)
      .finally(() => {
        if (loadRequestId.current === requestId) setLoadingConversationImages(false)
      })
  }

  useEffect(() => {
    if (activeImageKey === null) return
    if (!activeImage) {
      setActiveImageKey(null)
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeViewer()
      if (event.key === 'ArrowLeft') moveViewer(-1)
      if (event.key === 'ArrowRight') moveViewer(1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeImage, activeImageKey, closeViewer, moveViewer])

  useEffect(() => {
    if (!activeImageKey) return
    activeThumbnailRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' })
  }, [activeImageKey, viewerImages.length])

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
                  onClick={() => openImage(attachment, attachmentIndex)}
                  style={imageItems.length === 1 ? { aspectRatio: imageAspectRatio(attachment) } : undefined}
                >
                  <img src={attachment.thumbnailUrl || attachment.url} alt={name} loading="lazy" />
                </button>
              )
            })}
          </div>
        </>
      )}
      {other.length > 0 && (
        <div className="media-gallery-other">
          {other.map(({ attachment, attachmentIndex }) => (
            <FileAttachment key={`${attachment.url}-${attachmentIndex}`} attachment={attachment} kind={resolveMediaKind(attachment)} compact={compact} />
          ))}
        </div>
      )}
      {activeImage && activeImageIndex >= 0 && (
        <div
          className="media-lightbox"
          role="dialog"
          aria-modal="true"
          aria-busy={loadingConversationImages}
          aria-label={`${mediaDisplayName(activeImage)} (${activeImageIndex + 1}/${viewerImages.length})`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeViewer()
          }}
        >
          <button type="button" className="media-lightbox-close" aria-label="Close image viewer" onClick={closeViewer}>
            <Icon name="close" size={24} />
          </button>
          {viewerImages.length > 1 && <button type="button" className="media-lightbox-nav previous" aria-label="Previous image" onClick={() => moveViewer(-1)}><span aria-hidden="true">&lsaquo;</span></button>}
          <figure>
            <img src={activeImage.url} alt={mediaDisplayName(activeImage)} />
            <figcaption>{mediaDisplayName(activeImage)}<small>{activeImageIndex + 1}/{viewerImages.length}</small></figcaption>
          </figure>
          {viewerImages.length > 1 && <button type="button" className="media-lightbox-nav next" aria-label="Next image" onClick={() => moveViewer(1)}><span aria-hidden="true">&rsaquo;</span></button>}
          <div className="media-lightbox-thumbnails" role="list" aria-label="Conversation images">
            {viewerImages.map((image, index) => {
              const active = index === activeImageIndex
              const name = mediaDisplayName(image)
              return <button
                type="button"
                role="listitem"
                className={`media-lightbox-thumbnail${active ? ' active' : ''}`}
                key={image.galleryKey}
                ref={active ? activeThumbnailRef : undefined}
                aria-label={`View ${name}`}
                aria-current={active ? 'true' : undefined}
                onClick={() => setActiveImageKey(image.galleryKey)}
              >
                <img src={image.thumbnailUrl || image.url} alt="" />
              </button>
            })}
          </div>
        </div>
      )}
    </div>
  )
}
