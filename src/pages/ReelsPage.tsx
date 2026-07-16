import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api/client'
import { socialApi, type SocialContent } from '../api/social'
import { Avatar } from '../components/Avatar'
import { ContentActions } from '../components/ContentActions'
import { Icon } from '../components/Icon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'

type ReelMode = 'for-you' | 'following' | 'mine' | 'saved' | 'liked' | 'shared' | 'watched'

export function ReelsPage({ userId, mode, onNavigate }: { userId: string; mode: ReelMode; onNavigate: (path: string) => void }) {
  const { t } = useI18n()
  const [reels, setReels] = useState<SocialContent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
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
  useEffect(() => { void load() }, [load])
  return <main className="reels-page"><aside className="reels-sidebar"><h1>{t('reels')}</h1><button className={mode === 'for-you' ? 'active' : ''} onClick={() => onNavigate('/reels/for-you')}><Icon name="gift" />{t('forYou')}</button><button className={mode === 'following' ? 'active' : ''} onClick={() => onNavigate('/reels/following')}><Icon name="friends" />{t('following')}</button><button className={mode === 'mine' ? 'active' : ''} onClick={() => onNavigate('/reels/mine')}><Icon name="video" />{t('yourReels')}</button><button className={mode === 'saved' ? 'active' : ''} onClick={() => onNavigate('/reels/saved')}><Icon name="bookmark" />{t('savedReels')}</button><button className={mode === 'liked' ? 'active' : ''} onClick={() => onNavigate('/reels/liked')}><Icon name="like" />{t('likedReels')}</button><button className={mode === 'shared' ? 'active' : ''} onClick={() => onNavigate('/reels/shared')}><Icon name="share" />{t('sharedReels')}</button><button className={mode === 'watched' ? 'active' : ''} onClick={() => onNavigate('/reels/watched')}><Icon name="watch" />{t('watchedReels')}</button><button type="button" onClick={() => setCreating(true)}><Icon name="plus" />{t('createReel')}</button></aside><section className="reels-stage">{loading ? <div className="card state-card"><span className="spinner" /></div> : error ? <div className="card state-card"><h2>{t('unableToLoad')}</h2><p>{error}</p><button className="btn-primary" onClick={() => void load()}>{t('tryAgain')}</button></div> : reels.length === 0 ? <div className="card state-card"><h2>{t('noReels')}</h2><p>{t('noReelsDesc')}</p>{mode === 'mine' && <button className="btn-primary" onClick={() => setCreating(true)}>{t('createReel')}</button>}</div> : reels.map((reel) => <ReelCard key={reel.id} reel={reel} viewerId={userId} onNavigate={onNavigate} />)}</section>{creating && <CreateReelModal userId={userId} onClose={() => setCreating(false)} onCreated={(reel) => { setReels((current) => [reel, ...current]); setCreating(false) }} />}</main>
}

function ReelCard({ reel, viewerId, onNavigate }: { reel: SocialContent; viewerId: string; onNavigate: (path: string) => void }) {
  const { t } = useI18n(); const media = reel.media[0]
  return <article className="reel-card"><div className="reel-canvas">{media ? media.type === 1 ? <video src={media.url} controls preload="metadata" /> : <img src={media.url} alt="" /> : <div className="reel-missing"><Icon name="video" size={64} /><span>{t('mediaUnavailable')}</span></div>}<div className="reel-overlay"><button type="button" onClick={() => reel.author && onNavigate(`/profile/${reel.author.id}`)}><Avatar name={reel.author?.displayName ?? t('fakebookUser')} src={reel.author?.avatarUrl} size={42} /></button><div><button type="button" className="post-author-name" onClick={() => reel.author && onNavigate(`/profile/${reel.author.id}`)}><strong>{reel.author?.displayName ?? t('fakebookUser')}<VerifiedBadge verified={reel.author?.isVerified} /></strong></button><p>{reel.content}</p></div></div></div><ContentActions viewerId={viewerId} contentId={reel.id} variant="reel" onNavigate={onNavigate} /></article>
}

function CreateReelModal({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: (reel: SocialContent) => void }) {
  const { t } = useI18n(); const [content, setContent] = useState(''); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent) { event.preventDefault(); if (!file) return; setBusy(true); setError(null); try { const uploaded = await api.uploadMedia(file); onCreated(await socialApi.createReel(userId, { content: content.trim(), media: { type: uploaded.type === 'video' ? 1 : 0, url: uploaded.url } })) } catch { setError(t('createReelError')) } finally { setBusy(false) } }
  return <div className="modal-backdrop" onClick={() => !busy && onClose()}><form className="modal compact-form-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}><header className="modal-head"><h2>{t('createReel')}</h2><button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button></header><div className="modal-body settings-form-grid"><label className="wide"><span>{t('caption')}</span><textarea rows={3} value={content} onChange={(event) => setContent(event.target.value)} /></label><label className="wide file-drop"><Icon name="video" size={28} /><span>{file?.name ?? t('chooseReelVideo')}</span><input type="file" accept="video/*,image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>{error && <p className="form-error wide">{error}</p>}</div><footer className="modal-foot"><button className="btn-primary block" disabled={busy || !file}>{busy ? t('posting') : t('publish')}</button></footer></form></div>
}
