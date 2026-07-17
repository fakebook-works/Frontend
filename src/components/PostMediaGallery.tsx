import type { GatewayMedia } from '../api/gatewayTypes'

export function PostMediaGallery({ media, compact = false, controls = true, onOpen }: { media: GatewayMedia[]; compact?: boolean; controls?: boolean; onOpen?: () => void }) {
  if (media.length === 0) return null
  const visible = media.slice(0, 5)
  const overflow = media.length - visible.length
  const count = visible.length

  return <div className={`post-media-gallery media-count-${count}${compact ? ' compact' : ''}${onOpen ? ' interactive' : ''}`} onClick={onOpen} onKeyDown={(event) => {
    if (onOpen && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      onOpen()
    }
  }} role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined}>
    {visible.map((item, index) => <div className="post-media-slot" key={item.id || `${item.url}-${index}`}>
      {item.type === 1
        ? <video src={item.url} controls={controls} muted={!controls} preload="metadata" onClick={(event) => controls && event.stopPropagation()} />
        : <img src={item.url} alt="" loading="lazy" />}
      {index === visible.length - 1 && overflow > 0 && <span className="post-media-overflow">+{overflow}</span>}
    </div>)}
  </div>
}
