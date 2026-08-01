import type { GatewayPost } from '../api/gatewayTypes'
import { decodePostContent, getPostBackgroundPreset } from '../lib/postContent'
import { formatPostTimestamp } from '../lib/postTime'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { MentionContent } from './MentionContent'
import { PostPrivacyIcon, type PostPrivacy } from './PostPrivacyIcon'

interface ProfileGridMediaSource {
  contentId: string
  media: GatewayPost['media']
}

export interface ProfileGridMediaTarget {
  contentId: string
  mediaId: string
  mediaUrl: string
  mediaType: number
}

function normalizePostPrivacy(value: number): PostPrivacy {
  return Math.min(3, Math.max(0, Math.trunc(Number(value) || 0))) as PostPrivacy
}

function profileGridMediaSource(post: GatewayPost): ProfileGridMediaSource {
  if (post.media.length > 0) return { contentId: post.id, media: post.media }
  if (post.sharedSource?.isAvailable && post.sharedSource.media.length > 0) {
    return { contentId: post.sharedSource.id, media: post.sharedSource.media }
  }
  return { contentId: post.id, media: [] }
}

export function ProfilePostListIcon() {
  return <svg className="profile-post-list-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.45" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M5 6h14M5 12h14M5 18h14" /></svg>
}

export function ProfilePostGridIcon() {
  return <svg className="profile-post-grid-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><rect x="4" y="4" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" /></svg>
}

export function ProfilePostGridCard({ post, locale, groupPrivacy = false, onOpenDetail, onOpenMedia }: {
  post: GatewayPost
  locale: string
  groupPrivacy?: boolean
  onOpenDetail: () => void
  onOpenMedia: (item: ProfileGridMediaTarget) => void
}) {
  const decoded = decodePostContent(post.content)
  const source = profileGridMediaSource(post)
  const visibleMedia = source.media.slice(0, 4)
  const background = source.media.length === 0 ? getPostBackgroundPreset(decoded.backgroundId) : null
  const timestamp = formatPostTimestamp(post.create, locale)
  const privacy = normalizePostPrivacy(post.privacy)
  const openMedia = (media: GatewayPost['media'][number]) => {
    if (post.__typename === 'ReelDetail') return
    onOpenMedia({ contentId: source.contentId, mediaId: media.id, mediaUrl: media.url, mediaType: media.type })
  }

  return <article className={`profile-post-grid-card${post.__typename === 'ReelDetail' ? ' is-reel' : ''}`} data-post-id={post.id}>
    {visibleMedia.length > 0 ? <div className={`profile-post-grid-media media-count-${Math.min(visibleMedia.length, 4)}`}>{visibleMedia.map((media, index) => <button type="button" className="profile-post-grid-media-item" key={media.id} aria-label={decoded.text || post.author.name} onMouseEnter={(event) => {
      const video = event.currentTarget.querySelector('video')
      if (video) void video.play().catch(() => undefined)
    }} onMouseLeave={(event) => {
      const video = event.currentTarget.querySelector('video')
      if (!video) return
      video.pause()
      try { video.currentTime = 0 } catch { /* Metadata may not be ready yet. */ }
    }} onClick={() => openMedia(media)}>
      {media.type === 1 ? <video src={media.url} muted loop playsInline preload="metadata" /> : <img src={media.url} alt="" loading="lazy" />}
      {media.type === 1 && <span className="profile-post-grid-video-mark" aria-hidden="true"><Icon name="play" size={18} /></span>}
      {index === 3 && source.media.length > 4 && <strong className="profile-post-grid-media-more">+{source.media.length - 4}</strong>}
    </button>)}</div> : <button type="button" className={`profile-post-grid-media profile-post-grid-text${background ? ' has-background' : ' plain-text'}`} style={background ? { background: background.background } : undefined} onClick={onOpenDetail}><span><MentionContent content={decoded.text} mentions={post.mentions} /></span></button>}
    <button type="button" className="profile-post-grid-footer" onClick={onOpenDetail}>
      <Avatar name={post.author.name} src={post.author.avatar} size={38} />
      <span className="profile-post-grid-footer-copy">
        {decoded.text && <span className="profile-post-grid-caption"><MentionContent content={decoded.text} mentions={post.mentions} /></span>}
        <span className="profile-post-grid-meta"><time dateTime={post.create} title={timestamp.detail}>{timestamp.display}</time><PostPrivacyIcon privacy={privacy} group={groupPrivacy} size={12} /></span>
      </span>
    </button>
  </article>
}
