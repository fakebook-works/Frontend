import type { SharedPostSource } from '../api/gatewayTypes'
import { useI18n } from '../i18n'
import { decodePostContent, getPostBackgroundPreset } from '../lib/postContent'
import { formatPostTimestamp } from '../lib/postTime'
import { Avatar } from './Avatar'
import { HoverTooltip } from './HoverTooltip'
import { Icon } from './Icon'
import { MentionContent } from './MentionContent'
import { PostMediaGallery } from './PostMediaGallery'
import { PostPrivacyIcon, type PostPrivacy } from './PostPrivacyIcon'
import { VerifiedBadge } from './VerifiedBadge'

export function SharedPostSourceCard({ source, locale, onNavigate, onOpenSource }: {
  source: SharedPostSource
  locale: string
  onNavigate?: (path: string) => void
  onOpenSource?: (sourceId: string) => void
}) {
  const { t } = useI18n()
  if (!source.isAvailable) {
    return <section className="shared-post-source unavailable"><Icon name="lock" size={24} /><div><strong>{t('contentUnavailable')}</strong><p>{t('contentUnavailableDesc')}</p></div></section>
  }

  const decodedContent = decodePostContent(source.content)
  const postBackground = source.media.length === 0 ? getPostBackgroundPreset(decodedContent.backgroundId) : null
  const hasPrivacy = source.privacy != null
  const privacy: PostPrivacy = source.privacy === 1 || source.privacy === 2 || source.privacy === 3 ? source.privacy : 0
  const privacyLabel = privacy === 0
    ? t('privacyPublic')
    : privacy === 1
      ? t('privacyFriendsFollowers')
      : privacy === 2
        ? t('privacyFriends')
        : t('privacyOnlyMe')
  const timestamp = source.create ? formatPostTimestamp(source.create, locale) : null
  const openSource = onOpenSource ? () => onOpenSource(source.id) : undefined
  const openAuthor = () => source.author && onNavigate?.(`/profile/${source.author.id}`)

  return <section className="shared-post-source">
    <div className="shared-source-body">
      <header className="shared-source-head">
        <button type="button" className="post-author-avatar shared-source-avatar" disabled={!source.author} onClick={openAuthor}><Avatar name={source.author?.name || t('fakebookUser')} src={source.author?.avatar || null} size={38} /></button>
        <div className="post-head-copy">
          <div className="post-head-primary">
            <button type="button" className="post-author-name" disabled={!source.author} onClick={openAuthor}><strong>{source.author?.name || t('fakebookUser')}<VerifiedBadge verified={source.author?.isVerified} size={12} /></strong></button>
          </div>
          {(timestamp || hasPrivacy) && <span className="post-head-meta">
            {timestamp && <HoverTooltip label={timestamp.detail} className="post-meta-hover post-time-hover"><time dateTime={source.create ?? undefined}>{timestamp.display}</time></HoverTooltip>}
            {timestamp && hasPrivacy && <i>·</i>}
            {hasPrivacy && <HoverTooltip label={privacyLabel} className="post-meta-hover post-privacy-hover"><span aria-label={privacyLabel}><PostPrivacyIcon privacy={privacy} size={13} /></span></HoverTooltip>}
          </span>}
        </div>
      </header>
      {decodedContent.text && <div className={postBackground ? 'shared-source-content has-background' : 'shared-source-content'} style={postBackground ? { background: postBackground.background } : undefined} role={openSource ? 'button' : undefined} tabIndex={openSource ? 0 : undefined} onClick={openSource} onKeyDown={openSource ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openSource()
        }
      } : undefined}><MentionContent content={decodedContent.text} mentions={source.mentions} onNavigate={onNavigate} /></div>}
    </div>
    <PostMediaGallery media={source.media} controls onOpen={openSource} />
  </section>
}
