import type { GatewayMedia } from '../api/gatewayTypes'
import { getAdaptiveMediaLayout, getSingleMediaPresentation } from '../lib/mediaLayout'
import { useMediaDimensions } from '../lib/useMediaDimensions'

export function PostMediaGallery({ media, compact = false, controls = true, onOpen }: { media: GatewayMedia[]; compact?: boolean; controls?: boolean; onOpen?: () => void }) {
  const visible = media.slice(0, 5)
  const overflow = media.length - visible.length
  const count = visible.length
  const mediaKeys = visible.map((item, index) => item.id || item.url || `media-${index}`)
  const { dimensions, rememberDimensions } = useMediaDimensions(mediaKeys)
  const layout = getAdaptiveMediaLayout(dimensions, media.length)
  const singlePresentation = getSingleMediaPresentation(dimensions[0])
  if (media.length === 0) return null

  return <div className={`post-media-gallery adaptive-media-layout media-count-${count} layout-${layout.kind}${compact ? ' compact' : ''}${onOpen ? ' interactive' : ''}`} onClick={onOpen} onKeyDown={(event) => {
    if (onOpen && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      onOpen()
    }
  }} role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined}>
    {visible.map((item, index) => {
      const key = mediaKeys[index]
      const letterboxed = count === 1 && singlePresentation.needsBackdrop
      return <div className={letterboxed ? 'post-media-slot letterboxed' : 'post-media-slot'} style={count === 1 ? { aspectRatio: String(singlePresentation.frameAspectRatio) } : undefined} key={`${key}-${index}`}>
      {letterboxed && item.type !== 1 && <img className="post-media-backdrop" src={item.url} alt="" aria-hidden="true" loading="lazy" />}
      {item.type === 1
        ? <video className="post-media-content" src={item.url} controls={controls} muted={!controls} preload="metadata" onLoadedMetadata={(event) => rememberDimensions(key, event.currentTarget.videoWidth, event.currentTarget.videoHeight)} onClick={(event) => controls && event.stopPropagation()} />
        : <img className="post-media-content" src={item.url} alt="" loading="lazy" onLoad={(event) => rememberDimensions(key, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} />}
      {index === visible.length - 1 && overflow > 0 && <span className="post-media-overflow">+{overflow}</span>}
    </div>})}
  </div>
}
