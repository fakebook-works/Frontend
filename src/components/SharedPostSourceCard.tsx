import type { SharedPostSource } from '../api/gatewayTypes'
import { useI18n } from '../i18n'
import { decodePostContent, getPostBackgroundPreset } from '../lib/postContent'
import { formatPostTimestamp } from '../lib/postTime'
import { Avatar } from './Avatar'
import { GroupPostAvatar } from './GroupPostAvatar'
import { HoverTooltip } from './HoverTooltip'
import { Icon } from './Icon'
import { MentionContent } from './MentionContent'
import { PostMediaGallery } from './PostMediaGallery'
import { PostPrivacyIcon, type PostPrivacy } from './PostPrivacyIcon'
import { VerifiedBadge } from './VerifiedBadge'

export function SharedPostSourceCard({ source, locale, onNavigate, onOpenSource, onOpenImage, onOpenReel }: {
  source: SharedPostSource
  locale: string
  onNavigate?: (path: string) => void
  onOpenSource?: (sourceId: string) => void
  onOpenImage?: (source: SharedPostSource, media: SharedPostSource['media'][number], index: number, initialPlaybackTime?: number) => void
  onOpenReel?: (source: SharedPostSource) => void
}) {
  const { t } = useI18n()
  const sharedGroup = source.group ?? null
  const openGroup = sharedGroup && onNavigate ? () => onNavigate(`/groups/${sharedGroup.id}`) : undefined
  if (!source.isAvailable) {
    if (source.requiresGroupMembership && sharedGroup) {
      return <section className="shared-post-source unavailable private-group-source">
        <div className="shared-group-cover" style={sharedGroup.background ? { backgroundImage: `url(${sharedGroup.background})` } : undefined} />
        <div className="shared-group-summary">
          <button type="button" className="shared-group-avatar" onClick={openGroup}><Avatar className="shared-group-card-avatar" name={sharedGroup.name} src={sharedGroup.avatar || null} size={48} /></button>
          <button type="button" className="shared-group-copy" onClick={openGroup}><strong>{sharedGroup.name}</strong><span>{t('privateGroup')} · {t('membersCount', { count: sharedGroup.memberCount })}</span></button>
        </div>
        <div className="shared-private-group-message"><Icon name="lock" size={22} /><div><strong>{t('privateGroupPostUnavailable')}</strong><p>{t('privateGroupPostUnavailableDesc')}</p></div></div>
        <button type="button" className="btn-primary shared-group-join-link" onClick={openGroup}>{sharedGroup.joinRequestPending ? t('joinRequested') : t('joinGroupLong')}</button>
      </section>
    }
    return <section className="shared-post-source unavailable"><Icon name="lock" size={24} /><div><strong>{t('contentUnavailable')}</strong><p>{t('contentUnavailableDesc')}</p></div></section>
  }

  if (source.type === 1 && sharedGroup) {
    return <section className="shared-post-source shared-group-source">
      <button type="button" className="shared-group-cover" style={sharedGroup.background ? { backgroundImage: `url(${sharedGroup.background})` } : undefined} onClick={openGroup} aria-label={sharedGroup.name} />
      <div className="shared-group-summary">
        <button type="button" className="shared-group-avatar" onClick={openGroup}><Avatar className="shared-group-card-avatar" name={sharedGroup.name} src={sharedGroup.avatar || null} size={54} /></button>
        <button type="button" className="shared-group-copy" onClick={openGroup}><strong>{sharedGroup.name}</strong><span>{sharedGroup.privacy === 0 ? t('publicGroup') : t('privateGroup')} · {t('membersCount', { count: sharedGroup.memberCount })}</span></button>
      </div>
    </section>
  }

  const decodedContent = decodePostContent(source.content)
  const postBackground = source.media.length === 0 ? getPostBackgroundPreset(decodedContent.backgroundId) : null
  const hasPrivacy = source.privacy != null
  const isGroupSource = source.type === 3
  const privacy: PostPrivacy = source.privacy === 1 || source.privacy === 2 || source.privacy === 3 ? source.privacy : 0
  const privacyLabel = isGroupSource
    ? privacy === 0 ? t('publicGroup') : t('privateGroup')
    : privacy === 0
      ? t('privacyPublic')
    : privacy === 1
      ? t('privacyFriendsFollowers')
      : privacy === 2
        ? t('privacyFriends')
        : t('privacyOnlyMe')
  const timestamp = source.create ? formatPostTimestamp(source.create, locale) : null
  const openSource = onOpenSource ? () => onOpenSource(source.id) : undefined

  return <section className="shared-post-source">
    <div className="shared-source-body">
      <header className={`shared-source-head${openSource ? ' interactive' : ''}`} role={openSource ? 'button' : undefined} tabIndex={openSource ? 0 : undefined} onClick={openSource} onKeyDown={openSource ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openSource()
        }
      } : undefined}>
        <span className="post-author-avatar shared-source-avatar">{isGroupSource && sharedGroup
          ? <GroupPostAvatar groupName={sharedGroup.name} groupAvatar={sharedGroup.avatar || null} userName={source.author?.name || t('fakebookUser')} userAvatar={source.author?.avatar || null} size={38} />
          : <Avatar name={source.author?.name || t('fakebookUser')} src={source.author?.avatar || null} size={38} />}</span>
        <div className="post-head-copy">
          <div className="post-head-primary">
            <span className="post-author-name"><strong>{isGroupSource && sharedGroup ? sharedGroup.name : source.author?.name || t('fakebookUser')}<VerifiedBadge verified={!isGroupSource && source.author?.isVerified} size={12} /></strong></span>
          </div>
          {(timestamp || hasPrivacy) && <span className="post-head-meta">
            {isGroupSource && source.author && <><span className="shared-source-group-author">{source.author.name}<VerifiedBadge verified={source.author.isVerified} size={12} marginLeft={2} /></span><i>·</i></>}
            {timestamp && <HoverTooltip label={timestamp.detail} className="post-meta-hover post-time-hover"><time dateTime={source.create ?? undefined}>{timestamp.display}</time></HoverTooltip>}
            {timestamp && hasPrivacy && <i>·</i>}
            {hasPrivacy && <HoverTooltip label={privacyLabel} className="post-meta-hover post-privacy-hover"><span aria-label={privacyLabel}><PostPrivacyIcon privacy={privacy} size={13} group={isGroupSource} /></span></HoverTooltip>}
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
    <PostMediaGallery
      media={source.media}
      controls
      preferredAspectRatio={source.type === 4 ? source.aspectRatio : null}
      focalPointX={source.type === 4 ? source.focalPointX : null}
      focalPointY={source.type === 4 ? source.focalPointY : null}
      onOpenImage={source.type === 4 && onOpenReel ? () => onOpenReel(source) : onOpenImage ? (media, index, initialPlaybackTime) => onOpenImage(source, media, index, initialPlaybackTime) : undefined}
    />
  </section>
}
