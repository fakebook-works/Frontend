import { Icon } from './Icon'
import { FriendPeopleGlyph, FriendPersonGlyph } from './FriendPeopleGlyph'
import { GroupMembersIcon } from './GroupMembersIcon'

export type PostPrivacy = 0 | 1 | 2 | 3

export function PostPrivacyIcon({ privacy, size = 14, group = false }: { privacy: PostPrivacy; size?: number; group?: boolean }) {
  if (privacy === 0) {
    return <svg className="home-post-public-icon" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 17.93A8.02 8.02 0 0 1 4 12c0-.62.08-1.21.21-1.79L9 15v1a2 2 0 0 0 2 2v1.93zm6.9-2.54A2 2 0 0 0 16 16h-1v-3a1 1 0 0 0-1-1H8v-2h2a1 1 0 0 0 1-1V7h2a2 2 0 0 0 2-2v-.41A8 8 0 0 1 17.9 17.39z" />
    </svg>
  }

  if (group) {
    return <span className="home-post-privacy-icon group-privacy group-private-privacy-icon" style={{ width: size, height: size }} aria-hidden="true">
      <GroupMembersIcon
        className="group-private-privacy-glyph"
        size={Math.max(8, Math.round(size * .8))}
        fill="var(--group-private-privacy-glyph-color)"
        cutout="var(--group-private-privacy-surface)"
        cutoutStrokeWidth={0.52}
        contentOffsetX={-0.35}
        contentOffsetY={-0.9}
      />
    </span>
  }

  if (privacy === 1) return <FriendPeopleGlyph className="home-post-privacy-icon privacy-1" filled size={size} />
  if (privacy === 2) return <FriendPersonGlyph className="home-post-privacy-icon privacy-2" size={size} />
  return <Icon className="home-post-privacy-icon privacy-3" name="lock" size={size} />
}
