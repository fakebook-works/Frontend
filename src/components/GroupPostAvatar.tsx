import { Avatar } from './Avatar'

export function GroupPostAvatar({
  groupName,
  groupAvatar,
  userName,
  userAvatar,
  size = 44,
}: {
  groupName: string
  groupAvatar?: string | null
  userName: string
  userAvatar?: string | null
  size?: number
}) {
  const userSize = Math.max(20, Math.round(size * .56))
  return <span className="group-post-avatar-stack" style={{ width: size, height: size }} aria-label={`${groupName} · ${userName}`}>
    <Avatar className="group-post-main-avatar" name={groupName} src={groupAvatar} size={size} />
    <Avatar className="group-post-user-avatar" name={userName} src={userAvatar} size={userSize} />
  </span>
}
