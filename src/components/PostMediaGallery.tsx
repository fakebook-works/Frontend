import type { GatewayMedia } from '../api/gatewayTypes'
import { getAdaptiveMediaLayout, getSingleMediaPresentation } from '../lib/mediaLayout'
import { useMediaDimensions } from '../lib/useMediaDimensions'
import { PostVideoPlayer } from './PostVideoPlayer'

export function PostMediaGallery({ media, compact = false, controls = true, onOpen, onOpenImage }: { media: GatewayMedia[]; compact?: boolean; controls?: boolean; onOpen?: () => void; onOpenImage?: (media: GatewayMedia, index: number) => void }) {
  const visible = media.slice(0, 5)
  const overflow = media.length - visible.length
  const count = visible.length
  const autoplayVideoIndex = visible.findIndex((item) => item.type === 1)
  const mediaKeys = visible.map((item, index) => item.id || item.url || `media-${index}`)
  const { dimensions, rememberDimensions } = useMediaDimensions(mediaKeys)
  const layout = getAdaptiveMediaLayout(dimensions, media.length)
  const singlePresentation = getSingleMediaPresentation(dimensions[0])
  if (media.length === 0) return null

  return <div className={`post-media-gallery adaptive-media-layout media-count-${count} layout-${layout.kind}${compact ? ' compact' : ''}${onOpen || onOpenImage ? ' interactive' : ''}`} onClick={onOpenImage ? undefined : onOpen} onKeyDown={(event) => {
    if (!onOpenImage && onOpen && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      onOpen()
    }
  }} role={!onOpenImage && onOpen ? 'button' : undefined} tabIndex={!onOpenImage && onOpen ? 0 : undefined}>
    {visible.map((item, index) => {
      const key = mediaKeys[index]
      const letterboxed = count === 1 && singlePresentation.needsBackdrop
      const imageInteractive = item.type === 0 && Boolean(onOpenImage)
      return <div className={`${letterboxed ? 'post-media-slot letterboxed' : 'post-media-slot'}${imageInteractive ? ' image-interactive' : ''}`} style={count === 1 ? { aspectRatio: String(singlePresentation.frameAspectRatio) } : undefined} key={`${key}-${index}`} role={imageInteractive ? 'button' : undefined} tabIndex={imageInteractive ? 0 : undefined} onClick={imageInteractive ? (event) => { event.stopPropagation(); onOpenImage?.(item, index) } : undefined} onKeyDown={imageInteractive ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.stopPropagation()
          onOpenImage?.(item, index)
        }
      } : undefined}>
      {letterboxed && item.type !== 1 && <img className="post-media-backdrop" src={item.url} alt="" aria-hidden="true" loading="lazy" />}
      {item.type === 1
        ? <PostVideoPlayer src={item.url} controls={controls} autoPlay={index === autoplayVideoIndex} onLoadedMetadata={(width, height) => rememberDimensions(key, width, height)} />
        : <img className="post-media-content" src={item.url} alt="" loading="lazy" onLoad={(event) => rememberDimensions(key, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} />}
      {index === visible.length - 1 && overflow > 0 && <span className="post-media-overflow">+{overflow}</span>}
    </div>})}
  </div>
}
