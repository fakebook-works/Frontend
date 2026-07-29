import type { GatewayMedia } from '../api/gatewayTypes'
import { getAdaptiveMediaLayout, getSingleMediaPresentation } from '../lib/mediaLayout'
import { useMediaDimensions } from '../lib/useMediaDimensions'
import { PostVideoPlayer } from './PostVideoPlayer'

export function PostMediaGallery({ media, compact = false, controls = true, preferredAspectRatio, focalPointX, focalPointY, onOpen, onOpenImage }: { media: GatewayMedia[]; compact?: boolean; controls?: boolean; preferredAspectRatio?: number | null; focalPointX?: number | null; focalPointY?: number | null; onOpen?: () => void; onOpenImage?: (media: GatewayMedia, index: number, initialPlaybackTime?: number) => void }) {
  const visible = media.slice(0, 5)
  const overflow = media.length - visible.length
  const count = visible.length
  const autoplayVideoIndex = visible.findIndex((item) => item.type === 1)
  const mediaKeys = visible.map((item, index) => item.id || item.url || `media-${index}`)
  const { dimensions, rememberDimensions } = useMediaDimensions(mediaKeys)
  const layout = getAdaptiveMediaLayout(dimensions, media.length)
  const singlePresentation = getSingleMediaPresentation(dimensions[0])
  const selectedAspectRatio = typeof preferredAspectRatio === 'number' && Number.isFinite(preferredAspectRatio) && preferredAspectRatio >= 9 / 16 && preferredAspectRatio <= 16 / 9
    ? preferredAspectRatio
    : null
  const selectedFocalPointX = typeof focalPointX === 'number' && Number.isFinite(focalPointX) && focalPointX >= 0 && focalPointX <= 1 ? focalPointX : 0.5
  const selectedFocalPointY = typeof focalPointY === 'number' && Number.isFinite(focalPointY) && focalPointY >= 0 && focalPointY <= 1 ? focalPointY : 0.5
  const objectPosition = `${selectedFocalPointX * 100}% ${selectedFocalPointY * 100}%`
  if (media.length === 0) return null

  return <div className={`post-media-gallery adaptive-media-layout media-count-${count} layout-${layout.kind}${compact ? ' compact' : ''}${onOpen || onOpenImage ? ' interactive' : ''}`} onClick={onOpenImage ? undefined : onOpen} onKeyDown={(event) => {
    if (!onOpenImage && onOpen && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      onOpen()
    }
  }} role={!onOpenImage && onOpen ? 'button' : undefined} tabIndex={!onOpenImage && onOpen ? 0 : undefined}>
    {visible.map((item, index) => {
      const key = mediaKeys[index]
      const preferredFrame = count === 1 && selectedAspectRatio !== null
      const preferredPortrait = preferredFrame && selectedAspectRatio < 0.9
      const letterboxed = count === 1 && !preferredFrame && singlePresentation.needsLetterbox
      const imageInteractive = item.type === 0 && Boolean(onOpenImage)
      const videoInteractive = item.type === 1 && Boolean(onOpenImage)
      const mediaContent = item.type === 1
        ? <PostVideoPlayer src={item.url} controls={controls} autoPlay={index === autoplayVideoIndex} controlVariant="full" displayAspectRatio={preferredFrame ? selectedAspectRatio : null} objectPosition={preferredFrame ? objectPosition : '50% 50%'} onLoadedMetadata={(width, height) => rememberDimensions(key, width, height)} onOpenDetail={videoInteractive ? (currentTime) => onOpenImage?.(item, index, currentTime) : undefined} />
        : <img className="post-media-content" src={item.url} alt="" loading="lazy" style={preferredFrame ? { objectPosition } : undefined} onLoad={(event) => rememberDimensions(key, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} />
      return <div className={`${letterboxed ? 'post-media-slot letterboxed' : 'post-media-slot'}${preferredFrame ? ' preferred-presentation' : ''}${imageInteractive ? ' image-interactive' : ''}`} style={count === 1 ? { aspectRatio: String(preferredFrame ? (preferredPortrait ? 4 / 3 : selectedAspectRatio) : singlePresentation.frameAspectRatio) } : undefined} key={`${key}-${index}`} role={imageInteractive ? 'button' : undefined} tabIndex={imageInteractive ? 0 : undefined} onClick={imageInteractive ? (event) => { event.stopPropagation(); onOpenImage?.(item, index) } : undefined} onKeyDown={imageInteractive ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.stopPropagation()
          onOpenImage?.(item, index)
        }
      } : undefined}>
      {preferredFrame && item.type !== 1
        ? <div className="post-media-preferred-frame" style={{ aspectRatio: String(selectedAspectRatio) }}>{mediaContent}</div>
        : mediaContent}
      {index === visible.length - 1 && overflow > 0 && <span className="post-media-overflow">+{overflow}</span>}
    </div>})}
  </div>
}
