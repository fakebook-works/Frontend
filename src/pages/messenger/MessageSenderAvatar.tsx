import type { UserSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'

export function MessageSenderAvatar({
  person,
  size,
  isAdmin = false,
}: {
  person: UserSummary
  size: number
  isAdmin?: boolean
}) {
  return <span className="message-sender-avatar" style={{ width: size, height: size }}>
    <Avatar name={person.displayName} src={person.avatarUrl} size={size} />
    {isAdmin && <svg className="message-sender-admin-crown" viewBox="0 0 24 18" aria-label="Quản trị viên" role="img">
      <path d="M3 6.3Q3.1 5.7 3.8 6.2l3.8 2.6 3.7-5.1q.6-.9 1.2 0l3.9 5.1 3.9-2.6q.8-.5.6.6l-1.6 7.3q-.1.7-.9.7H5.4q-.8 0-.9-.7L3 6.3Z" />
    </svg>}
  </span>
}
