import type { FriendDto, UserSummary } from '../api/types'
import { firstName } from '../lib/format'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { useI18n } from '../i18n'

interface StoriesProps {
  me: UserSummary
  friends: FriendDto[]
  onOpenProfile: (userId: string) => void
}

// Facebook-style stories rail. Uses real friend data (avatar as cover + name);
// tiles navigate to the relevant profile since there is no story backend.
export function Stories({ me, friends, onOpenProfile }: StoriesProps) {
  const { t } = useI18n()
  const reel = friends.slice(0, 12)

  return (
    <section className="stories" aria-label={t('storyCreate')}>
      <button type="button" className="story story-create" onClick={() => onOpenProfile(me.id)}>
        <div className="story-cover">{me.avatarUrl && <img src={me.avatarUrl} alt="" />}</div>
        <div className="story-create-foot">
          <span className="story-plus">
            <Icon name="plus" size={20} />
          </span>
          <span className="story-create-label">Create story</span>
        </div>
      </button>

      {reel.map((f) => (
        <button
          type="button"
          className="story"
          key={f.friendshipId}
          onClick={() => onOpenProfile(f.user.id)}
          aria-label={t('storyLabel', { name: f.user.displayName })}
        >
          <div className="story-cover">{f.user.avatarUrl && <img src={f.user.avatarUrl} alt="" />}</div>
          <span className="story-ring">
            <Avatar name={f.user.displayName} src={f.user.avatarUrl} size={34} />
          </span>
          <span className="story-name">{firstName(f.user.displayName)}</span>
        </button>
      ))}
    </section>
  )
}
