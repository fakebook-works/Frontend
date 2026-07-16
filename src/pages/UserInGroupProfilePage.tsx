import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GatewayMedia, GatewayPost } from '../api/gatewayTypes'
import { socialApi, type GroupMembershipState, type SocialGroup, type SocialOwnedMedia, type SocialProfile } from '../api/social'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { GatewayPostCard } from './GatewayHomePage'

type GroupProfileTab = 'posts' | 'photos' | 'about'

const EMPTY_MEMBERSHIP: GroupMembershipState = {
  isMember: false,
  isAdmin: false,
  joinRequestPending: false,
  canViewPosts: false,
}

export function UserInGroupProfilePage({ groupId, profileId, viewerId, onBack, onNavigate }: { groupId: string; profileId: string; viewerId: string; onBack: () => void; onNavigate: (path: string) => void }) {
  const { t, locale } = useI18n()
  const [profile, setProfile] = useState<SocialProfile | null>(null)
  const [group, setGroup] = useState<SocialGroup | null>(null)
  const [membership, setMembership] = useState<GroupMembershipState>(EMPTY_MEMBERSHIP)
  const [posts, setPosts] = useState<GatewayPost[]>([])
  const [ownedMedia, setOwnedMedia] = useState<SocialOwnedMedia[]>([])
  const [postCursor, setPostCursor] = useState<string | null>(null)
  const [postsHaveMore, setPostsHaveMore] = useState(false)
  const [tab, setTab] = useState<GroupProfileTab>('posts')
  const [loading, setLoading] = useState(true)
  const [postsLoading, setPostsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    Promise.all([
      socialApi.getProfile(profileId),
      socialApi.getGroup(groupId),
      socialApi.getGroupMembershipState(viewerId, groupId),
    ]).then(([profileValue, groupValue, membershipValue]) => {
      if (!active) return
      setProfile(profileValue)
      setGroup(groupValue)
      setMembership(membershipValue)
    }).catch(() => active && setError(t('groupMemberProfileLoadError'))).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [groupId, profileId, t, viewerId])

  const loadPosts = useCallback(async (cursor: string | null = null, append = false) => {
    if (!membership.canViewPosts) {
      setPosts([])
      setPostCursor(null)
      setPostsHaveMore(false)
      return
    }
    setPostsLoading(true)
    try {
      const page = await socialApi.getGroupUserPosts(groupId, profileId, 20, cursor)
      setPosts((current) => append ? [...current, ...page.items] : page.items)
      setPostCursor(page.endCursor)
      setPostsHaveMore(page.hasNextPage)
    } catch {
      setError(t('groupMemberPostsLoadError'))
    } finally {
      setPostsLoading(false)
    }
  }, [groupId, membership.canViewPosts, profileId, t])

  useEffect(() => { void loadPosts() }, [loadPosts])

  useEffect(() => {
    let active = true
    socialApi.getOwnedMedia(profileId, 0, 60).then((page) => active && setOwnedMedia(page.items)).catch(() => active && setOwnedMedia([]))
    return () => { active = false }
  }, [profileId])

  const photos = useMemo(() => {
    const media: GatewayMedia[] = [
      ...ownedMedia,
      ...posts.flatMap((post) => post.media.filter((item) => item.type === 0)),
    ]
    return [...new Map(media.map((item) => [item.url, item])).values()]
  }, [ownedMedia, posts])

  if (loading) return <main className="profile-destination"><div className="card state-card"><span className="spinner" /></div></main>
  if (!profile || !group) return <main className="profile-destination"><div className="card state-card"><h2>{t('groupMemberProfileUnavailable')}</h2><p>{error || t('groupMemberProfileLoadError')}</p><button type="button" className="btn-soft" onClick={onBack}>{t('backToGroup')}</button></div></main>

  const contextualAuthorPath = (authorId: string) => `/groups/${group.id}/members/${authorId}`

  return <main className="profile-destination group-member-profile">
    <section className="profile-cover-card">
      <div className="profile-cover" style={profile.backgroundUrl ? { backgroundImage: `url(${profile.backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />
      <div className="profile-destination-header">
        <Avatar name={profile.displayName} src={profile.avatarUrl} size={164} />
        <div className="profile-destination-title"><h1>{profile.displayName}<VerifiedBadge verified={profile.isVerified} size={20} /></h1><button type="button" className="group-context-link" onClick={onBack}><Avatar name={group.name} src={group.avatarUrl} size={26} />{t('memberOfGroup', { group: group.name })}</button></div>
        <div className="group-membership-actions"><button type="button" className="btn-soft" onClick={onBack}><Icon name="groups" size={17} />{t('backToGroup')}</button><button type="button" className="btn-soft" onClick={() => onNavigate(`/profile/${profile.id}`)}>{t('viewFullProfile')}</button></div>
      </div>
      <nav className="profile-tabs"><button type="button" className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>{t('postsLabel')}</button><button type="button" className={tab === 'photos' ? 'active' : ''} onClick={() => setTab('photos')}>{t('photos')}</button><button type="button" className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>{t('about')}</button></nav>
    </section>
    {error && <p className="inline-alert profile-inline-alert">{error}</p>}
    <div className="profile-destination-grid">
      <aside className="card profile-intro"><h2>{t('groupContext')}</h2><button type="button" className="group-context-card" onClick={onBack}><Avatar name={group.name} src={group.avatarUrl} size={54} /><span><strong>{group.name}</strong><small>{group.privacy === 0 ? t('publicGroup') : t('privateGroup')}</small></span></button>{profile.bio && <p>{profile.bio}</p>}{profile.location && <p><Icon name="location" size={18} />{t('livesIn', { location: profile.location })}</p>}</aside>
      <section className="profile-post-list">
        {tab === 'posts' && (!membership.canViewPosts ? <div className="card state-card"><h2>{t('privateGroup')}</h2><p>{t('joinToSeePosts')}</p></div> : postsLoading && posts.length === 0 ? <div className="card state-card"><span className="spinner" /></div> : posts.length === 0 ? <div className="card state-card"><h2>{t('groupMemberNoPosts')}</h2><p>{t('groupMemberNoPostsDesc', { name: profile.displayName.split(' ')[0], group: group.name })}</p></div> : <>{posts.map((post) => <GatewayPostCard key={post.id} post={post} locale={locale} viewerId={viewerId} onNavigate={onNavigate} authorPath={contextualAuthorPath} />)}{postsHaveMore && <button type="button" className="btn-soft load-more-result" disabled={postsLoading || !postCursor} onClick={() => void loadPosts(postCursor, true)}>{postsLoading ? t('loadingMore') : t('seeMore')}</button>}</>)}
        {tab === 'photos' && <div className="card profile-tab-card"><h2>{t('groupContextPhotos')}</h2><p className="muted">{t('groupContextPhotosDesc', { group: group.name })}</p>{photos.length === 0 ? <p className="muted">{t('photosEmpty')}</p> : <div className="profile-photo-grid">{photos.map((media) => <a key={media.id} href={media.url} target="_blank" rel="noreferrer"><img src={media.url} alt="" loading="lazy" /></a>)}</div>}</div>}
        {tab === 'about' && <div className="card profile-tab-card"><h2>{t('about')}</h2><dl><div><dt>{t('bio')}</dt><dd>{profile.bio || t('notAvailable')}</dd></div><div><dt>{t('location')}</dt><dd>{profile.location || t('notAvailable')}</dd></div><div><dt>{t('group')}</dt><dd>{group.name}</dd></div></dl></div>}
      </section>
    </div>
  </main>
}
