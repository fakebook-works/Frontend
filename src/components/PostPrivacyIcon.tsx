import { Icon } from './Icon'

export type PostPrivacy = 0 | 1 | 2 | 3

export function PostPrivacyIcon({ privacy, size = 14 }: { privacy: PostPrivacy; size?: number }) {
  if (privacy === 0) {
    return <svg className="home-post-public-icon" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 17.93A8.02 8.02 0 0 1 4 12c0-.62.08-1.21.21-1.79L9 15v1a2 2 0 0 0 2 2v1.93zm6.9-2.54A2 2 0 0 0 16 16h-1v-3a1 1 0 0 0-1-1H8v-2h2a1 1 0 0 0 1-1V7h2a2 2 0 0 0 2-2v-.41A8 8 0 0 1 17.9 17.39z" />
    </svg>
  }

  return <Icon className={`home-post-privacy-icon privacy-${privacy}`} name={privacy === 3 ? 'lock' : privacy === 1 ? 'friends' : 'user'} size={size} />
}
