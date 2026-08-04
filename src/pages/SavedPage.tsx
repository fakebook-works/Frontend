import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GatewayPost } from '../api/gatewayTypes'
import { socialApi, type SavedContentItem } from '../api/social'
import { Icon } from '../components/Icon'
import { SidebarSettingsIcon } from '../components/SidebarSettingsIcon'
import { useI18n } from '../i18n'
import { GatewayPostCard } from './GatewayHomePage'

export type SavedSection = 'all' | 'posts' | 'reels'
type SavedReel = Extract<SavedContentItem, { kind: 'reel' }>['reel']

export function SavedPage({ userId, section = 'all', onNavigate }: { userId: string; section?: SavedSection; onNavigate: (path: string) => void }) {
  const { t, locale } = useI18n()
  const [items, setItems] = useState<SavedContentItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (nextCursor: string | null = null, append = false) => {
    setLoading(true)
    setError(null)
    try {
      const page = await socialApi.getSavedContent(30, nextCursor)
      setItems((current) => append ? [...current, ...page.items] : page.items)
      setCursor(page.endCursor)
      setHasMore(page.hasNextPage)
    } catch {
      setError(t('savedLoadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    setItems([])
    setCursor(null)
    setHasMore(false)
    void load()
  }, [load, section])

  const visibleItems = useMemo(
    () => section === 'all'
      ? items
      : items.filter((item) => section === 'posts' ? item.kind === 'post' : item.kind === 'reel'),
    [items, section],
  )
  useEffect(() => {
    if (loading || error || visibleItems.length > 0 || !hasMore || !cursor) return
    void load(cursor, true)
  }, [cursor, error, hasMore, load, loading, visibleItems.length])
  const title = section === 'all' ? t('savedAllItems') : section === 'posts' ? t('savedPosts') : t('reels')
  const sections: Array<{ id: SavedSection; path: string; label: string; icon: 'bookmark' | 'photo' | 'video' }> = [
    { id: 'all', path: '/saved', label: t('savedAllItems'), icon: 'bookmark' },
    { id: 'posts', path: '/saved/posts', label: t('savedPosts'), icon: 'photo' },
    { id: 'reels', path: '/saved/reels', label: t('reels'), icon: 'video' },
  ]

  return <main className="saved-page-layout">
    <aside className="friends-page-sidebar saved-page-sidebar">
      <header>
        <h1>{t('saved')}</h1>
        <button type="button" className="friends-settings-button" aria-label={t('settingsPrivacy')}><SidebarSettingsIcon /></button>
      </header>
      <nav aria-label={t('saved')}>
        {sections.map((item) => <button type="button" key={item.id} className={section === item.id ? 'active' : ''} onClick={() => onNavigate(item.path)}>
          <span><Icon name={item.icon} size={22} /></span>
          <strong>{item.label}</strong>
        </button>)}
      </nav>
    </aside>

    <section className="friends-page-content saved-page-content">
      <header className="friends-page-content-head"><h2>{title}</h2>{!loading && visibleItems.length > 0 && <span>{visibleItems.length}</span>}</header>
      {error && <p className="form-error friends-page-error" role="alert">{error}</p>}
      {loading && items.length === 0 ? <div className="friends-page-state"><span className="spinner" /></div> : error && items.length === 0 ? <div className="friends-page-state"><Icon name="bookmark" size={44} /><h3>{t('unableToLoad')}</h3><p>{error}</p><button type="button" className="btn-primary" onClick={() => void load()}>{t('tryAgain')}</button></div> : visibleItems.length === 0 ? <div className="friends-page-state"><Icon name={section === 'reels' ? 'video' : section === 'posts' ? 'photo' : 'bookmark'} size={44} /><h3>{t('savedEmpty')}</h3><p>{t('savedEmptyDesc')}</p></div> : <div className="groups-feed-column saved-feed-column">
        {visibleItems.map((item) => <SavedContentCard key={item.id} item={item} locale={locale} viewerId={userId} fallbackName={t('fakebookUser')} onNavigate={onNavigate} />)}
        {hasMore && <button type="button" className="btn-soft saved-load-more" disabled={loading || !cursor} onClick={() => void load(cursor, true)}>{loading ? t('loadingMore') : t('seeMore')}</button>}
      </div>}
      {!loading && visibleItems.length === 0 && hasMore && <button type="button" className="btn-soft saved-load-more" disabled={loading || !cursor} onClick={() => void load(cursor, true)}>{loading ? t('loadingMore') : t('seeMore')}</button>}
    </section>
  </main>
}

function SavedContentCard({ item, locale, viewerId, fallbackName, onNavigate }: { item: SavedContentItem; locale: string; viewerId: string; fallbackName: string; onNavigate: (path: string) => void }) {
  const post: GatewayPost = item.kind === 'post' ? item.post : savedReelToGatewayPost(item.reel, fallbackName)
  return <GatewayPostCard post={post} locale={locale} viewerId={viewerId} onNavigate={onNavigate} />
}

function savedReelToGatewayPost(reel: SavedReel, fallbackName: string): Extract<GatewayPost, { __typename: 'ReelDetail' }> {
  const author = reel.author
  return {
    __typename: 'ReelDetail',
    id: reel.id,
    type: reel.type,
    content: reel.content,
    privacy: reel.privacy,
    create: reel.createdAt,
    author: {
      id: reel.authorId,
      name: author?.displayName ?? fallbackName,
      avatar: author?.avatarUrl ?? '',
      isVerified: Boolean(author?.isVerified),
      canFollow: false,
    },
    media: reel.media,
    mentions: reel.mentions ?? [],
    taggedUsers: [],
    sharedSource: null,
    aspectRatio: reel.aspectRatio,
    focalPointX: reel.focalPointX,
    focalPointY: reel.focalPointY,
  }
}
