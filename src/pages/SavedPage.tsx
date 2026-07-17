import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { socialApi, type SavedContentItem } from '../api/social'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { GatewayPostCard } from './GatewayHomePage'

const ContentActions = lazy(() => import('../components/ContentActions').then((module) => ({ default: module.ContentActions })))

export function SavedPage({ userId, onNavigate }: { userId: string; onNavigate: (path: string) => void }) {
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

  useEffect(() => { void load() }, [load])

  return <main className="saved-page"><header className="page-content-head"><div><h1>{t('saved')}</h1><p>{t('savedSubtitle')}</p></div><button type="button" className="btn-soft" onClick={() => void load()}>{t('refresh')}</button></header>{loading && items.length === 0 ? <div className="card state-card"><span className="spinner" /></div> : error ? <div className="card state-card"><h2>{t('unableToLoad')}</h2><p>{error}</p><button type="button" className="btn-primary" onClick={() => void load()}>{t('tryAgain')}</button></div> : items.length === 0 ? <div className="card state-card"><Icon name="bookmark" size={42} /><h2>{t('savedEmpty')}</h2><p>{t('savedEmptyDesc')}</p></div> : <section className="saved-content-list">{items.map((item) => item.kind === 'post' ? <GatewayPostCard key={item.id} post={item.post} locale={locale} viewerId={userId} onNavigate={onNavigate} /> : <article className="card saved-reel" key={item.id}><div className="saved-reel-media">{item.reel.media[0] ? item.reel.media[0].type === 1 ? <video src={item.reel.media[0].url} controls preload="metadata" /> : <img src={item.reel.media[0].url} alt="" /> : <Icon name="video" size={48} />}</div><div className="saved-reel-body"><button type="button" className="request-profile" onClick={() => item.reel.author && onNavigate(`/profile/${item.reel.author.id}`)}><Avatar name={item.reel.author?.displayName ?? t('fakebookUser')} src={item.reel.author?.avatarUrl} size={42} /><strong>{item.reel.author?.displayName ?? t('fakebookUser')}<VerifiedBadge verified={item.reel.author?.isVerified} /></strong></button><p>{item.reel.content || t('reelNoCaption')}</p><Suspense fallback={<div className="content-actions-skeleton" />}><ContentActions viewerId={userId} contentId={item.reel.id} onNavigate={onNavigate} /></Suspense></div></article>)}</section>}{hasMore && <button type="button" className="btn-soft load-more-result" disabled={loading || !cursor} onClick={() => void load(cursor, true)}>{loading ? t('loadingMore') : t('seeMore')}</button>}</main>
}
