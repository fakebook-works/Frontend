import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { socialApi, type SocialContent, type SocialProfile } from '../api/social'
import type { GatewayPost } from '../api/gatewayTypes'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'

type ReelMode = 'for-you' | 'following' | 'mine' | 'saved' | 'liked' | 'shared' | 'watched'
const ContentActions = lazy(() => import('../components/ContentActions').then((module) => ({ default: module.ContentActions })))
const CreateReelModal = lazy(() => import('../components/CreateReelModal'))

export function ReelsPage({ userId, mode, onNavigate }: { userId: string; mode: ReelMode; onNavigate: (path: string) => void }) {
  const { t } = useI18n()
  const [reels, setReels] = useState<SocialContent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [creatorProfile, setCreatorProfile] = useState<SocialProfile | null>(null)
  const [commentReelId, setCommentReelId] = useState<string | null>(null)
  const loadedRequestRef = useRef<string | null>(null)
  const creatorProfileUserRef = useRef<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setReels(mode === 'mine'
        ? (await socialApi.getProfileReels(userId, 24)).items
        : mode === 'saved'
          ? (await socialApi.getSavedContent(50)).items.flatMap((item) => item.kind === 'reel' ? [item.reel] : [])
          : mode === 'liked' || mode === 'shared' || mode === 'watched'
            ? await socialApi.getReelCollection(mode, 50)
            : await socialApi.getRecommendedReels(userId, mode === 'following' ? 'FOLLOWING' : 'FOR_YOU', 0, 24))
    } catch {
      setError(t('reelsLoadError'))
    } finally {
      setLoading(false)
    }
  }, [mode, t, userId])
  useEffect(() => {
    const requestKey = `${userId}:${mode}`
    if (loadedRequestRef.current === requestKey) return
    loadedRequestRef.current = requestKey
    void load()
  }, [load, mode, userId])
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('reels-page-scroll')
    document.body.classList.add('reels-page-scroll')
    return () => {
      root.classList.remove('reels-page-scroll')
      document.body.classList.remove('reels-page-scroll')
    }
  }, [])
  useEffect(() => {
    document.body.classList.toggle('reels-comments-open', Boolean(commentReelId))
    return () => document.body.classList.remove('reels-comments-open')
  }, [commentReelId])
  useEffect(() => {
    if (commentReelId && !loading && !reels.some((reel) => reel.id === commentReelId)) setCommentReelId(null)
  }, [commentReelId, loading, reels])
  useEffect(() => {
    if (!commentReelId) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCommentReelId(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [commentReelId])
  useEffect(() => {
    if (creatorProfileUserRef.current === userId) return
    let active = true
    void socialApi.getProfile(userId).then((value) => {
      if (!active) return
      creatorProfileUserRef.current = userId
      setCreatorProfile(value)
    }).catch(() => { if (active) creatorProfileUserRef.current = userId })
    return () => { active = false }
  }, [userId])
  return <main className={`reels-page${commentReelId ? ' has-comments-sidebar' : ''}`}><aside className="reels-sidebar"><h1>{t('reels')}</h1><button className={mode === 'for-you' ? 'active' : ''} onClick={() => onNavigate('/reels/for-you')}><Icon name="gift" />{t('forYou')}</button><button className={mode === 'following' ? 'active' : ''} onClick={() => onNavigate('/reels/following')}><Icon name="friends" />{t('following')}</button><button className={mode === 'mine' ? 'active' : ''} onClick={() => onNavigate('/reels/mine')}><Icon name="video" />{t('yourReels')}</button><button className={mode === 'saved' ? 'active' : ''} onClick={() => onNavigate('/reels/saved')}><Icon name="bookmark" />{t('savedReels')}</button><button className={mode === 'liked' ? 'active' : ''} onClick={() => onNavigate('/reels/liked')}><Icon name="like" />{t('likedReels')}</button><button className={mode === 'shared' ? 'active' : ''} onClick={() => onNavigate('/reels/shared')}><Icon name="share" />{t('sharedReels')}</button><button className={mode === 'watched' ? 'active' : ''} onClick={() => onNavigate('/reels/watched')}><Icon name="watch" />{t('watchedReels')}</button><button type="button" onClick={() => setCreating(true)}><Icon name="plus" />{t('createReel')}</button></aside><section className="reels-stage">{loading ? <div className="card state-card"><span className="spinner" /></div> : error ? <div className="card state-card"><h2>{t('unableToLoad')}</h2><p>{error}</p><button className="btn-primary" onClick={() => void load()}>{t('tryAgain')}</button></div> : reels.length === 0 ? <div className="card state-card"><h2>{t('noReels')}</h2><p>{t('noReelsDesc')}</p>{mode === 'mine' && <button className="btn-primary" onClick={() => setCreating(true)}>{t('createReel')}</button>}</div> : reels.map((reel) => <ReelCard key={reel.id} reel={reel} viewerId={userId} commentsOpen={commentReelId === reel.id} onCommentsOpenChange={(open) => setCommentReelId(open ? reel.id : null)} onNavigate={onNavigate} />)}</section>{creating && <Suspense fallback={<div className="modal-backdrop reel-composer-backdrop"><span className="spinner" /></div>}><CreateReelModal userId={userId} displayName={creatorProfile?.displayName ?? t('fakebookUser')} avatarUrl={creatorProfile?.avatarUrl ?? null} isVerified={creatorProfile?.isVerified} onClose={() => setCreating(false)} onCreated={(post) => { setReels((current) => [{ id: post.id, type: post.type, content: post.content, privacy: post.privacy, createdAt: post.create, authorId: post.author.id, media: post.media, aspectRatio: post.__typename === 'ReelDetail' ? post.aspectRatio : null, focalPointX: post.__typename === 'ReelDetail' ? post.focalPointX : null, focalPointY: post.__typename === 'ReelDetail' ? post.focalPointY : null, author: { id: post.author.id, username: post.author.name, displayName: post.author.name, avatarUrl: post.author.avatar || null, isVerified: post.author.isVerified } }, ...current.filter((reel) => reel.id !== post.id)]); setCreating(false) }} /></Suspense>}</main>
}

function ReelCard({ reel, viewerId, commentsOpen, onCommentsOpenChange, onNavigate }: { reel: SocialContent; viewerId: string; commentsOpen: boolean; onCommentsOpenChange: (open: boolean) => void; onNavigate: (path: string) => void }) {
  const { t } = useI18n(); const media = reel.media[0]
  const videoRef = useRef<HTMLVideoElement>(null)
  useLayoutEffect(() => {
    const video = videoRef.current
    return () => { if (video && !video.paused) video.pause() }
  }, [media?.url])
  const post = reelAsGatewayPost(reel, t('fakebookUser'))
  const selectedRatio = typeof reel.aspectRatio === 'number' && Number.isFinite(reel.aspectRatio) && reel.aspectRatio >= 9 / 16 && reel.aspectRatio <= 16 / 9 ? reel.aspectRatio : null
  const focalPointX = typeof reel.focalPointX === 'number' && reel.focalPointX >= 0 && reel.focalPointX <= 1 ? reel.focalPointX : 0.5
  const focalPointY = typeof reel.focalPointY === 'number' && reel.focalPointY >= 0 && reel.focalPointY <= 1 ? reel.focalPointY : 0.5
  const objectPosition = `${focalPointX * 100}% ${focalPointY * 100}%`
  return <article className="reel-card"><div className="reel-canvas">{media ? selectedRatio ? <div className="reel-card-media-frame" style={{ aspectRatio: String(selectedRatio) }}>{media.type === 1 ? <video ref={videoRef} src={media.url} controls preload="metadata" style={{ objectPosition }} /> : <img src={media.url} alt="" style={{ objectPosition }} />}</div> : media.type === 1 ? <video ref={videoRef} src={media.url} controls preload="metadata" /> : <img src={media.url} alt="" /> : <div className="reel-missing"><Icon name="video" size={64} /><span>{t('mediaUnavailable')}</span></div>}<div className="reel-overlay"><button type="button" onClick={() => reel.author && onNavigate(`/profile/${reel.author.id}`)}><Avatar name={reel.author?.displayName ?? t('fakebookUser')} src={reel.author?.avatarUrl} size={42} /></button><div><button type="button" className="post-author-name" onClick={() => reel.author && onNavigate(`/profile/${reel.author.id}`)}><strong>{reel.author?.displayName ?? t('fakebookUser')}<VerifiedBadge verified={reel.author?.isVerified} /></strong></button><p>{reel.content}</p></div></div></div><Suspense fallback={<div className="content-actions-skeleton" />}><ContentActions viewerId={viewerId} contentId={reel.id} post={post} variant="reel" commentsPresentation="sidebar" commentsOpen={commentsOpen} onCommentsOpenChange={onCommentsOpenChange} onNavigate={onNavigate} /></Suspense></article>
}

function reelAsGatewayPost(reel: SocialContent, fallbackName: string): GatewayPost {
  return {
    __typename: 'ReelDetail',
    id: reel.id,
    type: reel.type,
    content: reel.content,
    privacy: reel.privacy,
    create: reel.createdAt,
    author: {
      id: reel.author?.id ?? reel.authorId,
      name: reel.author?.displayName ?? fallbackName,
      avatar: reel.author?.avatarUrl ?? '',
      isVerified: reel.author?.isVerified ?? false,
    },
    media: reel.media,
    mentions: reel.mentions,
    taggedUsers: [],
    aspectRatio: reel.aspectRatio,
    focalPointX: reel.focalPointX,
    focalPointY: reel.focalPointY,
  }
}
