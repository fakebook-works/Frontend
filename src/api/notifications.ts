import { gatewayGraphQl, graphQlLongLiteral } from './client'
import { subscribeGatewayGraphQl } from './realtime'
import { socialApi } from './social'
import type { UserSummary } from './types'

export interface AppNotification {
  id: string
  creatorId: string
  receiverId: string
  actionType: string
  objectId: string
  createdAt: string
  isRead: boolean
  actor: UserSummary | null
}

type NotificationGraphQl = Omit<AppNotification, 'actor'>

export interface NotificationPage {
  items: AppNotification[]
  unreadCount: number
  endCursor: string | null
  hasNextPage: boolean
}

const NOTIFICATION_FIELDS = `id creatorId receiverId actionType objectId createdAt isRead`

async function hydrate(items: NotificationGraphQl[]): Promise<AppNotification[]> {
  const profiles = await socialApi.getProfiles(items.map((item) => String(item.creatorId))).catch(() => [])
  const actors = new Map(profiles.map((profile) => [profile.id, {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    isVerified: profile.isVerified,
  }]))
  return items.map((item) => ({
    ...item,
    id: String(item.id),
    creatorId: String(item.creatorId),
    receiverId: String(item.receiverId),
    objectId: String(item.objectId),
    actor: actors.get(String(item.creatorId)) ?? null,
  }))
}

export async function notifications(first = 20, after: string | null = null): Promise<NotificationPage> {
  const data = await gatewayGraphQl<{
    notifications: {
      nodes: NotificationGraphQl[]
      unreadCount: number
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  }>(
    `query Notifications($first: Int, $after: String) {
      notifications(first: $first, after: $after) {
        nodes { ${NOTIFICATION_FIELDS} }
        unreadCount
        pageInfo { hasNextPage endCursor }
      }
    }`,
    { first, after },
  )
  return {
    items: await hydrate(data.notifications.nodes),
    unreadCount: data.notifications.unreadCount,
    endCursor: data.notifications.pageInfo.endCursor,
    hasNextPage: data.notifications.pageInfo.hasNextPage,
  }
}

export async function markRead(idValue: string): Promise<AppNotification | null> {
  const id = graphQlLongLiteral(idValue)
  const data = await gatewayGraphQl<{ markNotificationRead: NotificationGraphQl | null }>(
    `mutation MarkNotificationRead { markNotificationRead(id: ${id}) { ${NOTIFICATION_FIELDS} } }`,
  )
  if (!data.markNotificationRead) return null
  return (await hydrate([data.markNotificationRead]))[0] ?? null
}

export async function markAllRead(): Promise<number> {
  const data = await gatewayGraphQl<{ markAllNotificationsRead: number }>(
    `mutation MarkAllNotificationsRead { markAllNotificationsRead }`,
  )
  return data.markAllNotificationsRead
}

export function subscribeNotifications(
  onNotification: (notification: AppNotification) => void,
  onError?: (error: Error) => void,
): () => void {
  return subscribeGatewayGraphQl<{ notificationCreated: NotificationGraphQl }>({
    query: `subscription NotificationCreated { notificationCreated { ${NOTIFICATION_FIELDS} } }`,
    onData: (data) => {
      void hydrate([data.notificationCreated]).then((items) => {
        if (items[0]) onNotification(items[0])
      }).catch((error: unknown) => onError?.(error instanceof Error ? error : new Error('Unable to hydrate notification.')))
    },
    onError,
  })
}

export const notificationApi = { notifications, markRead, markAllRead, subscribeNotifications }
