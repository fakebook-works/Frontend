import { useCallback, useEffect, useRef, useState } from 'react'
import { notificationApi, type AppNotification } from '../api/notifications'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { timeAgo } from '../lib/format'
import { notificationTarget, notificationText } from '../lib/notifications'

type NotificationFilter = 'all' | 'unread'

export function NotificationsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { t } = useI18n()
  const [items, setItems] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [endCursor, setEndCursor] = useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const seenRealtimeIds = useRef(new Set<string>())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const page = await notificationApi.notifications(30, null, filter === 'unread')
      page.items.forEach((item) => seenRealtimeIds.current.add(item.id))
      setItems(page.items)
      setUnreadCount(page.unreadCount)
      setEndCursor(page.endCursor)
      setHasNextPage(page.hasNextPage)
    } catch {
      setError(t('notificationsLoadError'))
    } finally {
      setLoading(false)
    }
  }, [filter, t])

  useEffect(() => { void load() }, [load])

  useEffect(() => notificationApi.subscribeNotifications((notification) => {
    if (seenRealtimeIds.current.has(notification.id)) return
    seenRealtimeIds.current.add(notification.id)
    if (!notification.isRead) setUnreadCount((count) => count + 1)
    if (filter === 'all' || !notification.isRead) {
      setItems((current) => current.some((item) => item.id === notification.id) ? current : [notification, ...current])
    }
  }), [filter])

  async function loadMore() {
    if (!endCursor || !hasNextPage || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await notificationApi.notifications(30, endCursor, filter === 'unread')
      page.items.forEach((item) => seenRealtimeIds.current.add(item.id))
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id))
        return [...current, ...page.items.filter((item) => !seen.has(item.id))]
      })
      setUnreadCount(page.unreadCount)
      setEndCursor(page.endCursor)
      setHasNextPage(page.hasNextPage)
    } catch {
      setError(t('notificationsLoadError'))
    } finally {
      setLoadingMore(false)
    }
  }

  async function open(item: AppNotification) {
    if (!item.isRead) {
      try {
        await notificationApi.markRead(item.id)
        setItems((current) => filter === 'unread'
          ? current.filter((entry) => entry.id !== item.id)
          : current.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry))
        setUnreadCount((count) => Math.max(0, count - 1))
      } catch {
        // The deep-link remains useful while a read receipt is temporarily unavailable.
      }
    }
    onNavigate(notificationTarget(item))
  }

  async function markAll() {
    try {
      await notificationApi.markAllRead()
      setItems((current) => filter === 'unread' ? [] : current.map((item) => ({ ...item, isRead: true })))
      setUnreadCount(0)
      setHasNextPage(false)
      setEndCursor(null)
    } catch {
      setError(t('notificationActionError'))
    }
  }

  return <main className="notification-page">
    <header className="page-content-head">
      <div><h1>{t('notifications')}</h1><p>{unreadCount > 0 ? t('unreadNotifications', { count: unreadCount }) : t('notificationsCaughtUp')}</p></div>
      {unreadCount > 0 && <button className="btn-soft" onClick={() => void markAll()}>{t('markAllRead')}</button>}
    </header>
    <div className="notification-filters" role="tablist">
      <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>{t('allNotifications')}</button>
      <button type="button" className={filter === 'unread' ? 'active' : ''} onClick={() => setFilter('unread')}>{t('unreadOnly')}</button>
    </div>
    {loading
      ? <div className="card state-card"><span className="spinner" /></div>
      : error && items.length === 0
        ? <div className="card state-card"><h2>{t('unableToLoad')}</h2><p>{error}</p><button className="btn-primary" onClick={() => void load()}>{t('tryAgain')}</button></div>
        : items.length === 0
          ? <div className="card state-card"><Icon name="bell" size={44} /><h2>{t('noNotifications')}</h2><p>{t('noNotificationsDesc')}</p></div>
          : <>
            <section className="card notification-list">{items.map((item) => <button type="button" key={item.id} className={item.isRead ? 'notification-row' : 'notification-row unread'} onClick={() => void open(item)}><Avatar name={item.actor?.displayName ?? t('fakebookUser')} src={item.actor?.avatarUrl} size={56} /><span><strong>{item.actor?.displayName ?? t('fakebookUser')}<VerifiedBadge verified={item.actor?.isVerified} /></strong><span>{notificationText(item.actionType, t)}</span><small>{timeAgo(item.createdAt)}</small></span>{!item.isRead && <i />}</button>)}</section>
            {error && <p className="inline-error">{error}</p>}
            {hasNextPage && <div className="load-more-row"><button type="button" className="btn-soft" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? <span className="spinner" /> : t('seeMore')}</button></div>}
          </>}
  </main>
}
