import type { SharedStorySource } from '../api/gatewayTypes'
import { decodePostContent, getPostBackgroundPreset } from '../lib/postContent'
import { Avatar } from './Avatar'
import { VerifiedBadge } from './VerifiedBadge'

export function SharedStoryMiniPreview({ source, className = '' }: { source: SharedStorySource; className?: string }) {
  const decoded = decodePostContent(source.content)
  const background = getPostBackgroundPreset(decoded.backgroundId)
  const media = source.media
  const authorName = source.author?.name || 'Fakebook'

  return <span className={`shared-story-miniature${className ? ` ${className}` : ''}`}>
    <span className="shared-story-miniature-ambient" aria-hidden="true">
      {media?.type === 0 && <img src={media.url} alt="" />}
      {background && <i style={{ background: background.background }} />}
    </span>
    <span className="shared-story-mini-post">
      <span className="shared-story-mini-head"><Avatar name={authorName} src={source.author?.avatar || null} size={22} /><strong>{authorName}<VerifiedBadge verified={source.author?.isVerified} size={8} /></strong></span>
      {decoded.text && <span className={background && !media ? 'shared-story-mini-content has-background' : 'shared-story-mini-content'} style={background && !media ? { background: background.background } : undefined}>{decoded.text}</span>}
      {media && <span className="shared-story-mini-media">{media.type === 1 ? <video src={media.url} muted playsInline preload="metadata" /> : <img src={media.url} alt="" loading="lazy" />}</span>}
    </span>
  </span>
}
