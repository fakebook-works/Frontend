import { lazy, Suspense, useEffect, useState } from 'react'
import { searchApi, type SearchPageResult, type SearchTab } from '../api/search'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { GatewayPostCard } from './GatewayHomePage'

const ContentActions = lazy(() => import('../components/ContentActions').then((module) => ({ default: module.ContentActions })))

const TABS: Array<{ id: SearchTab; icon: 'search' | 'friends' | 'video' | 'groups'; label: string }> = [
  { id: 'posts', icon: 'search', label: 'searchPosts' },
  { id: 'people', icon: 'friends', label: 'searchPeople' },
  { id: 'reels', icon: 'video', label: 'reels' },
  { id: 'groups', icon: 'groups', label: 'groups' },
]

const EMPTY: SearchPageResult = { tab: 'posts', page: 1, hasNextPage: false, users: [], groups: [], posts: [], reels: [] }

export function SearchPage({ query, tab, userId, onNavigate }: { query: string; tab: SearchTab; userId: string; onNavigate: (path: string) => void }) {
  const { t, locale } = useI18n()
  const [result, setResult] = useState<SearchPageResult>({ ...EMPTY, tab })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    searchApi.search(query, tab, 1).then((value) => {
      if (active) setResult(value)
    }).catch(() => {
      if (active) setError(t('searchLoadError'))
    }).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [query, reloadKey, tab, t])

  async function loadMore() {
    setLoadingMore(true)
    setError(null)
    try {
      const next = await searchApi.search(query, tab, result.page + 1)
      setResult((current) => ({
        ...next,
        users: [...current.users, ...next.users],
        groups: [...current.groups, ...next.groups],
        posts: [...current.posts, ...next.posts],
        reels: [...current.reels, ...next.reels],
      }))
    } catch {
      setError(t('searchLoadError'))
    } finally {
      setLoadingMore(false)
    }
  }

  function openResult(referenceId: string, path: string) {
    void searchApi.recordSearchResultView(referenceId).catch(() => undefined)
    onNavigate(path)
  }

  const count = result.users.length + result.groups.length + result.posts.length + result.reels.length
  return (
    <main className="discovery-layout">
      <aside className="discovery-sidebar">
        <h1>{t('searchResults')}</h1>
        <p>{query ? t('resultsFor', { query }) : t('searchPrompt')}</p>
        <nav aria-label={t('searchFilters')}>
          {TABS.map((item) => (
            <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => onNavigate(`/search?q=${encodeURIComponent(query)}&tab=${item.id}`)}>
              <span><Icon name={item.icon} size={20} /></span>{t(item.label)}
            </button>
          ))}
        </nav>
      </aside>
      <section className="discovery-content">
        {loading ? <StateCard loading title={t('loadingSearch')} /> : error ? (
          <StateCard title={t('unableToLoad')} detail={error} action={t('tryAgain')} onAction={() => setReloadKey((value) => value + 1)} />
        ) : count === 0 ? (
          <StateCard title={t('noSearchResults')} detail={t('noSearchResultsDesc')} />
        ) : (
          <div className="result-stack">
            {result.users.map((profile) => (
              <button type="button" className="card entity-result" key={profile.id} onClick={() => openResult(profile.searchReferenceId, `/profile/${profile.id}`)}>
                <Avatar name={profile.displayName} src={profile.avatarUrl} size={64} />
                <span><strong>{profile.displayName}<VerifiedBadge verified={profile.isVerified} /></strong><small>{profile.followerCount > 0 ? t('followersCount', { count: profile.followerCount }) : t('personResult')}</small></span>
                <Icon name="caret" size={18} />
              </button>
            ))}
            {result.groups.map((group) => (
              <button type="button" className="card entity-result" key={group.id} onClick={() => openResult(group.searchReferenceId, `/groups/${group.id}`)}>
                <Avatar name={group.name} src={group.avatarUrl} size={64} />
                <span><strong>{group.name}</strong><small>{group.memberCount == null ? t('groupResult') : t('membersCount', { count: group.memberCount })} · {group.privacy === 0 ? t('publicGroup') : t('privateGroup')}</small></span>
                <Icon name="caret" size={18} />
              </button>
            ))}
            {result.posts.map((post) => <div key={post.id} onClickCapture={() => void searchApi.recordSearchResultView(post.searchReferenceId).catch(() => undefined)}><GatewayPostCard post={post} locale={locale} viewerId={userId} onNavigate={onNavigate} /></div>)}
            {result.reels.map((reel) => <ReelResult key={reel.id} reel={reel} viewerId={userId} onNavigate={onNavigate} onView={() => void searchApi.recordSearchResultView(reel.searchReferenceId).catch(() => undefined)} />)}
            {result.hasNextPage && <button type="button" className="btn-soft load-more-result" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? t('loadingMore') : t('seeMore')}</button>}
          </div>
        )}
      </section>
    </main>
  )
}

function ReelResult({ reel, viewerId, onNavigate, onView }: { reel: SearchPageResult['reels'][number]; viewerId: string; onNavigate: (path: string) => void; onView: () => void }) {
  const { t } = useI18n()
  const media = reel.media[0]
  return <article className="card reel-result-card" onClickCapture={onView}>
    <div className="reel-result-media">{media ? media.type === 1 ? <video src={media.url} controls preload="metadata" /> : <img src={media.url} alt="" /> : <Icon name="video" size={50} />}</div>
    <div><button type="button" className="post-author-name" onClick={() => reel.author && onNavigate(`/profile/${reel.author.id}`)}><strong>{reel.author?.displayName ?? t('reel')}</strong></button><p>{reel.content || t('reelNoCaption')}</p><Suspense fallback={<div className="content-actions-skeleton" />}><ContentActions viewerId={viewerId} contentId={reel.id} onNavigate={onNavigate} /></Suspense></div>
  </article>
}

function StateCard({ loading, title, detail, action, onAction }: { loading?: boolean; title: string; detail?: string; action?: string; onAction?: () => void }) {
  return <div className="card state-card discovery-state">{loading && <span className="spinner" />}<h2>{title}</h2>{detail && <p>{detail}</p>}{action && <button type="button" className="btn-primary" onClick={onAction}>{action}</button>}</div>
}
