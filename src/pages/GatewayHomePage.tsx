import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api, visibleRecommendationPosts } from '../api/client'
import type { GatewayPost, GatewayStory, StoryBucket, VisitedGroup } from '../api/gatewayTypes'
import { socialApi, type ContentEngagement, type SocialProfile } from '../api/social'
import type { MediaUpload, UserProfile, UserSummary } from '../api/types'
import { Avatar } from '../components/Avatar'
import { GroupPostAvatar } from '../components/GroupPostAvatar'
import { MentionSuggestions } from '../components/MentionSuggestions'
import { Icon } from '../components/Icon'
import { PostMediaGallery } from '../components/PostMediaGallery'
import { PostOptionsMenu } from '../components/PostOptionsMenu'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { readDefaultPostPrivacy } from '../lib/privacy'

const FEED_PAGE_SIZE = 12
const TagPeoplePicker = lazy(() => import('../components/TagPeoplePicker'))
const ComposerMediaPreview = lazy(() => import('../components/ComposerMediaPreview'))
const StoryCreatorModal = lazy(() => import('../components/StoryCreatorModal'))
const ContentActions = lazy(() => import('../components/ContentActions').then((module) => ({ default: module.ContentActions })))

function mediaType(type: 'image' | 'video') {
  return type === 'video' ? 1 : 0
}

export function GatewayHomePage({ profile = null, onNavigate, onMessage }: { profile?: UserProfile | null; onNavigate?: (path: string) => void; onMessage?: (profileId: string) => Promise<void> }) {
  const { user } = useAuth()
  const { t, locale } = useI18n()
  const [posts, setPosts] = useState<GatewayPost[]>([])
  const [feedOffset, setFeedOffset] = useState(0)
  const [feedLoading, setFeedLoading] = useState(true)
  const [feedMoreBusy, setFeedMoreBusy] = useState(false)
  const [feedHasMore, setFeedHasMore] = useState(true)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [storyBuckets, setStoryBuckets] = useState<StoryBucket[]>([])
  const [myStories, setMyStories] = useState<StoryBucket | null>(null)
  const [storiesLoading, setStoriesLoading] = useState(true)
  const [storiesError, setStoriesError] = useState<string | null>(null)
  const [groups, setGroups] = useState<VisitedGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [groupsError, setGroupsError] = useState<string | null>(null)
  const [contacts, setContacts] = useState<SocialProfile[]>([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [contactSearchOpen, setContactSearchOpen] = useState(false)
  const [contactQuery, setContactQuery] = useState('')
  const locallyCreatedPostIds = useRef(new Set<string>())

  const loadFeed = useCallback(async (reset = false) => {
    if (!user) return
    if (reset) setFeedLoading(true)
    else setFeedMoreBusy(true)
    setFeedError(null)
    try {
      const offset = reset ? 0 : feedOffset
      const items = await api.recommendedFeed(user.userId, offset, FEED_PAGE_SIZE)
      const nextPosts = visibleRecommendationPosts(items)
      setPosts((current) => {
        const localPosts = reset ? current.filter((post) => locallyCreatedPostIds.current.has(post.id)) : current
        const combined = reset ? [...localPosts, ...nextPosts] : [...current, ...nextPosts]
        return [...new Map(combined.map((post) => [post.id, post])).values()]
      })
      setFeedOffset(offset + items.length)
      setFeedHasMore(items.length === FEED_PAGE_SIZE)
    } catch {
      setFeedError(t('feedLoadError'))
    } finally {
      setFeedLoading(false)
      setFeedMoreBusy(false)
    }
  }, [feedOffset, t, user])

  const loadStories = useCallback(async () => {
    if (!user) return
    setStoriesLoading(true)
    setStoriesError(null)
    try {
      const [home, mine] = await Promise.all([
        api.homeStories(user.userId, 16),
        api.myStories(user.userId),
      ])
      setStoryBuckets(home.items)
      setMyStories(mine)
    } catch {
      setStoriesError(t('storiesLoadError'))
    } finally {
      setStoriesLoading(false)
    }
  }, [t, user])

  const loadGroups = useCallback(async () => {
    if (!user) return
    setGroupsLoading(true)
    setGroupsError(null)
    try {
      setGroups((await api.visitedGroups(user.userId, 8)).items)
    } catch {
      setGroupsError(t('genericError'))
    } finally {
      setGroupsLoading(false)
    }
  }, [t, user])

  const loadContacts = useCallback(async () => {
    if (!user) return
    setContactsLoading(true)
    try { setContacts(await socialApi.getRelationProfiles(user.userId, 0, 40)) } catch { setContacts([]) } finally { setContactsLoading(false) }
  }, [user])

  useEffect(() => {
    void loadFeed(true)
    void loadStories()
    void loadGroups()
    void loadContacts()
    // Initial load is tied to the authenticated identity; pagination invokes loadFeed directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId])

  const visibleContacts = useMemo(() => {
    const query = contactQuery.trim().toLocaleLowerCase()
    return query ? contacts.filter((contact) => contact.displayName.toLocaleLowerCase().includes(query)) : contacts
  }, [contactQuery, contacts])

  if (!user) return null

  async function openGroup(group: VisitedGroup) {
    if (!user) return
    try {
      await api.recordGroupVisit(user.userId, group.id)
      onNavigate?.(`/groups/${group.id}`)
    } catch {
      setGroupsError(t('genericError'))
    }
  }

  return (
    <main className="gateway-home">
      <aside className="gateway-left-rail" aria-label={t('visitedGroups')}>
        <nav className="home-shortcuts" aria-label={t('primaryNavLabel')}>
          <button type="button" onClick={() => onNavigate?.(`/profile/${user.userId}`)}><Avatar name={profile?.displayName || user.email} src={profile?.avatarUrl} size={36} /><strong>{profile?.displayName || user.email.split('@')[0]}<VerifiedBadge verified={profile?.isVerified} size={13} /></strong></button>
          <button type="button" onClick={() => onNavigate?.('/saved')}><span className="shortcut-icon saved"><Icon name="bookmark" size={20} /></span><strong>{t('saved')}</strong></button>
          <button type="button" onClick={() => onNavigate?.('/friends')}><span className="shortcut-icon friends"><Icon name="friends" size={20} /></span><strong>{t('friends')}</strong></button>
          <button type="button" onClick={() => onNavigate?.('/reels')}><span className="shortcut-icon reels"><Icon name="watch" size={20} /></span><strong>{t('reels')}</strong></button>
          <button type="button" onClick={() => onNavigate?.('/groups')}><span className="shortcut-icon groups"><Icon name="groups" size={20} /></span><strong>{t('groups')}</strong></button>
        </nav>
        <section className="card service-panel">
          <div className="service-heading">
            <div><h2>{t('visitedGroups')}</h2><p>{t('visitedGroupsSubtitle')}</p></div>
            <button type="button" className="btn-soft sm" onClick={() => void loadGroups()} disabled={groupsLoading}>{t('refresh')}</button>
          </div>
          {groupsError && <p className="form-error">{groupsError}</p>}
          {groupsLoading ? <span className="spinner" aria-label={t('loadingMore')} /> : groups.length === 0 ? (
            <p className="muted">{t('noVisitedGroups')}</p>
          ) : (
            <div className="group-shortcuts">
              {groups.map((group) => (
                <button type="button" key={group.id} onClick={() => void openGroup(group)}>
                  <Avatar name={group.name} src={group.avatar || null} size={38} />
                  <span>{group.name}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </aside>

      <div className="gateway-feed-column">
        <PostComposer
          userId={user.userId}
          displayName={profile?.displayName || user.email.split('@')[0]}
          avatarUrl={profile?.avatarUrl || null}
          isVerified={profile?.isVerified}
          friends={contacts}
          onCreated={(post) => {
            locallyCreatedPostIds.current.add(post.id)
            setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])
          }}
        />
        <StorySection
          buckets={storyBuckets}
          myStories={myStories}
          loading={storiesLoading}
          error={storiesError}
          userId={user.userId}
          profile={profile}
          onReload={loadStories}
          onStoryCreated={(story) => {
            setMyStories((current) => ({
              author: current?.author ?? {
                id: user.userId,
                name: profile?.displayName || user.email.split('@')[0],
                avatar: profile?.avatarUrl || '',
                isVerified: Boolean(profile?.isVerified),
              },
              latestCreate: story.create,
              hasUnseen: true,
              stories: [story, ...(current?.stories ?? []).filter((item) => item.id !== story.id)],
            }))
            setStoryBuckets((current) => current.filter((bucket) => bucket.author.id !== user.userId))
          }}
          onNavigate={onNavigate}
        />

        <section className="feed-section" aria-labelledby="recommended-feed-title">
          <div className="feed-heading">
            <div>
              <h1 id="recommended-feed-title">{t('recommendedFeed')}</h1>
              <p>{t('recommendedFeedSubtitle')}</p>
            </div>
            <button type="button" className="btn-soft sm" onClick={() => void loadFeed(true)} disabled={feedLoading}>{t('refresh')}</button>
          </div>
          {feedError && <div className="card state-card"><p className="form-error">{feedError}</p><button type="button" className="btn-primary" onClick={() => void loadFeed(true)}>{t('tryAgain')}</button></div>}
          {feedLoading ? <div className="card state-card"><span className="spinner" /><p>{t('loadingMore')}</p></div> : !feedError && posts.length === 0 ? (
            <div className="card state-card"><h2>{t('noRecommendedPosts')}</h2><p>{t('noRecommendedPostsDesc')}</p></div>
          ) : (
            posts.map((post) => <GatewayPostCard key={post.id} post={post} locale={locale} viewerId={user.userId} onNavigate={onNavigate} onMessage={onMessage} />)
          )}
          {!feedLoading && !feedError && posts.length > 0 && (
            <div className="feed-more">
              {feedHasMore ? (
                <button type="button" className="btn-soft" onClick={() => void loadFeed(false)} disabled={feedMoreBusy}>
                  {feedMoreBusy ? t('loadingMore') : t('loadMorePosts')}
                </button>
              ) : <p className="muted">{t('endOfFeed')}</p>}
            </div>
          )}
        </section>
      </div>

      <aside className="gateway-right-rail" aria-label={t('contacts')}>
        <section className="right-rail-module contacts-module">
          <header><h2>{t('contacts')}</h2><div><button type="button" aria-label={t('search')} onClick={() => setContactSearchOpen((open) => !open)}><Icon name="search" size={17} /></button><button type="button" aria-label={t('more')} onClick={() => onNavigate?.('/friends')}><Icon name="more" size={17} /></button></div></header>
          {contactSearchOpen && <input className="contact-search" autoFocus value={contactQuery} onChange={(event) => setContactQuery(event.target.value)} placeholder={t('searchFriends')} />}
          {contactsLoading ? <span className="spinner" /> : visibleContacts.length === 0 ? <p>{contactQuery ? t('noFriendsFound') : t('noContactsYet')}</p> : <div className="contact-list">{visibleContacts.map((contact) => <button type="button" key={contact.id} onClick={() => onMessage ? void onMessage(contact.id) : onNavigate?.(`/profile/${contact.id}`)}><span className="contact-avatar"><Avatar name={contact.displayName} src={contact.avatarUrl} size={34} /></span><strong>{contact.displayName}<VerifiedBadge verified={contact.isVerified} size={12} /></strong></button>)}</div>}
        </section>
      </aside>
    </main>
  )
}

interface ComposerMediaFile {
  file: File
  previewUrl: string
}

function fileIdentity(file: File) {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`
}

function createFilePreview(file: File) {
  try {
    return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : ''
  } catch {
    return ''
  }
}

function revokeFilePreviews(items: ComposerMediaFile[]) {
  if (typeof URL.revokeObjectURL !== 'function') return
  items.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  })
}

function PostComposer({ userId, displayName, avatarUrl, isVerified, friends, onCreated }: { userId: string; displayName: string; avatarUrl: string | null; isVerified?: boolean; friends: UserSummary[]; onCreated: (post: GatewayPost) => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [privacy, setPrivacy] = useState(() => readDefaultPostPrivacy(userId))
  const [selectedFiles, setSelectedFiles] = useState<ComposerMediaFile[]>([])
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [taggedPeople, setTaggedPeople] = useState<UserSummary[]>([])
  const [mentionedPeople, setMentionedPeople] = useState<UserSummary[]>([])
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const selectedFilesRef = useRef<ComposerMediaFile[]>([])
  const files = selectedFiles.map((item) => item.file)

  useEffect(() => {
    selectedFilesRef.current = selectedFiles
  }, [selectedFiles])

  useEffect(() => () => revokeFilePreviews(selectedFilesRef.current), [])

  const taggedSummary = taggedPeople.length === 0
    ? null
    : taggedPeople.length <= 3
      ? t('withTaggedPeople', { people: taggedPeople.map((person) => person.displayName).join(', ') })
      : t('withTaggedPeopleAndOthers', {
          people: taggedPeople.slice(0, 3).map((person) => person.displayName).join(', '),
          count: taggedPeople.length - 3,
        })

  function showComposer() {
    setMessage(null)
    setOpen(true)
  }

  function clearFiles() {
    revokeFilePreviews(selectedFiles)
    setSelectedFiles([])
    setFileKey((value) => value + 1)
  }

  function closeComposer() {
    if (busy) return
    setOpen(false)
    setTagPickerOpen(false)
    setContent('')
    clearFiles()
    setTaggedPeople([])
    setMentionedPeople([])
    setMessage(null)
  }

  function selectFiles(fileList: FileList | null, mode: 'append' | 'replace' = 'replace') {
    const incoming = Array.from(fileList ?? [])
    if (incoming.length === 0) return
    if (mode === 'replace') {
      const seen = new Set<string>()
      const nextFiles = incoming
        .filter((file) => {
          const key = fileIdentity(file)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .slice(0, 10)
        .map((file) => ({ file, previewUrl: createFilePreview(file) }))
      revokeFilePreviews(selectedFiles)
      setSelectedFiles(nextFiles)
    } else {
      const seen = new Set(selectedFiles.map((item) => fileIdentity(item.file)))
      const additions = incoming
        .filter((file) => {
          const key = fileIdentity(file)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .slice(0, Math.max(0, 10 - selectedFiles.length))
        .map((file) => ({ file, previewUrl: createFilePreview(file) }))
      setSelectedFiles([...selectedFiles, ...additions])
    }
    setFileKey((value) => value + 1)
    setMessage(null)
    setOpen(true)
  }

  function toggleTaggedPerson(person: UserSummary) {
    setTaggedPeople((current) => current.some((item) => item.id === person.id)
      ? current.filter((item) => item.id !== person.id)
      : [...current, person])
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim() && files.length === 0) return setMessage(t('composeNeedContent'))
    setBusy(true)
    setMessage(null)
    let uploaded: MediaUpload[] = []
    let persisted = false
    try {
      uploaded = files.length > 0 ? await api.uploadMediaFiles(files) : []
      const taggedIds = new Set(taggedPeople.map((person) => person.id))
      const activeMentions = mentionedPeople.filter((person) => content.includes(`@${person.displayName}`) && !taggedIds.has(person.id))
      const created = await api.createFeedPost({
        authorId: userId,
        content: content.trim(),
        privacy,
        media: uploaded.map((item) => ({ type: mediaType(item.type), url: item.url })),
        ...(taggedPeople.length > 0 ? { taggedUserIds: taggedPeople.map((person) => person.id) } : {}),
        ...(activeMentions.length > 0 ? { mentionedUserIds: activeMentions.map((person) => person.id) } : {}),
      })
      persisted = true
      const optimisticPost: GatewayPost = {
        __typename: 'FeedPostDetail',
        id: created.id,
        type: created.type ?? 1,
        content: created.content ?? content.trim(),
        privacy: created.privacy ?? privacy,
        create: created.create ?? new Date().toISOString(),
        author: {
          id: userId,
          name: displayName,
          avatar: avatarUrl ?? '',
          isVerified: Boolean(isVerified),
          canFollow: false,
        },
        media: created.media ?? uploaded.map((item, index) => ({
          id: item.assetId ?? `${created.id}-media-${index}`,
          type: mediaType(item.type),
          url: item.url,
        })),
        sharedSource: null,
      }
      let hydrated: GatewayPost | null = null
      try {
        hydrated = await api.postDetail(created.id)
      } catch {
        // The write already succeeded. A slow read replica or detail projection must not
        // turn a published post into a false failure (and invite duplicate retries).
      }
      onCreated(hydrated ?? optimisticPost)
      setContent('')
      clearFiles()
      setTaggedPeople([])
      setMentionedPeople([])
      setTagPickerOpen(false)
      setOpen(false)
      setMessage(null)
    } catch {
      if (!persisted) await Promise.allSettled(uploaded.map((item) => api.cancelPendingMedia(item)))
      setMessage(t('publishPostError'))
    } finally {
      setBusy(false)
    }
  }

  return <>
    <section className="card gateway-composer home-composer-card" aria-label={t('createPost')}>
      <div className="home-composer-row">
        <Avatar name={displayName} src={avatarUrl} size={40} />
        <button type="button" className="home-composer-prompt" onClick={showComposer}>{t('postComposerPlaceholder')}</button>
        <label className="home-composer-media" aria-label={t('photoVideo')} title={t('photoVideo')}>
          <Icon name="photo" size={24} />
          <span>{t('photoVideo')}</span>
          <input key={`quick-${fileKey}`} type="file" multiple accept="image/*,video/*" onChange={(event) => selectFiles(event.target.files)} />
        </label>
      </div>
      {message && !open && <p className="form-error home-composer-message">{message}</p>}
    </section>

    {open && <div className="modal-backdrop home-composer-backdrop" role="presentation" onClick={closeComposer}>
      <form className="modal home-post-modal" role="dialog" aria-modal="true" aria-label={t('createPost')} onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <header className="modal-head home-post-modal-head"><h2>{t('createPost')}</h2><button type="button" className="icon-circle" aria-label={t('close')} onClick={closeComposer}><Icon name="close" /></button></header>
        <div className={selectedFiles.length > 0 ? 'home-post-modal-body has-media' : 'home-post-modal-body'}>
          <div className="home-post-author">
            <Avatar name={displayName} src={avatarUrl} size={42} />
            <div><strong className="home-post-author-name"><span>{displayName}<VerifiedBadge verified={isVerified} size={14} /></span>{taggedSummary && <span className="home-tagged-summary"> {taggedSummary}</span>}</strong><select value={privacy} onChange={(event) => setPrivacy(Number(event.target.value) as 0 | 1 | 2 | 3)} aria-label={t('privacy')}><option value={0}>{t('privacyPublic')}</option><option value={1}>{t('privacyFriendsFollowers')}</option><option value={2}>{t('privacyFriends')}</option><option value={3}>{t('privacyOnlyMe')}</option></select></div>
          </div>
          <div className="mention-compose-field home-post-editor"><textarea autoFocus value={content} onChange={(event) => setContent(event.target.value)} placeholder={t('postComposerPlaceholder')} rows={selectedFiles.length > 0 ? 2 : 7} /><MentionSuggestions text={content} people={friends} onTextChange={setContent} onSelected={(person) => setMentionedPeople((current) => current.some((item) => item.id === person.id) ? current : [...current, person])} /></div>
          {selectedFiles.length > 0 && <Suspense fallback={<div className="home-media-preview home-media-preview-loading"><span className="spinner" /></div>}><ComposerMediaPreview items={selectedFiles} fileKey={fileKey} busy={busy} onReplace={(fileList) => selectFiles(fileList, 'replace')} onClear={clearFiles} /></Suspense>}
          <div className="home-add-to-post"><strong>{t('addToPost')}</strong><div className="home-add-to-post-actions"><label aria-label={t('photoVideo')} title={t('photoVideo')}><Icon name="photo" size={25} /><input key={`modal-${fileKey}`} disabled={busy} type="file" multiple accept="image/*,video/*" onChange={(event) => selectFiles(event.target.files, 'append')} /></label><button type="button" disabled={busy} aria-label={t('tagPeople')} title={t('tagPeople')} onClick={() => setTagPickerOpen(true)}><Icon name="friends" size={25} /></button></div></div>
          {message && <p className="form-error">{message}</p>}
          <button type="submit" className="btn-primary home-post-submit" disabled={busy || (!content.trim() && files.length === 0)}>{busy ? t('posting') : t('post')}</button>
        </div>
      </form>
    </div>}
    {open && tagPickerOpen && <Suspense fallback={<div className="modal-backdrop home-tag-picker-backdrop"><span className="spinner" /></div>}><TagPeoplePicker people={friends} selected={taggedPeople} onToggle={toggleTaggedPerson} onDone={() => setTagPickerOpen(false)} onCancel={() => setTagPickerOpen(false)} /></Suspense>}
  </>
}

function StorySection({ buckets, myStories, loading, error, userId, profile, onReload, onStoryCreated, onNavigate }: { buckets: StoryBucket[]; myStories: StoryBucket | null; loading: boolean; error: string | null; userId: string; profile: UserProfile | null; onReload: () => Promise<void>; onStoryCreated: (story: Extract<GatewayStory, { __typename: 'NormalStory' }>) => void; onNavigate?: (path: string) => void }) {
  const { t } = useI18n()
  const [message, setMessage] = useState<string | null>(null)
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [selectedBucket, setSelectedBucket] = useState<StoryBucket | null>(null)
  const [locallyWatchedStoryIds, setLocallyWatchedStoryIds] = useState<Set<string>>(() => new Set())
  const friendBuckets = buckets.filter((bucket) => bucket.author.id !== userId)
  const orderedBuckets = myStories ? [myStories, ...friendBuckets] : friendBuckets
  const markStoryWatched = useCallback((storyId: string) => {
    setLocallyWatchedStoryIds((current) => {
      if (current.has(storyId)) return current
      return new Set(current).add(storyId)
    })
  }, [])

  function openBucket(bucket: StoryBucket) {
    setSelectedBucket(bucket)
  }

  async function deleteLatest(bucket: StoryBucket) {
    const story = bucket.stories[0]
    if (!story) return
    setMessage(null)
    try {
      await api.deleteStory(userId, story.id)
      setMessage(t('storyDeleted'))
      await onReload()
    } catch {
      setMessage(t('genericError'))
    }
  }

  return <section className="card gateway-stories home-story-section" aria-label={t('stories')}>
    <div className="story-strip">
      <article className="story-tile create-story-tile">
        <button type="button" className="story-open create-story-button" onClick={() => { setMessage(null); setCreatorOpen(true) }}>
          <span className="create-story-preview" style={profile?.avatarUrl ? { backgroundImage: `url(${JSON.stringify(profile.avatarUrl)})` } : undefined}>{!profile?.avatarUrl && <Avatar name={profile?.displayName || t('fakebookUser')} size={58} />}</span>
          <span className="create-story-plus"><Icon name="plus" size={22} /></span>
          <strong>{t('storyCreate')}</strong>
        </button>
      </article>

      {loading && <><article className="story-tile story-skeleton" /><article className="story-tile story-skeleton" /><article className="story-tile story-skeleton" /></>}
      {!loading && orderedBuckets.map((bucket) => {
        const latest = bucket.stories[0]
        const preview = latest?.__typename === 'NormalStory' ? latest.media[0]?.url : latest?.sharedSource.media?.url
        const own = bucket.author.id === userId
        const unseen = Boolean(latest) && bucket.hasUnseen && !locallyWatchedStoryIds.has(latest.id)
        return <article className={`story-tile ${unseen ? 'story-unseen' : 'story-seen'}${own ? ' own-story-tile' : ''}`} key={bucket.author.id}>
          <button type="button" className="story-open" onClick={() => openBucket(bucket)}>
            {preview ? <img className="story-cover" src={preview} alt="" loading="lazy" /> : <span className="story-text-preview">{latest?.content || t('stories')}</span>}
            <span className={`story-avatar-ring${unseen ? ' unseen' : ''}`}><Avatar name={bucket.author.name} src={bucket.author.avatar || null} size={36} /></span>
            <strong>{own ? t('yourStory') : bucket.author.name}<VerifiedBadge verified={bucket.author.isVerified} size={12} /></strong>
          </button>
          {own && latest && <button type="button" className="story-delete-mini" aria-label={t('deleteStory')} title={t('deleteStory')} onClick={() => void deleteLatest(bucket)}><Icon name="trash" size={14} /></button>}
        </article>
      })}
      {!loading && orderedBuckets.length === 0 && <article className="story-tile story-empty-tile"><Icon name="clock" size={28} /><span>{t('noStories')}</span></article>}
    </div>
    {(message || error) && !creatorOpen && <p className={message === t('storyDeleted') ? 'form-success story-section-message' : 'form-error story-section-message'}>{message || error}</p>}

    {creatorOpen && <Suspense fallback={<div className="story-creator-backdrop"><span className="spinner" /></div>}><StoryCreatorModal
      open
      authorId={userId}
      onClose={() => setCreatorOpen(false)}
      onCreated={(story) => onStoryCreated(story)}
    /></Suspense>}
    {selectedBucket && <StoryViewerModal bucket={selectedBucket} viewerId={userId} onClose={() => setSelectedBucket(null)} onNavigate={onNavigate} onViewed={markStoryWatched} />}
  </section>
}

function storyMedia(story: GatewayStory) {
  return story.__typename === 'NormalStory' ? story.media[0] ?? null : story.sharedSource.media
}

function StoryViewerModal({ bucket, viewerId, onClose, onNavigate, onViewed }: { bucket: StoryBucket; viewerId: string; onClose: () => void; onNavigate?: (path: string) => void; onViewed?: (storyId: string) => void }) {
  const { t, locale } = useI18n()
  const [index, setIndex] = useState(0)
  const [engagement, setEngagement] = useState<ContentEngagement | null>(null)
  const [viewers, setViewers] = useState<UserSummary[]>([])
  const [likedUsers, setLikedUsers] = useState<UserSummary[]>([])
  const [busy, setBusy] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const story = bucket.stories[index]
  const isOwner = bucket.author.id === viewerId

  useEffect(() => {
    if (!story) return
    let active = true
    socialApi.getContentEngagement(story.id).then((value) => active && setEngagement(value)).catch(() => active && setEngagement(null))
    if (isOwner) onViewed?.(story.id)
    else void socialApi.watchContent(viewerId, story.id).then((watched) => { if (watched) onViewed?.(story.id) }).catch(() => undefined)
    if (isOwner) {
      Promise.all([socialApi.getStoryViewers(story.id, 100), socialApi.getLikedUsers(story.id, 100)]).then(([viewerPage, likedPage]) => {
        if (!active) return
        setViewers(viewerPage.items)
        setLikedUsers(likedPage.items)
      }).catch(() => active && setViewers([]))
    }
    return () => { active = false }
  }, [isOwner, onViewed, story, viewerId])

  if (!story) return null
  const media = storyMedia(story)
  const created = new Date(story.create)
  const time = Number.isNaN(created.getTime()) ? story.create : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(created)

  async function toggleLike() {
    const next = !engagement?.viewerHasLiked
    setBusy(true)
    try {
      const success = next ? await socialApi.likeContent(viewerId, story.id) : await socialApi.unlikeContent(viewerId, story.id)
      if (!success) throw new Error('Reaction rejected')
      setEngagement((current) => ({ ...(current ?? { targetId: story.id, likeCount: 0, commentCount: 0, shareCount: 0, viewerHasSaved: false, viewerHasWatched: true }), viewerHasLiked: next, likeCount: Math.max(0, (current?.likeCount ?? 0) + (next ? 1 : -1)) }))
    } finally {
      setBusy(false)
    }
  }

  return <div className="story-viewer-backdrop" role="presentation" onClick={onClose}><section className="story-viewer" role="dialog" aria-modal="true" aria-label={t('stories')} onClick={(event) => event.stopPropagation()}><header><button type="button" className="story-owner" onClick={() => onNavigate?.(`/profile/${bucket.author.id}`)}><Avatar name={bucket.author.name} src={bucket.author.avatar || null} size={42} /><span><strong>{bucket.author.name}<VerifiedBadge verified={bucket.author.isVerified} /></strong><small>{time}</small></span></button><button type="button" className="icon-circle" onClick={onClose}><Icon name="close" /></button></header><div className="story-progress">{bucket.stories.map((item, itemIndex) => <button type="button" key={item.id} className={itemIndex === index ? 'active' : itemIndex < index ? 'seen' : ''} onClick={() => setIndex(itemIndex)} aria-label={`${t('stories')} ${itemIndex + 1}`} />)}</div><div className="story-stage">{media ? media.type === 1 ? <video src={media.url} controls autoPlay preload="metadata" /> : <img src={media.url} alt="" /> : <div className="story-text-only"><p>{story.content}</p></div>}{story.content && media && <p className="story-caption">{story.content}</p>}{index > 0 && <button type="button" className="story-nav previous" onClick={() => setIndex((value) => value - 1)}>‹</button>}{index < bucket.stories.length - 1 && <button type="button" className="story-nav next" onClick={() => setIndex((value) => value + 1)}>›</button>}</div><footer>{isOwner ? <button type="button" className="btn-soft" onClick={() => setPanelOpen((open) => !open)}><Icon name="friends" size={17} />{t('storyViewersCount', { count: viewers.length })}</button> : <button type="button" className={engagement?.viewerHasLiked ? 'story-like active' : 'story-like'} disabled={busy} onClick={() => void toggleLike()}><Icon name="like" />{engagement?.viewerHasLiked ? t('liked') : t('like')} {engagement?.likeCount ? engagement.likeCount : ''}</button>}</footer>{isOwner && panelOpen && <aside className="story-viewer-panel"><h3>{t('storyViewers')}</h3>{viewers.length === 0 ? <p>{t('storyNoViewers')}</p> : viewers.map((person) => <button type="button" key={person.id} onClick={() => onNavigate?.(`/profile/${person.id}`)}><Avatar name={person.displayName} src={person.avatarUrl} size={36} /><span><strong>{person.displayName}<VerifiedBadge verified={person.isVerified} /></strong><small>{likedUsers.some((liked) => liked.id === person.id) ? t('likedStory') : t('viewedStory')}</small></span></button>)}</aside>}</section></div>
}

export function GatewayPostCard({ post, locale, viewerId, onNavigate, onMessage, authorPath }: { post: GatewayPost; locale: string; viewerId?: string; onNavigate?: (path: string) => void; onMessage?: (profileId: string) => Promise<void>; authorPath?: (authorId: string) => string }) {
  const { t } = useI18n()
  const [current, setCurrent] = useState(post)
  const [deleting, setDeleting] = useState(false)
  const [removed, setRemoved] = useState(false)
  const [relationshipBusy, setRelationshipBusy] = useState(false)
  const [relationshipError, setRelationshipError] = useState<string | null>(null)
  useEffect(() => setCurrent(post), [post])
  if (removed) return null
  const created = new Date(current.create)
  const time = Number.isNaN(created.getTime()) ? current.create : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(created)
  const owned = viewerId != null && viewerId === current.author.id
  const openAuthor = () => onNavigate?.(authorPath?.(current.author.id) ?? `/profile/${current.author.id}`)
  const canFollow = current.__typename === 'FeedPostDetail' && !owned && Boolean(current.author.canFollow)
  const canJoin = current.__typename === 'GroupPostDetail' && Boolean(current.group.canJoin)
  const privacyLabel = current.privacy === 0 ? t('privacyPublic') : current.privacy === 1 ? t('privacyFriendsFollowers') : current.privacy === 2 ? t('privacyFriends') : t('privacyOnlyMe')
  const privacyIcon = current.privacy === 0 ? 'globe' : current.privacy === 3 ? 'lock' : 'friends'

  async function followAuthor() {
    if (!viewerId || current.__typename !== 'FeedPostDetail') return
    setRelationshipBusy(true)
    setRelationshipError(null)
    try {
      if (!await socialApi.followUser(viewerId, current.author.id)) throw new Error('Follow rejected')
      setCurrent((value) => ({ ...value, author: { ...value.author, canFollow: false } }))
    } catch {
      setRelationshipError(t('genericError'))
    } finally {
      setRelationshipBusy(false)
    }
  }

  async function joinGroup() {
    if (!viewerId || current.__typename !== 'GroupPostDetail') return
    setRelationshipBusy(true)
    setRelationshipError(null)
    try {
      if (!await socialApi.requestJoinGroup(viewerId, current.group.id)) throw new Error('Join rejected')
      setCurrent((value) => value.__typename === 'GroupPostDetail' ? { ...value, group: { ...value.group, canJoin: false } } : value)
    } catch {
      setRelationshipError(t('joinGroupError'))
    } finally {
      setRelationshipBusy(false)
    }
  }

  return (
    <article className="card gateway-post">
      <header className={current.__typename === 'GroupPostDetail' ? 'group-feed-post-head' : 'feed-post-head'}>
        {current.__typename === 'GroupPostDetail' ? <button type="button" className="post-author-avatar" onClick={() => onNavigate?.(`/groups/${current.group.id}`)}><GroupPostAvatar groupName={current.group.name} groupAvatar={current.group.avatar || null} userName={current.author.name} userAvatar={current.author.avatar || null} size={44} /></button> : <button type="button" className="post-author-avatar" onClick={openAuthor}><Avatar name={current.author.name} src={current.author.avatar || null} size={44} /></button>}
        <div className="post-head-copy">
          <div className="post-head-primary">
            {current.__typename === 'GroupPostDetail' ? <button type="button" className="post-group-link" onClick={() => onNavigate?.(`/groups/${current.group.id}`)}><strong>{current.group.name}</strong></button> : <button type="button" className="post-author-name" onClick={openAuthor}><strong>{current.author.name}<VerifiedBadge verified={current.author.isVerified} /></strong></button>}
            {canFollow && <button type="button" className="post-inline-action" disabled={relationshipBusy} onClick={() => void followAuthor()}>{t('follow')}</button>}
            {canJoin && <button type="button" className="post-inline-action" disabled={relationshipBusy} onClick={() => void joinGroup()}>{t('joinGroup')}</button>}
          </div>
          <span className="post-head-meta">
            {current.__typename === 'GroupPostDetail' && <><button type="button" className="post-meta-author" onClick={openAuthor}>{current.author.name}<VerifiedBadge verified={current.author.isVerified} size={12} /></button><i>·</i></>}
            <time dateTime={current.create}>{time}</time><i>·</i><span title={privacyLabel}><Icon name={privacyIcon} size={12} /></span>
          </span>
        </div>
        <div className="post-header-actions">
          {(viewerId || owned) && <PostOptionsMenu post={current} viewerId={viewerId} owned={owned} onDelete={() => setDeleting(true)} onPostHidden={() => setRemoved(true)} />}
          <button type="button" className="post-header-icon" aria-label={t('hidePost')} title={t('hidePost')} onClick={() => setRemoved(true)}><Icon name="close" size={22} /></button>
        </div>
      </header>
      {relationshipError && <p className="form-error post-relationship-error">{relationshipError}</p>}
      {current.content && <p className="gateway-post-content">{current.content}</p>}
      <PostMediaGallery media={current.media} />
      {current.__typename === 'FeedPostDetail' && current.sharedSource && <SharedPostSourceCard source={current.sharedSource} onNavigate={onNavigate} />}
      {viewerId && <Suspense fallback={<div className="content-actions-skeleton" />}><ContentActions viewerId={viewerId} contentId={current.id} post={current} canShare={current.__typename === 'GroupPostDetail' || current.privacy === 0} canReshare={current.__typename === 'FeedPostDetail' && current.privacy === 0} onNavigate={onNavigate} onMessage={onMessage} /></Suspense>}
      {deleting && <DeletePostModal postId={current.id} onClose={() => setDeleting(false)} onDeleted={() => setRemoved(true)} />}
    </article>
  )
}

function SharedPostSourceCard({ source, onNavigate }: { source: NonNullable<Extract<GatewayPost, { __typename: 'FeedPostDetail' }>['sharedSource']>; onNavigate?: (path: string) => void }) {
  const { t } = useI18n()
  if (!source.isAvailable) {
    return <section className="shared-post-source unavailable"><Icon name="lock" size={24} /><div><strong>{t('contentUnavailable')}</strong><p>{t('contentUnavailableDesc')}</p></div></section>
  }
  return <section className="shared-post-source">
    <PostMediaGallery media={source.media} compact controls={false} onOpen={() => onNavigate?.(`/content/${source.id}`)} />
    <div className="shared-source-body">
      <button type="button" className="shared-source-author" disabled={!source.author} onClick={() => source.author && onNavigate?.(`/profile/${source.author.id}`)}><Avatar name={source.author?.name || t('fakebookUser')} src={source.author?.avatar || null} size={38} /><strong>{source.author?.name || t('fakebookUser')}<VerifiedBadge verified={source.author?.isVerified} size={12} /></strong></button>
      {source.content && <button type="button" className="shared-source-content" onClick={() => onNavigate?.(`/content/${source.id}`)}>{source.content}</button>}
    </div>
  </section>
}

function DeletePostModal({ postId, onClose, onDeleted }: { postId: string; onClose: () => void; onDeleted: () => void }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function remove() {
    setBusy(true)
    setError(null)
    try {
      if (!await socialApi.deleteContent(postId)) throw new Error('Delete rejected')
      onDeleted()
    } catch {
      setError(t('deletePostError'))
    } finally {
      setBusy(false)
    }
  }
  return <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}><section className="modal compact-form-modal" role="dialog" aria-modal="true" aria-label={t('deletePost')} onClick={(event) => event.stopPropagation()}><header className="modal-head"><h2>{t('deletePost')}</h2><button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button></header><div className="modal-body destructive-confirm"><Icon name="trash" size={38} /><p>{t('deletePostConfirm')}</p>{error && <p className="form-error">{error}</p>}</div><footer className="modal-foot"><button type="button" className="btn-soft" onClick={onClose}>{t('cancel')}</button><button type="button" className="btn-danger" disabled={busy} onClick={() => void remove()}>{busy ? t('working') : t('deletePost')}</button></footer></section></div>
}
