import { useCallback, useEffect, useState } from 'react'
import { notificationApi, type AppNotification } from '../api/notifications'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { timeAgo } from '../lib/format'

export function NotificationsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { t } = useI18n()
  const [items, setItems] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => { setLoading(true); setError(null); try { const page = await notificationApi.notifications(40); setItems(page.items); setUnreadCount(page.unreadCount) } catch { setError(t('notificationsLoadError')) } finally { setLoading(false) } }, [t])
  useEffect(() => { void load(); return notificationApi.subscribeNotifications((notification) => { setItems((current) => current.some((item) => item.id === notification.id) ? current : [notification, ...current]); setUnreadCount((count) => count + (notification.isRead ? 0 : 1)) }) }, [load])
  async function open(item: AppNotification) { if (!item.isRead) { try { await notificationApi.markRead(item.id); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry)); setUnreadCount((count) => Math.max(0, count - 1)) } catch { /* navigation remains available */ } } onNavigate(notificationTarget(item)) }
  async function markAll() { try { await notificationApi.markAllRead(); setItems((current) => current.map((item) => ({ ...item, isRead: true }))); setUnreadCount(0) } catch { setError(t('notificationActionError')) } }
  return <main className="notification-page"><header className="page-content-head"><div><h1>{t('notifications')}</h1><p>{unreadCount > 0 ? t('unreadNotifications', { count: unreadCount }) : t('notificationsCaughtUp')}</p></div>{unreadCount > 0 && <button className="btn-soft" onClick={() => void markAll()}>{t('markAllRead')}</button>}</header>{loading ? <div className="card state-card"><span className="spinner" /></div> : error ? <div className="card state-card"><h2>{t('unableToLoad')}</h2><p>{error}</p><button className="btn-primary" onClick={() => void load()}>{t('tryAgain')}</button></div> : items.length === 0 ? <div className="card state-card"><Icon name="bell" size={44} /><h2>{t('noNotifications')}</h2><p>{t('noNotificationsDesc')}</p></div> : <section className="card notification-list">{items.map((item) => <button type="button" key={item.id} className={item.isRead ? 'notification-row' : 'notification-row unread'} onClick={() => void open(item)}><Avatar name={item.actor?.displayName ?? t('fakebookUser')} src={item.actor?.avatarUrl} size={56} /><span><strong>{item.actor?.displayName ?? t('fakebookUser')}<VerifiedBadge verified={item.actor?.isVerified} /></strong><span>{notificationText(item.actionType, t)}</span><small>{timeAgo(item.createdAt)}</small></span>{!item.isRead && <i />}</button>)}</section>}</main>
}

function notificationText(action: string, t: (key: string) => string) {
  const key: Record<string, string> = { LIKE: 'notificationLike', COMMENT: 'notificationComment', TAG: 'notificationTag', MENTION: 'notificationMention', FRIEND_REQUEST: 'notificationFriendRequest', FRIEND_ACCEPT: 'notificationFriendAccept', GROUP_INVITE: 'notificationGroupInvite', GROUP_JOIN_REQUEST: 'notificationGroupJoinRequest', GROUP_JOIN_ACCEPTED: 'notificationGroupJoinAccepted', SHARE: 'notificationShare' }
  return t(key[action] ?? 'notificationActivity')
}

function notificationTarget(item: AppNotification) {
  if (item.actionType === 'FRIEND_REQUEST' || item.actionType === 'FRIEND_ACCEPT') return `/profile/${item.creatorId}`
  if (item.actionType.startsWith('GROUP_')) return `/groups/${item.objectId}`
  return `/content/${item.objectId}`
}
