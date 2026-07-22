import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import type { GatewayPost, GatewayStory, StoryBucket } from '../api/gatewayTypes'
import type { MediaUpload } from '../api/types'
import { socialApi, type ProfileRelationshipState, type SocialContent, type SocialPhoto, type SocialProfile } from '../api/social'
import { Avatar } from '../components/Avatar'
import { ImageCropModal } from '../components/ImageCropModal'
import { Icon } from '../components/Icon'
import { SharedStoryMiniPreview } from '../components/SharedStoryMiniPreview'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { decodePostContent, getPostBackgroundPreset } from '../lib/postContent'
import { readDefaultPostPrivacy } from '../lib/privacy'
import { decodeStoryContent } from '../lib/storyContent'
import { GatewayPostCard, PostComposer } from './GatewayHomePage'

const StoryViewerPage = lazy(() => import('../components/StoryViewerPage').then((module) => ({ default: module.StoryViewerPage })))
const StoryCreatorModal = lazy(() => import('../components/StoryCreatorModal').then((module) => ({ default: module.StoryCreatorModal })))

const EMPTY_RELATIONSHIP: ProfileRelationshipState = {
  friendship: 'none',
  isFollowing: false,
  followsViewer: false,
  isBlocked: false,
  isBlockedBy: false,
}

type ProfileTab = 'posts' | 'about' | 'friends' | 'photos' | 'reels'
type ProfilePostFilter = 'all' | 'media' | 'text'
type ProfilePostView = 'list' | 'grid'

function storyMedia(story: GatewayStory) {
  return story.__typename === 'NormalStory' ? story.media[0] ?? null : story.sharedSource.media
}

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
  const [reels, setReels] = useState<SocialContent[]>([])
  const [reelsLoading, setReelsLoading] = useState(false)
  const [myStories, setMyStories] = useState<StoryBucket | null>(null)
  const [storyCreatorOpen, setStoryCreatorOpen] = useState(false)
  const [storyViewerOpen, setStoryViewerOpen] = useState(false)
  const [postFilter, setPostFilter] = useState<ProfilePostFilter>('all')
  const [postView, setPostView] = useState<ProfilePostView>('list')
  const [manageMode, setManageMode] = useState(false)
  const [relationship, setRelationship] = useState<ProfileRelationshipState>(EMPTY_RELATIONSHIP)
  const [relationshipLoading, setRelationshipLoading] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [coverMenuOpen, setCoverMenuOpen] = useState(false)
  const [coverPickerOpen, setCoverPickerOpen] = useState(false)
  const [coverCandidates, setCoverCandidates] = useState<SocialPhoto[]>([])
  const [coverCandidatesLoading, setCoverCandidatesLoading] = useState(false)
  const [coverPickerError, setCoverPickerError] = useState<string | null>(null)
  const [coverCropTarget, setCoverCropTarget] = useState<{ file: File; fromExisting: boolean } | null>(null)
  const coverActionRef = useRef<HTMLDivElement>(null)
  const coverUploadInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTab('posts')
    setPostFilter('all')
    setPostView('list')
    setManageMode(false)
    setProfileFriends([])
    setPhotos([])
    setReels([])
    setMyStories(null)
    setCoverMenuOpen(false)
    setCoverPickerOpen(false)
    setCoverCandidates([])
    setCoverPickerError(null)
    setCoverCropTarget(null)
  }, [profile?.id])

  useEffect(() => {
    if (!coverMenuOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!coverActionRef.current?.contains(event.target as Node)) setCoverMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCoverMenuOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [coverMenuOpen])

  useEffect(() => {
    if (!profile?.id) return
    let active = true
    setPostsLoading(true)
    setPostsUnavailable(false)
    socialApi.getProfilePosts(profile.id, 20).then((page) => active && setPosts(page.items)).catch(() => active && setPostsUnavailable(true)).finally(() => active && setPostsLoading(false))
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
    if (!profile?.id || !canEdit) return
    let active = true
    setFriendsLoading(true)
    socialApi.getRelationProfiles(profile.id, 0, 100).then((items) => active && setProfileFriends(items)).catch(() => active && setActionError(t('friendsLoadError'))).finally(() => active && setFriendsLoading(false))
    return () => { active = false }
  }, [canEdit, profile?.id, t])

  const loadPhotos = useCallback(async (cursor: string | null = null, append = false, limit = 60) => {
    if (!profile?.id) return
    setPhotosLoading(true)
    if (!append) setPhotosUnavailable(false)
    try {
      const page = await socialApi.getUserPhotos(profile.id, limit, cursor)
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
    if (!canEdit || tab === 'photos' || photos.length > 0) return
    void loadPhotos(null, false, 9)
  }, [canEdit, loadPhotos, photos.length, tab])

  useEffect(() => {
    if (tab !== 'photos') return
    void loadPhotos(null, false, 60)
  }, [loadPhotos, tab])

  useEffect(() => {
    if (tab !== 'reels' || !profile?.id) return
    let active = true
    setReelsLoading(true)
    socialApi.getProfileReels(profile.id, 30).then((page) => active && setReels(page.items)).catch(() => active && setReels([])).finally(() => active && setReelsLoading(false))
    return () => { active = false }
  }, [profile?.id, tab])

  useEffect(() => {
    if (!canEdit || !profile?.id) {
      setMyStories(null)
      return
    }
    let active = true
    api.myStories(profile.id).then((bucket) => active && setMyStories(bucket)).catch(() => active && setMyStories(null))
    return () => { active = false }
  }, [canEdit, profile?.id])

  const filteredPosts = useMemo(() => posts.filter((post) => {
    const sharedMedia = post.__typename === 'FeedPostDetail' ? post.sharedSource?.media ?? [] : []
    const hasMedia = post.media.length > 0 || sharedMedia.length > 0
    return postFilter === 'all' || (postFilter === 'media' ? hasMedia : !hasMedia)
  }), [postFilter, posts])

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

  async function openCoverPicker() {
    if (!profile) return
    setCoverMenuOpen(false)
    setCoverPickerOpen(true)
    setCoverCandidatesLoading(true)
    setCoverPickerError(null)
    try {
      const page = await socialApi.getMyFeedPhotoCandidates(60)
      setCoverCandidates(page.items)
    } catch {
      setCoverCandidates([])
      setCoverPickerError(t('profileMediaLoadError'))
    } finally {
      setCoverCandidatesLoading(false)
    }
  }

  async function chooseExistingCover(photo: SocialPhoto) {
    setCoverPickerError(null)
    try {
      const response = await fetch(photo.media.url, { credentials: 'include' })
      if (!response.ok) throw new Error('Could not fetch media')
      const blob = await response.blob()
      const extension = blob.type.split('/')[1] || 'jpg'
      setCoverCropTarget({ file: new File([blob], `fakebook-cover.${extension}`, { type: blob.type || 'image/jpeg' }), fromExisting: true })
      setCoverPickerOpen(false)
    } catch {
      setCoverPickerError(t('existingPhotoLoadError'))
    }
  }

  async function saveCroppedCover(original: File, cropped: File) {
    if (!profile || !coverCropTarget) return
    let uploads: MediaUpload[] = []
    let persisted = false
    try {
      uploads = await api.uploadMediaFiles(coverCropTarget.fromExisting ? [cropped] : [original, cropped])
      const originalUpload = coverCropTarget.fromExisting ? null : uploads[0]
      const croppedUpload = uploads[uploads.length - 1]
      const updated = await socialApi.changeUserBackground(profile.id, croppedUpload.url, originalUpload?.url ?? null, readDefaultPostPrivacy(profile.id))
      if (!updated) throw new Error('Profile cover update failed')
      persisted = true
      setCoverCropTarget(null)
      setActionError(null)
      window.dispatchEvent(new CustomEvent('fakebook:profile-updated', { detail: updated }))
    } catch (error) {
      if (!persisted) await Promise.allSettled(uploads.map((item) => api.cancelPendingMedia(item)))
      throw error
    }
  }

  if (loading) return <main className="profile-destination"><div className="card state-card"><span className="spinner" /></div></main>
  if (!profile) return <main className="profile-destination"><div className="card state-card"><h2>{t('profileUnavailable')}</h2><p>{error || t('profileLoadError')}</p></div></main>

  const coverStyle = profile.backgroundUrl ? { backgroundImage: `url(${profile.backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined
  const selfProfileStats = canEdit ? [
    { id: 'friends', count: profile.friendCount, label: t('profileFriendStat', { count: profile.friendCount }) },
    { id: 'followers', count: profile.followerCount, label: t('profileFollowerStat', { count: profile.followerCount }) },
    { id: 'following', count: profile.followingCount, label: t('profileFollowingStat', { count: profile.followingCount }) },
  ].filter((item) => item.count > 0) : []

  return <>
    <main className={canEdit ? 'profile-destination self-profile-page' : 'profile-destination'}>
      <section className={canEdit ? 'profile-cover-card self-profile-cover-card' : 'profile-cover-card'}>
        {canEdit && <div className="self-profile-cover-ambient" style={coverStyle} aria-hidden="true" />}
        <div className={canEdit ? 'self-profile-header-shell' : undefined}>
          <div className="profile-cover" style={coverStyle}>
            {canEdit && <div className="self-profile-cover-action" ref={coverActionRef}>
              <button type="button" className="self-profile-edit-cover" aria-haspopup="menu" aria-expanded={coverMenuOpen} onClick={() => setCoverMenuOpen((open) => !open)}><ProfileCoverCameraIcon />{t(profile.backgroundUrl ? 'profileEditCover' : 'profileAddCover')}</button>
              {coverMenuOpen && <div className="self-profile-cover-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => void openCoverPicker()}><ProfileCoverPhotoIcon />{t('profileChooseCover')}</button>
                <button type="button" role="menuitem" onClick={() => { setCoverMenuOpen(false); coverUploadInputRef.current?.click() }}><ProfileCoverUploadIcon />{t('profileUploadCover')}</button>
              </div>}
              <input ref={coverUploadInputRef} className="self-profile-cover-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  setCoverMenuOpen(false)
                  setCoverCropTarget({ file, fromExisting: false })
                }
                event.currentTarget.value = ''
              }} />
            </div>}
          </div>
          <div className="profile-destination-header">
            {canEdit ? <div className={myStories?.stories.length ? 'self-profile-avatar-wrap has-story' : 'self-profile-avatar-wrap no-story'}><Avatar name={profile.displayName} src={profile.avatarUrl} size={138} /><button type="button" aria-label={t('profileEditAvatar')} onClick={onEdit}><ProfileCoverCameraIcon /></button></div> : <Avatar name={profile.displayName} src={profile.avatarUrl} size={164} />}
            <div className="profile-destination-title">
              <h1>{profile.displayName}<VerifiedBadge verified={profile.isVerified} size={canEdit ? 17 : 20} /></h1>
              {canEdit ? <div className="self-profile-summary-copy">
                {selfProfileStats.length > 0 && <div className="self-profile-summary-line self-profile-stats">{selfProfileStats.map((item) => <span key={item.id}>{item.label}</span>)}</div>}
                {profile.bio && <p className="self-profile-summary-line self-profile-detail-line"><Icon name="info" size={15} /><span>{profile.bio}</span></p>}
                {profile.location && <p className="self-profile-summary-line self-profile-detail-line"><Icon name="location" size={15} /><span>{profile.location}</span></p>}
              </div> : <><p>{profile.friendCount} {t('friends')} · {profile.followerCount} {t('followers')}</p>{relationship.followsViewer && <small>{t('followsYou')}</small>}</>}
            </div>
            {canEdit ? <div className="self-profile-header-actions">
              <button type="button" className="btn-primary" onClick={() => setStoryCreatorOpen(true)}><ProfileAddStoryIcon />{t('profileAddStory')}</button>
              <button type="button" className="btn-soft" onClick={onEdit}><Icon name="edit" size={17} />{t('profileEditPage')}</button>
            </div> : <ProfileActions profile={profile} relationship={relationship} loading={relationshipLoading} busyAction={busyAction} onFriend={friendAction} onFollow={followAction} onBlock={blockAction} onMessage={messageAction} />}
          </div>
          {actionError && <p className="inline-alert profile-action-error">{actionError}</p>}
          <nav className="profile-tabs">
            <button type="button" className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>{t('postsLabel')}</button>
            <button type="button" className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>{t('about')}</button>
            <button type="button" className={tab === 'friends' ? 'active' : ''} onClick={() => setTab('friends')}>{t('friends')}</button>
            <button type="button" className={tab === 'photos' ? 'active' : ''} onClick={() => setTab('photos')}>{t('photos')}</button>
            {canEdit && <button type="button" className={tab === 'reels' ? 'active' : ''} onClick={() => setTab('reels')}>{t('reels')}</button>}
            {canEdit && <details className="self-profile-more-tabs"><summary>{t('profileSeeMore')}<Icon name="caret" size={15} /></summary><div><button type="button" onClick={() => onNavigate('/saved')}><Icon name="bookmark" size={17} />{t('saved')}</button><button type="button" onClick={onEdit}><Icon name="settings" size={17} />{t('editProfile')}</button></div></details>}
            {canEdit && <details className="self-profile-tab-menu"><summary aria-label={t('more')}><Icon name="more" size={20} /></summary><div><button type="button" onClick={onEdit}><Icon name="edit" size={17} />{t('profileEditPage')}</button><button type="button" onClick={() => onNavigate('/saved')}><Icon name="bookmark" size={17} />{t('saved')}</button></div></details>}
          </nav>
        </div>
      </section>

      <div className={`profile-destination-grid${canEdit ? ` self-profile-destination-grid tab-${tab}` : ''}`}>
        {canEdit && tab === 'posts' ? <aside className="self-profile-left-column">
          <section className="card self-profile-side-card self-profile-intro-card">
            <div className="self-profile-info-section"><header><h2>{t('profilePersonalInfo')}</h2><button type="button" aria-label={t('editDetails')} onClick={onEdit}><Icon name="edit" size={18} /></button></header>{profile.location && <p><Icon name="location" size={22} />{t('livesIn', { location: profile.location })}</p>}{profile.birthDate && <p><Icon name="gift" size={21} />{t('profileBornOn', { date: profile.birthDate })}</p>}<p><Icon name="friends" size={21} />{t('followingCount', { count: profile.followingCount })}</p></div>
            <div className="self-profile-info-section"><header><h2>{t('profileContactInfo')}</h2><button type="button" aria-label={t('editDetails')} onClick={onEdit}><Icon name="edit" size={18} /></button></header><p><Icon name="user" size={22} />@{profile.username}</p></div>
          </section>

          <section className="card self-profile-side-card self-profile-featured-card">
            <header><h2>{t('profileFeatured')}</h2></header>
            {myStories?.stories.length ? <div className="self-profile-featured-list">{myStories.stories.slice(0, 3).map((story) => <ProfileStoryTile key={story.id} story={story} onOpen={() => setStoryViewerOpen(true)} />)}</div> : <button type="button" className="self-profile-featured-empty" onClick={() => setStoryCreatorOpen(true)}><span><Icon name="plus" size={22} /></span><strong>{t('profileAddStory')}</strong><small>{t('profileNoFeatured')}</small></button>}
          </section>

          <section className="card self-profile-side-card self-profile-friends-card">
            <header><div><h2>{t('friends')}</h2><small>{profile.friendCount} {t('friends')}</small></div><button type="button" onClick={() => setTab('friends')}>{t('profileViewAllFriends')}</button></header>
            {friendsLoading ? <div className="self-profile-side-loading"><span className="spinner" /></div> : <div className="self-profile-friend-preview">{profileFriends.slice(0, 9).map((friend) => <button type="button" key={friend.id} onClick={() => onNavigate(`/profile/${friend.id}`)}><Avatar name={friend.displayName} src={friend.avatarUrl} size={96} /><strong>{friend.displayName}</strong></button>)}</div>}
          </section>

          <section className="card self-profile-side-card self-profile-photos-card">
            <header><h2>{t('photos')}</h2><button type="button" onClick={() => setTab('photos')}>{t('profileSeeAllPhotos')}</button></header>
            {photosLoading && photos.length === 0 ? <div className="self-profile-side-loading"><span className="spinner" /></div> : <div className="self-profile-photo-preview">{photos.slice(0, 9).map((photo) => <button type="button" key={`${photo.contentId}-${photo.media.id}`} onClick={() => onNavigate(`/content/${photo.contentId}`)}><img src={photo.media.url} alt="" loading="lazy" /></button>)}</div>}
          </section>
        </aside> : !canEdit && <aside className="card profile-intro"><h2>{t('intro')}</h2>{profile.bio && <p>{profile.bio}</p>}{profile.location && <p><Icon name="location" size={18} />{t('livesIn', { location: profile.location })}</p>}<p><Icon name="friends" size={18} />{t('followingCount', { count: profile.followingCount })}</p></aside>}

        <section className="profile-post-list">
          {tab === 'posts' && canEdit && <PostComposer variant="profile" userId={profile.id} displayName={profile.displayName} avatarUrl={profile.avatarUrl} isVerified={profile.isVerified} friends={profileFriends} onCreated={(post) => setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])} />}
          {tab === 'posts' && canEdit && <section className="card self-profile-post-tools">
            <header><h2>{t('profilePostsTitle')}</h2><div><details><summary><Icon name="settings" size={16} />{t('profilePostFilters')}</summary><div>{(['all', 'media', 'text'] as ProfilePostFilter[]).map((filter) => <button type="button" key={filter} className={postFilter === filter ? 'active' : ''} onClick={() => setPostFilter(filter)}>{t(filter === 'all' ? 'profileAllPosts' : filter === 'media' ? 'profileMediaPosts' : 'profileTextPosts')}</button>)}</div></details><button type="button" className={manageMode ? 'active' : ''} onClick={() => setManageMode((value) => !value)}><Icon name="settings" size={16} />{t(manageMode ? 'done' : 'profileManagePosts')}</button></div></header>
            {manageMode && <p>{t('profileManagePostsHint')}</p>}
            <div className="self-profile-post-view-tabs"><button type="button" className={postView === 'list' ? 'active' : ''} onClick={() => setPostView('list')}><Icon name="menu" size={16} />{t('profileListView')}</button><button type="button" className={postView === 'grid' ? 'active' : ''} onClick={() => setPostView('grid')}><Icon name="menu" size={16} />{t('profileGridView')}</button></div>
          </section>}

          {tab === 'posts' && (postsLoading ? <div className="card state-card"><span className="spinner" /></div> : filteredPosts.length > 0 ? postView === 'grid' && canEdit ? <div className="self-profile-post-grid">{filteredPosts.map((post) => <ProfilePostGridCard key={post.id} post={post} onOpen={() => onNavigate(`/content/${post.id}`)} />)}</div> : filteredPosts.map((post) => <GatewayPostCard key={post.id} post={post} locale={locale} viewerId={viewerId} onNavigate={onNavigate} />) : <div className="card state-card"><h2>{postsUnavailable ? t('unableToLoad') : t('profileNoPosts')}</h2><p>{postsUnavailable ? t('profilePostsLoadError') : canEdit ? t('yourPostsEmpty') : t('userPostsEmpty', { name: profile.displayName.split(' ')[0] })}</p></div>)}
          {tab === 'about' && <div className="card profile-tab-card"><h2>{t('about')}</h2><dl><div><dt>{t('bio')}</dt><dd>{profile.bio || t('notAvailable')}</dd></div><div><dt>{t('location')}</dt><dd>{profile.location || t('notAvailable')}</dd></div><div><dt>{t('birthDate')}</dt><dd>{profile.birthDate || t('notAvailable')}</dd></div><div><dt>{t('createdAt')}</dt><dd>{profile.createdAt || t('notAvailable')}</dd></div></dl></div>}
          {tab === 'friends' && <div className="card profile-tab-card"><h2>{t('friends')}</h2>{!canEdit ? <p className="muted">{t('friendListPrivate')}</p> : friendsLoading ? <div className="state-card"><span className="spinner" /></div> : profileFriends.length === 0 ? <p className="muted">{t('friendListEmpty')}</p> : <div className="profile-friends-grid">{profileFriends.map((friend) => <button type="button" key={friend.id} onClick={() => onNavigate(`/profile/${friend.id}`)}><Avatar name={friend.displayName} src={friend.avatarUrl} size={48} /><strong>{friend.displayName}<VerifiedBadge verified={friend.isVerified} /></strong></button>)}</div>}</div>}
          {tab === 'photos' && <div className="card profile-tab-card"><h2>{t('photos')}</h2>{photosLoading && photos.length === 0 ? <div className="state-card"><span className="spinner" /></div> : photos.length === 0 ? <p className="muted">{photosUnavailable ? t('profileMediaLoadError') : t('photosEmpty')}</p> : <><div className="profile-photo-grid">{photos.map((photo) => <button type="button" key={`${photo.contentId}-${photo.media.id}`} onClick={() => onNavigate(`/content/${photo.contentId}`)}><img src={photo.media.url} alt="" loading="lazy" /></button>)}</div>{photosHaveMore && <button type="button" className="btn-soft load-more-result" disabled={photosLoading || !photoCursor} onClick={() => void loadPhotos(photoCursor, true)}>{photosLoading ? t('loadingMore') : t('seeMore')}</button>}</>}</div>}
          {tab === 'reels' && <div className="card profile-tab-card"><h2>{t('reels')}</h2>{reelsLoading ? <div className="state-card"><span className="spinner" /></div> : reels.length === 0 ? <p className="muted">{t('profileNoReels')}</p> : <div className="self-profile-reel-grid">{reels.map((reel) => <button type="button" key={reel.id} onClick={() => onNavigate(`/content/${reel.id}`)}>{reel.media[0]?.type === 1 ? <video src={reel.media[0].url} muted playsInline preload="metadata" /> : reel.media[0] ? <img src={reel.media[0].url} alt="" loading="lazy" /> : <span>{decodePostContent(reel.content).text}</span>}<i><Icon name="play" size={18} /></i></button>)}</div>}</div>}
        </section>
      </div>
    </main>

    {canEdit && storyCreatorOpen && <Suspense fallback={<div className="modal-backdrop"><span className="spinner" /></div>}><StoryCreatorModal open authorId={profile.id} onClose={() => setStoryCreatorOpen(false)} onCreated={(story) => {
      setMyStories((current) => ({
        author: { id: profile.id, name: profile.displayName, avatar: profile.avatarUrl ?? '', isVerified: Boolean(profile.isVerified) },
        latestCreate: story.create,
        hasUnseen: true,
        unseenCount: Math.max(1, (current?.unseenCount ?? 0) + 1),
        stories: [story, ...(current?.stories ?? []).filter((item) => item.id !== story.id)],
      }))
    }} /></Suspense>}
    {canEdit && storyViewerOpen && myStories && <Suspense fallback={<div className="story-viewer-backdrop"><span className="spinner" /></div>}><StoryViewerPage buckets={[myStories]} initialBucketId={profile.id} viewerId={viewerId} onClose={() => setStoryViewerOpen(false)} onNavigate={onNavigate} onCreateStory={() => { setStoryViewerOpen(false); setStoryCreatorOpen(true) }} onStoryDeleted={(storyId) => setMyStories((current) => {
      if (!current) return null
      const stories = current.stories.filter((story) => story.id !== storyId)
      return stories.length ? { ...current, stories, latestCreate: stories[0].create } : null
    })} /></Suspense>}
    {canEdit && coverPickerOpen && <ProfileCoverPhotoPicker images={coverCandidates} loading={coverCandidatesLoading} error={coverPickerError} onClose={() => setCoverPickerOpen(false)} onSelect={(photo) => void chooseExistingCover(photo)} />}
    {canEdit && coverCropTarget && <ImageCropModal file={coverCropTarget.file} kind="background" onClose={() => setCoverCropTarget(null)} onConfirm={saveCroppedCover} />}
  </>
}

function ProfileCoverCameraIcon() {
  return <svg className="self-profile-cover-camera-icon" width="19" height="19" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M8.25 4.1h7.5l1.65 2H20a2.4 2.4 0 0 1 2.4 2.4v9.1A2.4 2.4 0 0 1 20 20H4a2.4 2.4 0 0 1-2.4-2.4V8.5A2.4 2.4 0 0 1 4 6.1h2.6l1.65-2Z" fill="currentColor" />
    <circle cx="12" cy="13" r="4.7" fill="var(--profile-camera-lens, #fff)" />
    <circle cx="12" cy="13" r="2.65" fill="currentColor" />
  </svg>
}

function ProfileCoverPhotoIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="3.25" y="2.75" width="17.5" height="18.5" rx="2.4" /><circle cx="8.25" cy="8" r="1.35" /><path d="m5.6 18 4.2-4.55 2.7 2.55 2.45-2.75 3.45 4.75" /></svg>
}

function ProfileCoverUploadIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 15V3m0 0L7.8 7.25M12 3l4.2 4.25" /><path d="M4 14.5v4.25A2.25 2.25 0 0 0 6.25 21h11.5A2.25 2.25 0 0 0 20 18.75V14.5" /></svg>
}

function ProfileAddStoryIcon() {
  return <svg className="self-profile-add-story-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" /></svg>
}

function ProfileCoverPhotoPicker({ images, loading, error, onClose, onSelect }: { images: SocialPhoto[]; loading: boolean; error: string | null; onClose: () => void; onSelect: (photo: SocialPhoto) => void }) {
  const { t } = useI18n()
  return <div className="modal-backdrop existing-photo-backdrop" role="presentation" onClick={onClose}><section className="modal existing-photo-modal" role="dialog" aria-modal="true" aria-label={t('profileChooseCover')} onClick={(event) => event.stopPropagation()}><header className="modal-head"><div><h2>{t('profileChooseCover')}</h2><p>{t('chooseBackgroundPhotoDesc')}</p></div><button type="button" className="icon-circle subtle" aria-label={t('close')} onClick={onClose}><Icon name="close" /></button></header>{loading ? <div className="settings-loading"><span className="spinner" /></div> : error ? <p className="form-error existing-photo-state">{error}</p> : images.length > 0 ? <div className="existing-photo-grid">{images.map((photo) => <button type="button" key={`${photo.contentId}-${photo.media.id}`} onClick={() => onSelect(photo)}><img src={photo.media.url} alt="" loading="lazy" /></button>)}</div> : <p className="muted existing-photo-state">{t('photosEmpty')}</p>}</section></div>
}

function ProfileStoryTile({ story, onOpen }: { story: GatewayStory; onOpen: () => void }) {
  const media = storyMedia(story)
  const decoded = story.__typename === 'NormalStory' ? decodeStoryContent(story.content) : null
  return <button type="button" onClick={onOpen}>
    {story.__typename !== 'NormalStory'
      ? <SharedStoryMiniPreview source={story.sharedSource} />
      : media
        ? media.type === 1 ? <video src={media.url} muted playsInline preload="metadata" /> : <img src={media.url} alt="" loading="lazy" />
        : <span style={{ backgroundColor: decoded?.backgroundColor }}>{decoded?.text}</span>}
  </button>
}

function ProfilePostGridCard({ post, onOpen }: { post: GatewayPost; onOpen: () => void }) {
  const decoded = decodePostContent(post.content)
  const background = post.media.length === 0 ? getPostBackgroundPreset(decoded.backgroundId) : null
  const sharedMedia = post.__typename === 'FeedPostDetail' ? post.sharedSource?.media[0] ?? null : null
  const media = post.media[0] ?? sharedMedia
  return <button type="button" onClick={onOpen}>
    {media ? media.type === 1 ? <video src={media.url} muted playsInline preload="metadata" /> : <img src={media.url} alt="" loading="lazy" /> : <span style={background ? { background: background.background } : undefined}>{decoded.text}</span>}
    <small>{post.create}</small>
  </button>
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
