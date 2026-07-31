import { Icon } from './Icon'

export type PostPrivacy = 0 | 1 | 2 | 3

export function PostPrivacyIcon({ privacy, size = 14, group = false }: { privacy: PostPrivacy; size?: number; group?: boolean }) {
  if (privacy === 0) {
    return <svg className="home-post-public-icon" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 17.93A8.02 8.02 0 0 1 4 12c0-.62.08-1.21.21-1.79L9 15v1a2 2 0 0 0 2 2v1.93zm6.9-2.54A2 2 0 0 0 16 16h-1v-3a1 1 0 0 0-1-1H8v-2h2a1 1 0 0 0 1-1V7h2a2 2 0 0 0 2-2v-.41A8 8 0 0 1 17.9 17.39z" />
    </svg>
  }

  if (group) {
    return <svg className="home-post-privacy-icon group-privacy group-private-privacy-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="#b0b3b8" />
      <g className="group-private-privacy-glyph" transform="translate(3.36 3.36) scale(.72)" fill="#2b2d30">
        <path d="M12 12.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5zM5.5 10A2.5 2.5 0 1 0 5.5 5a2.5 2.5 0 0 0 0 5zm13 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM12 13.5c-2.7 0-5.5 1.4-5.5 3.6V19h11v-1.9c0-2.2-2.8-3.6-5.5-3.6zM4.5 11.5c-2 0-4 1.1-4 2.9V16H5v-1.4c0-1 .5-1.9 1.3-2.6-.6-.3-1.2-.5-1.8-.5zm15 0c-.6 0-1.2.2-1.8.5.8.7 1.3 1.6 1.3 2.6V16h4.5v-1.6c0-1.8-2-2.9-4-2.9z" />
      </g>
    </svg>
  }

  return <Icon className={`home-post-privacy-icon privacy-${privacy}`} name={privacy === 3 ? 'lock' : privacy === 1 ? 'friends' : 'user'} size={size} />
}
