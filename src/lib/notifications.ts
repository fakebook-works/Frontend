import type { AppNotification } from '../api/notifications'

export function notificationText(action: string, t: (key: string) => string): string {
  const key: Record<string, string> = {
    LIKE: 'notificationLike',
    COMMENT: 'notificationComment',
    TAG: 'notificationTag',
    MENTION: 'notificationMention',
    FRIEND_REQUEST: 'notificationFriendRequest',
    FRIEND_ACCEPT: 'notificationFriendAccept',
    GROUP_INVITE: 'notificationGroupInvite',
    GROUP_JOIN_REQUEST: 'notificationGroupJoinRequest',
    GROUP_JOIN_ACCEPTED: 'notificationGroupJoinAccepted',
    SHARE: 'notificationShare',
  }
  return t(key[action] ?? 'notificationActivity')
}

export function notificationTarget(item: AppNotification): string {
  if (item.actionType === 'FRIEND_REQUEST' || item.actionType === 'FRIEND_ACCEPT') return `/profile/${item.creatorId}`
  if (item.actionType.startsWith('GROUP_')) return `/groups/${item.objectId}`
  return `/content/${item.objectId}`
}
