import { useCallback, useEffect, useState } from 'react'
import { socialApi, type ProfileRelationshipState, type SocialPhoto, type SocialProfile } from '../api/social'
import type { GatewayPost } from '../api/gatewayTypes'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { GatewayPostCard } from './GatewayHomePage'

const EMPTY_RELATIONSHIP: ProfileRelationshipState = {
  friendship: 'none',
  isFollowing: false,
  followsViewer: false,
  isBlocked: false,
  isBlockedBy: false,
}

type ProfileTab = 'posts' | 'about' | 'friends' | 'photos'

export function ProfilePage({ profile, loading, error, canEdit, viewerId, onEdit, onNavigate, onMessage }: { profile: SocialProfile | null; loading: boolean; error: string | null; canEdit: boolean; viewerId: string; onEdit: () => void; onNavigate: (path: string) => void; onMessage: (profileId: string) => Promise<void> }) {
  const { t, locale } = useI18n()
  const [posts, setPosts] = useState<GatewayPost[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [postsUnavailable, setPostsUnavailable] = useState(false)
  const [tab, setTab] = useState<ProfileTab>('posts')
  const [profileFriends, setProfileFriends] = useState<SocialProfile[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [photos, setPhotos] = useState<SocialPhoto[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [photosUnavailable, setPhotosUnavailable] = useState(false)
  const [photoCursor, setPhotoCursor] = useState<string | null>(null)
  const [photosHaveMore, setPhotosHaveMore] = useState(false)
  const [relationship, setRelationship] = useState<ProfileRelationshipState>(EMPTY_RELATIONSHIP)
  const [relationshipLoading, setRelationshipLoading] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.id) return
    let active = true
    setPostsLoading(true)
    setPostsUnavailable(false)
    socialApi.getProfilePosts(profile.id, 12).then((page) => active && setPosts(page.items)).catch(() => active && setPostsUnavailable(true)).finally(() => active && setPostsLoading(false))
    return () => { active = false }
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.id || canEdit) {
      setRelationship(EMPTY_RELATIONSHIP)
      return
    }
    let active = true
    setRelationshipLoading(true)
    setActionError(null)
    socialApi.getProfileRelationshipState(viewerId, profile.id).then((state) => active && setRelationship(state)).catch(() => active && setActionError(t('relationshipLoadError'))).finally(() => active && setRelationshipLoading(false))
    return () => { active = false }
  }, [canEdit, profile?.id, t, viewerId])

  useEffect(() => {
    if (tab !== 'friends' || !canEdit) return
    let active = true
    setFriendsLoading(true)
    socialApi.getRelationProfiles(viewerId, 0, 100).then((items) => active && setProfileFriends(items)).catch(() => active && setActionError(t('friendsLoadError'))).finally(() => active && setFriendsLoading(false))
    return () => { active = false }
  }, [canEdit, t, tab, viewerId])

  const loadPhotos = useCallback(async (cursor: string | null = null, append = false) => {
    if (!profile?.id) return
    setPhotosLoading(true)
    if (!append) setPhotosUnavailable(false)
    try {
      const page = await socialApi.getUserPhotos(profile.id, 60, cursor)
      setPhotos((current) => append ? [...current, ...page.items] : page.items)
      setPhotoCursor(page.endCursor)
      setPhotosHaveMore(page.hasNextPage)
    } catch {
      if (!append) setPhotos([])
      setPhotosUnavailable(true)
    } finally {
      setPhotosLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    if (tab !== 'photos') return
    void loadPhotos()
  }, [loadPhotos, tab])

  async function friendAction(action: 'send' | 'cancel' | 'accept' | 'reject' | 'unfriend') {
    if (!profile) return
    setBusyAction(action)
    setActionError(null)
    try {
      const success = action === 'send'
        ? await socialApi.sendFriendRequest(viewerId, profile.id)
        : action === 'cancel'
          ? await socialApi.cancelFriendRequest(viewerId, profile.id)
          : action === 'accept'
            ? await socialApi.acceptFriendRequest(profile.id, viewerId)
            : action === 'reject'
              ? await socialApi.rejectFriendRequest(profile.id, viewerId)
              : await socialApi.unfriend(viewerId, profile.id)
      if (!success) throw new Error('Action rejected')
      setRelationship((current) => ({
        ...current,
        friendship: action === 'send' ? 'outgoing' : action === 'accept' ? 'friend' : 'none',
        isFollowing: action === 'accept' ? false : current.isFollowing,
      }))
    } catch {
      setActionError(t('friendActionError'))
    } finally {
      setBusyAction(null)
    }
  }

  async function followAction() {
    if (!profile) return
    const next = !relationship.isFollowing
    setBusyAction('follow')
    setActionError(null)
    try {
      const success = next
        ? await socialApi.followUser(viewerId, profile.id)
        : await socialApi.unfollowUser(viewerId, profile.id)
      if (!success) throw new Error('Action rejected')
      setRelationship((current) => ({ ...current, isFollowing: next }))
    } catch {
      setActionError(t('followActionError'))
    } finally {
      setBusyAction(null)
    }
  }

  async function messageAction() {
    if (!profile) return
    setBusyAction('message')
    setActionError(null)
    try {
      await onMessage(profile.id)
    } catch {
      setActionError(t('messageActionError'))
    } finally {
      setBusyAction(null)
    }
  }

  async function blockAction() {
    if (!profile) return
    const next = !relationship.isBlocked
    setBusyAction('block')
    setActionError(null)
    try {
      const success = next
        ? await socialApi.blockUser(viewerId, profile.id)
        : await socialApi.unblockUser(viewerId, profile.id)
      if (!success) throw new Error('Action rejected')
      setRelationship((current) => ({
        ...current,
        isBlocked: next,
        friendship: next ? 'none' : current.friendship,
        isFollowing: next ? false : current.isFollowing,
      }))
    } catch {
      setActionError(t('blockActionError'))
    } finally {
      setBusyAction(null)
    }
  }

  if (loading) return <main className="profile-destination"><div className="card state-card"><span className="spinner" /></div></main>
  if (!profile) return <main className="profile-destination"><div className="card state-card"><h2>{t('profileUnavailable')}</h2><p>{error || t('profileLoadError')}</p></div></main>

  return <main className="profile-destination">
    <section className="profile-cover-card">
      <div className="profile-cover" style={profile.backgroundUrl ? { backgroundImage: `url(${profile.backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />
      <div className="profile-destination-header">
        <Avatar name={profile.displayName} src={profile.avatarUrl} size={164} />
        <div className="profile-destination-title"><h1>{profile.displayName}<VerifiedBadge verified={profile.isVerified} size={20} /></h1><p>{profile.friendCount} {t('friends')} · {profile.followerCount} {t('followers')}</p>{!canEdit && relationship.followsViewer && <small>{t('followsYou')}</small>}</div>
        {canEdit ? <button type="button" className="btn-soft" onClick={onEdit}><Icon name="edit" size={17} />{t('editProfile')}</button> : <ProfileActions profile={profile} relationship={relationship} loading={relationshipLoading} busyAction={busyAction} onFriend={friendAction} onFollow={followAction} onBlock={blockAction} onMessage={messageAction} />}
      </div>
      {actionError && <p className="inline-alert profile-action-error">{actionError}</p>}
      <nav className="profile-tabs"><button type="button" className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>{t('postsLabel')}</button><button type="button" className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>{t('about')}</button><button type="button" className={tab === 'friends' ? 'active' : ''} onClick={() => setTab('friends')}>{t('friends')}</button><button type="button" className={tab === 'photos' ? 'active' : ''} onClick={() => setTab('photos')}>{t('photos')}</button></nav>
    </section>
    <div className="profile-destination-grid">
      <aside className="card profile-intro"><h2>{t('intro')}</h2>{profile.bio && <p>{profile.bio}</p>}{profile.location && <p><Icon name="location" size={18} />{t('livesIn', { location: profile.location })}</p>}<p><Icon name="friends" size={18} />{t('followingCount', { count: profile.followingCount })}</p>{canEdit && <button type="button" className="btn-soft block" onClick={onEdit}>{t('editDetails')}</button>}</aside>
      <section className="profile-post-list">
        {tab === 'posts' && (postsLoading ? <div className="card state-card"><span className="spinner" /></div> : posts.length > 0 ? posts.map((post) => <GatewayPostCard key={post.id} post={post} locale={locale} viewerId={viewerId} onNavigate={onNavigate} />) : <div className="card state-card"><h2>{postsUnavailable ? t('unableToLoad') : t('profileNoPosts')}</h2><p>{postsUnavailable ? t('profilePostsLoadError') : canEdit ? t('yourPostsEmpty') : t('userPostsEmpty', { name: profile.displayName.split(' ')[0] })}</p></div>)}
        {tab === 'about' && <div className="card profile-tab-card"><h2>{t('about')}</h2><dl><div><dt>{t('bio')}</dt><dd>{profile.bio || t('notAvailable')}</dd></div><div><dt>{t('location')}</dt><dd>{profile.location || t('notAvailable')}</dd></div><div><dt>{t('birthDate')}</dt><dd>{profile.birthDate || t('notAvailable')}</dd></div><div><dt>{t('createdAt')}</dt><dd>{profile.createdAt || t('notAvailable')}</dd></div></dl></div>}
        {tab === 'friends' && <div className="card profile-tab-card"><h2>{t('friends')}</h2>{!canEdit ? <p className="muted">{t('friendListPrivate')}</p> : friendsLoading ? <div className="state-card"><span className="spinner" /></div> : profileFriends.length === 0 ? <p className="muted">{t('friendListEmpty')}</p> : <div className="profile-friends-grid">{profileFriends.map((friend) => <button type="button" key={friend.id} onClick={() => onNavigate(`/profile/${friend.id}`)}><Avatar name={friend.displayName} src={friend.avatarUrl} size={48} /><strong>{friend.displayName}<VerifiedBadge verified={friend.isVerified} /></strong></button>)}</div>}</div>}
        {tab === 'photos' && <div className="card profile-tab-card"><h2>{t('photos')}</h2>{photosLoading && photos.length === 0 ? <div className="state-card"><span className="spinner" /></div> : photos.length === 0 ? <p className="muted">{photosUnavailable ? t('profileMediaLoadError') : t('photosEmpty')}</p> : <><div className="profile-photo-grid">{photos.map((photo) => <button type="button" key={`${photo.contentId}-${photo.media.id}`} onClick={() => onNavigate(`/content/${photo.contentId}`)}><img src={photo.media.url} alt="" loading="lazy" /></button>)}</div>{photosHaveMore && <button type="button" className="btn-soft load-more-result" disabled={photosLoading || !photoCursor} onClick={() => void loadPhotos(photoCursor, true)}>{photosLoading ? t('loadingMore') : t('seeMore')}</button>}</>}</div>}
      </section>
    </div>
  </main>
}

function ProfileActions({ profile, relationship, loading, busyAction, onFriend, onFollow, onBlock, onMessage }: { profile: SocialProfile; relationship: ProfileRelationshipState; loading: boolean; busyAction: string | null; onFriend: (action: 'send' | 'cancel' | 'accept' | 'reject' | 'unfriend') => void; onFollow: () => void; onBlock: () => void; onMessage: () => void }) {
  const { t } = useI18n()
  if (loading) return <div className="profile-relationship-actions"><span className="spinner" /></div>
  if (relationship.isBlockedBy) return <div className="profile-relationship-actions"><span className="role-pill muted-pill">{t('profileRestricted')}</span></div>
  const busy = busyAction != null
  return <div className="profile-relationship-actions">
    {!relationship.isBlocked && profile.privacy === 0 && relationship.friendship === 'none' && <button type="button" className="btn-primary" disabled={busy} onClick={() => onFriend('send')}><Icon name="userPlus" size={17} />{t('addFriend')}</button>}
    {!relationship.isBlocked && relationship.friendship === 'outgoing' && <button type="button" className="btn-soft" disabled={busy} onClick={() => onFriend('cancel')}><Icon name="clock" size={17} />{t('cancelRequest')}</button>}
    {!relationship.isBlocked && relationship.friendship === 'incoming' && <><button type="button" className="btn-primary" disabled={busy} onClick={() => onFriend('accept')}><Icon name="friends" size={17} />{t('confirm')}</button><button type="button" className="btn-soft" disabled={busy} onClick={() => onFriend('reject')}>{t('decline')}</button></>}
    {!relationship.isBlocked && relationship.friendship === 'friend' && <button type="button" className="btn-primary" disabled={busy} onClick={onMessage}><Icon name="messenger" size={17} />{t('messageUser')}</button>}
    {!relationship.isBlocked && relationship.friendship === 'friend' && <button type="button" className="btn-soft" disabled={busy} onClick={() => onFriend('unfriend')}><Icon name="friends" size={17} />{t('removeFriend')}</button>}
    {!relationship.isBlocked && relationship.friendship !== 'friend' && (profile.privacy !== 0 || relationship.isFollowing) && <button type="button" className={relationship.isFollowing ? 'btn-soft' : 'btn-primary'} disabled={busy} onClick={onFollow}><Icon name="friends" size={17} />{relationship.isFollowing ? t('unfollow') : t('follow')}</button>}
    <button type="button" className="btn-soft danger-text" disabled={busy} onClick={onBlock}><Icon name="lock" size={17} />{relationship.isBlocked ? t('unblock') : t('block')}</button>
  </div>
}
