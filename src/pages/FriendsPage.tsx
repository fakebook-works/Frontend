import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { socialApi, type SocialContent, type SocialProfile } from '../api/social'
import type { UserSummary } from '../api/types'
import { AnchoredMenuPortal } from '../components/AnchoredMenuPortal'
import { Avatar } from '../components/Avatar'
import { FriendPeopleGlyph, FriendPersonActionGlyph, FriendPersonShape } from '../components/FriendPeopleGlyph'
import { Icon } from '../components/Icon'
import { SidebarSettingsIcon } from '../components/SidebarSettingsIcon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { ProfilePage } from './ProfilePage'
import type { ProfileMediaViewerOpenOptions, ProfileMediaViewerState } from './ProfilePage'

export type FriendSection = 'home' | 'outgoing' | 'incoming' | 'suggestions' | 'friends' | 'blocked'

const ASSOCIATION: Record<Exclude<FriendSection, 'home' | 'suggestions'>, number> = {
  friends: 0,
  incoming: 2,
  outgoing: 1,
  blocked: 5,
}

interface FriendCardModel {
  profile: SocialProfile
  mutualFriendCount: number
  mutualFriends: UserSummary[]
}

export function FriendsPage({
  userId,
  section,
  onNavigate,
  onOpenReel,
  onOpenPhoto,
  onMessage,
}: {
  userId: string
  section: FriendSection
  onNavigate: (path: string) => void
  onOpenReel?: (ownerId: string, reelId: string, reel?: SocialContent) => void
  onOpenPhoto?: (viewer: ProfileMediaViewerState, options?: ProfileMediaViewerOpenOptions) => void
  onMessage?: (profileId: string) => Promise<void>
}) {
  const { t } = useI18n()
  const [people, setPeople] = useState<FriendCardModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<SocialProfile | null>(null)
  const [directoryQuery, setDirectoryQuery] = useState('')
  const loadedRequestRef = useRef<string | null>(null)
  const selectedProfileRequestRef = useRef(0)
  const selectedProfileCacheRef = useRef(new Map<string, SocialProfile>())
  const pageRef = useRef<HTMLElement>(null)
  const scrollContextRef = useRef(`${section}:`)

  useLayoutEffect(() => {
    const nextContext = `${section}:${selectedProfileId ?? ''}`
    if (scrollContextRef.current === nextContext) return
    scrollContextRef.current = nextContext
    const viewport = pageRef.current?.closest<HTMLElement>('.authenticated-destination-scroll')
    if (viewport) viewport.scrollTop = 0
  }, [section, selectedProfileId])

  useEffect(() => {
    const requestKey = `${userId}:${section}`
    if (loadedRequestRef.current === requestKey) return
    let active = true
    setLoading(true)
    setError(null)
    async function load() {
      try {
        if (section === 'home' || section === 'suggestions') {
          const suggestions = await socialApi.getFriendSuggestions(userId, 36)
          if (active) setPeople(suggestions)
        } else if (section === 'friends') {
          const profiles = await socialApi.getFriendProfilesWithMutualCounts(userId, 100)
          if (active) setPeople(profiles.map((item) => ({ ...item, mutualFriends: [] })))
        } else {
          const profiles = await socialApi.getRelationProfiles(userId, ASSOCIATION[section], 100)
          if (active) setPeople(profiles.map((profile) => ({ profile, mutualFriendCount: 0, mutualFriends: [] })))
        }
      } catch {
        if (active) {
          setPeople([])
          setError(t('friendsLoadError'))
        }
      } finally {
        if (active) {
          loadedRequestRef.current = requestKey
          setLoading(false)
        }
      }
    }

    void load()
    return () => { active = false }
  }, [section, t, userId])

  const directoryMode = section === 'suggestions' || section === 'friends'
  const directoryPeople = useMemo(() => {
    if (section !== 'friends') return people
    const normalized = directoryQuery.trim().toLocaleLowerCase()
    if (!normalized) return people
    return people.filter(({ profile }) => profile.displayName.toLocaleLowerCase().includes(normalized))
  }, [directoryQuery, people, section])

  useEffect(() => {
    selectedProfileRequestRef.current += 1
    selectedProfileCacheRef.current.clear()
    setSelectedProfileId(null)
    setSelectedProfile(null)
    setDirectoryQuery('')
  }, [section, userId])

  useEffect(() => {
    if (!directoryMode || loading) return
    if (directoryPeople.length === 0) {
      setSelectedProfileId(null)
      setSelectedProfile(null)
      return
    }
    if (!selectedProfileId || !directoryPeople.some((item) => item.profile.id === selectedProfileId)) {
      setSelectedProfileId(directoryPeople[0].profile.id)
    }
  }, [directoryMode, directoryPeople, loading, selectedProfileId])

  useEffect(() => {
    if (!directoryMode || !selectedProfileId) return
    const summary = people.find((item) => item.profile.id === selectedProfileId)?.profile ?? null
    const cached = selectedProfileCacheRef.current.get(selectedProfileId)
    setSelectedProfile(cached ?? summary)
    if (!summary) return
    if (cached) return
    const request = ++selectedProfileRequestRef.current
    void socialApi.getProfile(selectedProfileId)
      .then((profile) => {
        if (!profile) return
        selectedProfileCacheRef.current.set(selectedProfileId, profile)
        if (selectedProfileRequestRef.current === request) setSelectedProfile(profile)
      })
      .catch(() => undefined)
  }, [directoryMode, people, selectedProfileId])

  function removeCard(personId: string) {
    setPeople((current) => current.filter((item) => item.profile.id !== personId))
  }

  async function addFriend(personId: string) {
    setBusyId(personId)
    setError(null)
    try {
      if (!await socialApi.sendFriendRequest(userId, personId)) throw new Error('Request rejected')
      removeCard(personId)
    } catch {
      setError(t('friendActionError'))
    } finally {
      setBusyId(null)
    }
  }

  async function accept(requesterId: string) {
    setBusyId(requesterId)
    setError(null)
    try {
      if (!await socialApi.acceptFriendRequest(requesterId, userId)) throw new Error('Request rejected')
      removeCard(requesterId)
    } catch {
      setError(t('friendActionError'))
    } finally {
      setBusyId(null)
    }
  }

  async function remove(personId: string, action: 'reject' | 'cancel' | 'unfriend' | 'unblock') {
    setBusyId(personId)
    setError(null)
    try {
      const success = action === 'reject'
        ? await socialApi.rejectFriendRequest(personId, userId)
        : action === 'cancel'
          ? await socialApi.cancelFriendRequest(userId, personId)
          : action === 'unfriend'
            ? await socialApi.unfriend(userId, personId)
            : await socialApi.unblockUser(userId, personId)
      if (!success) throw new Error('Action rejected')
      removeCard(personId)
    } catch {
      setError(t('friendActionError'))
    } finally {
      setBusyId(null)
    }
  }

  async function block(personId: string) {
    setBusyId(personId)
    setError(null)
    try {
      if (!await socialApi.blockUser(userId, personId)) throw new Error('Action rejected')
      removeCard(personId)
    } catch {
      setError(t('friendActionError'))
    } finally {
      setBusyId(null)
    }
  }

  const sections: Array<{ id: FriendSection; path: string; label: string; icon: FriendNavIconName }> = [
    { id: 'home', path: '/friends', label: t('friendsHome'), icon: 'home' },
    { id: 'outgoing', path: '/friends/outgoing', label: t('sentRequests'), icon: 'request-sent' },
    { id: 'incoming', path: '/friends/incoming', label: t('incomingRequests'), icon: 'request-received' },
    { id: 'suggestions', path: '/friends/suggestions', label: t('friendSuggestionsNav'), icon: 'suggestions' },
    { id: 'friends', path: '/friends/friends', label: t('allFriends'), icon: 'friends' },
    { id: 'blocked', path: '/friends/blocked', label: t('blockedPeople'), icon: 'blocked' },
  ]
  const title = section === 'home' || section === 'suggestions'
    ? t('friendSuggestionsTitle')
    : section === 'blocked'
      ? t('blockedPeople')
      : sections.find((item) => item.id === section)?.label ?? t('friends')
  const emptyState = section === 'home' || section === 'suggestions'
    ? { title: t('friendSuggestionsEmpty'), description: t('friendSuggestionsEmptyDesc') }
    : section === 'incoming'
      ? { title: t('incomingRequestsEmpty'), description: t('incomingRequestsEmptyDesc') }
      : section === 'outgoing'
        ? { title: t('sentRequestsEmpty'), description: t('sentRequestsEmptyDesc') }
        : section === 'friends'
          ? { title: t('allFriendsEmpty'), description: t('allFriendsEmptyDesc') }
          : { title: t('blockedPeopleEmpty'), description: t('blockedPeopleEmptyDesc') }
  return <main ref={pageRef} className={`friends-page-layout${directoryMode ? ' friend-directory-mode' : ''}`}>
    {directoryMode ? <FriendDirectorySidebar
      title={sections.find((item) => item.id === section)?.label ?? t('friends')}
      people={directoryPeople}
      totalFriends={people.length}
      loading={loading}
      selectedProfileId={selectedProfileId}
      busyId={busyId}
      section={section}
      query={directoryQuery}
      onBack={() => onNavigate('/friends')}
      onQueryChange={setDirectoryQuery}
      onSelect={setSelectedProfileId}
      onAdd={addFriend}
      onDismiss={removeCard}
      onUnfriend={(personId) => remove(personId, 'unfriend')}
      onBlock={block}
      onMessage={onMessage}
    /> : <aside className="friends-page-sidebar">
      <header><h1>{t('friends')}</h1><button type="button" className="friends-settings-button" aria-label={t('settingsPrivacy')}><SidebarSettingsIcon /></button></header>
      <nav aria-label={t('friends')}>
        {sections.map((item) => <button type="button" key={item.id} className={section === item.id ? 'active' : ''} onClick={() => onNavigate(item.path)}>
          <span><FriendNavIcon name={item.icon} /></span><strong>{item.label}</strong>
        </button>)}
      </nav>
    </aside>}

    {directoryMode ? <section className="friends-profile-pane">
      {error && <p className="form-error friends-page-error" role="alert">{error}</p>}
      {!loading && selectedProfile && <ProfilePage
        key={selectedProfile.id}
        profile={selectedProfile}
        loading={false}
        error={null}
        canEdit={false}
        viewerId={userId}
        embedded
        onEdit={() => undefined}
        onNavigate={onNavigate}
        onOpenReel={onOpenReel}
        onOpenPhoto={onOpenPhoto}
        onMessage={onMessage ?? (async () => undefined)}
      />}
      {!loading && !selectedProfile && <div className="friends-page-state"><Icon name="friends" size={44} /><h3>{emptyState.title}</h3><p>{emptyState.description}</p></div>}
    </section> : <section className="friends-page-content">
      <header className="friends-page-content-head"><h2>{title}</h2>{section !== 'home' && !loading && <span>{t('peopleCount', { count: people.length })}</span>}</header>
      {error && <p className="form-error friends-page-error" role="alert">{error}</p>}
      {loading ? <div className="friends-page-state"><span className="spinner" /></div> : people.length === 0 ? <div className="friends-page-state"><Icon name="friends" size={44} /><h3>{emptyState.title}</h3><p>{emptyState.description}</p></div> : <div className="friends-card-grid">
        {people.map((item) => <FriendCard
          key={item.profile.id}
          item={item}
          section={section}
          busy={busyId === item.profile.id}
          onNavigate={onNavigate}
          onMessage={onMessage}
          onAdd={() => void addFriend(item.profile.id)}
          onDismiss={() => removeCard(item.profile.id)}
          onAccept={() => void accept(item.profile.id)}
          onRemove={(action) => void remove(item.profile.id, action)}
        />)}
      </div>}
    </section>}
  </main>
}

function FriendDirectorySidebar({
  title,
  people,
  totalFriends,
  loading,
  selectedProfileId,
  busyId,
  section,
  query,
  onBack,
  onQueryChange,
  onSelect,
  onAdd,
  onDismiss,
  onUnfriend,
  onBlock,
  onMessage,
}: {
  title: string
  people: FriendCardModel[]
  totalFriends: number
  loading: boolean
  selectedProfileId: string | null
  busyId: string | null
  section: 'suggestions' | 'friends'
  query: string
  onBack: () => void
  onQueryChange: (query: string) => void
  onSelect: (profileId: string) => void
  onAdd: (profileId: string) => Promise<void>
  onDismiss: (profileId: string) => void
  onUnfriend: (profileId: string) => Promise<void>
  onBlock: (profileId: string) => Promise<void>
  onMessage?: (profileId: string) => Promise<void>
}) {
  const { t } = useI18n()
  const [searchFocused, setSearchFocused] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<HTMLButtonElement | null>(null)

  function closeMenu() {
    setMenuId(null)
    setMenuAnchor(null)
  }

  async function runMenuAction(action: () => Promise<void>) {
    closeMenu()
    await action()
  }

  return <aside className="friends-page-sidebar friend-directory-sidebar">
    <header className="friend-directory-header">
      <button type="button" className="friend-directory-back" aria-label={t('back')} onClick={onBack}><svg className="shell-search-back-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12H7M11.5 7.5 7 12l4.5 4.5" /></svg></button>
      <h1>{title}</h1>
    </header>
    {section === 'friends' && <div className="groups-search-row friend-directory-search-row">
      <form className={searchFocused ? 'groups-search-shell friend-directory-search-shell is-open' : 'groups-search-shell friend-directory-search-shell'} onSubmit={(event) => event.preventDefault()} onFocus={() => setSearchFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchFocused(false) }}>
        <label className="groups-search friend-directory-search"><svg className="groups-search-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="10.25" cy="10.25" r="6.15" /><path d="m14.85 14.85 4.85 4.85" /></svg><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={t('searchWithinFriends', { count: totalFriends })} aria-label={t('searchWithinFriends', { count: totalFriends })} autoComplete="off" /></label>
      </form>
    </div>}
    {loading ? <div className="friend-directory-state"><span className="spinner" /></div> : <div className="friend-directory-list">
      {people.map(({ profile, mutualFriendCount }) => <article key={profile.id} className={`friend-directory-row ${section === 'friends' ? 'is-friends' : 'is-suggestion'}${selectedProfileId === profile.id ? ' selected' : ''}`}>
        <button type="button" className="friend-directory-avatar-button" aria-label={profile.displayName} onClick={() => onSelect(profile.id)}>
          <Avatar name={profile.displayName} src={profile.avatarUrl} size={54} />
        </button>
        <div className="friend-directory-details">
          <button type="button" className="friend-directory-copy" onClick={() => onSelect(profile.id)}>
            <strong><span>{profile.displayName}</span><VerifiedBadge verified={profile.isVerified} size={13} /></strong>
            {section === 'friends' && <span className="friend-directory-mutual-count">{t('mutualFriendsCount', { count: mutualFriendCount })}</span>}
          </button>
          {section === 'suggestions' ? <>
            <div className="friend-directory-actions">
              <button type="button" className="friend-action-primary" disabled={busyId === profile.id} onClick={() => void onAdd(profile.id)}>{t('addFriend')}</button>
              <button type="button" className="friend-action-secondary" disabled={busyId === profile.id} onClick={() => onDismiss(profile.id)}>{t('dismiss')}</button>
            </div>
          </> : null}
        </div>
        {section === 'friends' && <div className="friend-directory-menu">
          <button type="button" aria-label={t('more')} aria-haspopup="menu" aria-expanded={menuId === profile.id} onClick={(event) => { const opening = menuId !== profile.id; setMenuId(opening ? profile.id : null); setMenuAnchor(opening ? event.currentTarget : null) }}><Icon name="more" size={18} /></button>
          {menuId === profile.id && <AnchoredMenuPortal anchor={menuAnchor} className="self-profile-cover-menu self-profile-connection-menu-popover friend-directory-menu-popover" onRequestClose={closeMenu}>
            <button type="button" className="friend-directory-menu-current" disabled>{profile.displayName}</button>
            <button type="button" role="menuitem" disabled={!onMessage || busyId === profile.id} onClick={() => void runMenuAction(async () => { await onMessage?.(profile.id) })}><Icon name="messenger" size={21} />{t('messageUser')}</button>
            <button type="button" role="menuitem" disabled={busyId === profile.id} onClick={() => void runMenuAction(() => onUnfriend(profile.id))}><FriendPersonActionGlyph action="cancel" />{t('removeFriend')}</button>
            <button type="button" role="menuitem" disabled={busyId === profile.id} onClick={() => void runMenuAction(() => onBlock(profile.id))}><FriendPersonActionGlyph action="block" />{t('block')}</button>
          </AnchoredMenuPortal>}
        </div>}
      </article>)}
      {!loading && people.length === 0 && <div className="friend-directory-empty">{section === 'friends' && query.trim() ? t('noSearchResults') : t('allFriendsEmpty')}</div>}
    </div>}
  </aside>
}

type FriendNavIconName = 'home' | 'request-sent' | 'request-received' | 'suggestions' | 'friends' | 'blocked'

function FriendNavIcon({ name }: { name: FriendNavIconName }) {
  if (name === 'home') return <FriendPeopleGlyph className="friend-nav-glyph" filled />
  if (name === 'blocked') return <Icon name="block" className="friend-nav-glyph" size={22} />

  const symbolPath = name === 'suggestions'
    ? 'M15.8 16.1v6.2m-3.1-3.1h6.2'
    : name === 'friends'
      ? 'M12.3 17.7h6.4m-6.4 3.15h4.1'
      : name === 'request-sent'
        ? 'M12.1 19.2h6.7m-2.35-2.35 2.35 2.35-2.35 2.35'
        : 'M18.8 19.2h-6.7m2.35-2.35-2.35 2.35 2.35 2.35'
  return <svg className="friend-nav-glyph" viewBox="0 0 24 24" aria-hidden="true">
    <FriendPersonShape transform="translate(12 13)" />
    <path className="friend-nav-symbol-outline" d={symbolPath} />
    <path className="friend-nav-symbol" d={symbolPath} />
  </svg>
}

function FriendCard({
  item,
  section,
  busy,
  onNavigate,
  onMessage,
  onAdd,
  onDismiss,
  onAccept,
  onRemove,
}: {
  item: FriendCardModel
  section: FriendSection
  busy: boolean
  onNavigate: (path: string) => void
  onMessage?: (profileId: string) => Promise<void>
  onAdd: () => void
  onDismiss: () => void
  onAccept: () => void
  onRemove: (action: 'reject' | 'cancel' | 'unfriend' | 'unblock') => void
}) {
  const { t } = useI18n()
  const { profile, mutualFriendCount, mutualFriends } = item
  const profilePath = `/profile/${profile.id}`

  return <article className="friend-discovery-card">
    <button type="button" className="friend-card-photo" aria-label={profile.displayName} onClick={() => onNavigate(profilePath)}>
      {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" loading="lazy" /> : <span className={section === 'home' || section === 'outgoing' || section === 'incoming' ? 'friend-card-default-square' : undefined}><Avatar name={profile.displayName} size={96} /></span>}
    </button>
    <div className="friend-card-body">
      <div className="friend-card-name-area">
        <button type="button" className="friend-card-name" onClick={() => onNavigate(profilePath)}><strong>{profile.displayName}<VerifiedBadge verified={profile.isVerified} size={14} /></strong></button>
        <FriendProfilePopover profile={profile} mutualFriendCount={mutualFriendCount} mutualFriends={mutualFriends} showAdd={section === 'home' || section === 'suggestions'} busy={busy} onAdd={onAdd} onMessage={onMessage} onNavigate={onNavigate} />
      </div>
      <MutualFriendsLine count={mutualFriendCount} friends={mutualFriends} followerCount={profile.followerCount} />
      <div className="friend-card-actions">
        {(section === 'home' || section === 'suggestions') && <><button type="button" className="friend-action-primary" disabled={busy} onClick={onAdd}>{t('addFriend')}</button><button type="button" className="friend-action-secondary" disabled={busy} onClick={onDismiss}>{t('dismiss')}</button></>}
        {section === 'incoming' && <><button type="button" className="friend-action-primary" disabled={busy} onClick={onAccept}>{t('confirm')}</button><button type="button" className="friend-action-secondary" disabled={busy} onClick={() => onRemove('reject')}>{t('decline')}</button></>}
        {section === 'outgoing' && <button type="button" className="friend-action-secondary" disabled={busy} onClick={() => onRemove('cancel')}>{t('cancel')}</button>}
        {section === 'friends' && <button type="button" className="friend-action-secondary" disabled={busy} onClick={() => onRemove('unfriend')}>{t('removeFriend')}</button>}
        {section === 'blocked' && <button type="button" className="friend-action-secondary" disabled={busy} onClick={() => onRemove('unblock')}>{t('unblock')}</button>}
      </div>
    </div>
  </article>
}

function MutualFriendsLine({ count, friends, followerCount, compact = false }: { count: number; friends: UserSummary[]; followerCount: number; compact?: boolean }) {
  const { t } = useI18n()
  if (count <= 0) return <div className="friend-mutual-line empty">{followerCount > 0 ? t('followersCount', { count: followerCount }) : null}</div>
  return <div className={`friend-mutual-line${compact ? ' compact' : ''}`} tabIndex={0}>
    <span className="friend-mutual-avatars">{friends.slice(0, 3).map((friend) => <Avatar key={friend.id} name={friend.displayName} src={friend.avatarUrl} size={20} />)}</span>
    <span>{t('mutualFriendsCount', { count })}</span>
    {friends.length > 0 && <span className="friend-mutual-tooltip">{friends.map((friend) => friend.displayName).join('\n')}</span>}
  </div>
}

function FriendProfilePopover({
  profile,
  mutualFriendCount,
  mutualFriends,
  showAdd,
  busy,
  onAdd,
  onMessage,
  onNavigate,
}: {
  profile: SocialProfile
  mutualFriendCount: number
  mutualFriends: UserSummary[]
  showAdd: boolean
  busy: boolean
  onAdd: () => void
  onMessage?: (profileId: string) => Promise<void>
  onNavigate: (path: string) => void
}) {
  const { t } = useI18n()
  return <aside className="friend-profile-popover">
    <button type="button" className="friend-popover-avatar" onClick={() => onNavigate(`/profile/${profile.id}`)}><Avatar name={profile.displayName} src={profile.avatarUrl} size={104} /></button>
    <div className="friend-popover-copy">
      <button type="button" onClick={() => onNavigate(`/profile/${profile.id}`)}><strong>{profile.displayName}<VerifiedBadge verified={profile.isVerified} /></strong></button>
      {mutualFriendCount > 0 && <p><Icon name="friends" size={20} /><span>{t('mutualFriendsCount', { count: mutualFriendCount })}{mutualFriends.length > 0 ? `: ${mutualFriends.map((friend) => friend.displayName).join(', ')}` : ''}</span></p>}
      {profile.followerCount > 0 && <p><Icon name="bookmark" size={19} /><span>{t('followersCount', { count: profile.followerCount })}</span></p>}
    </div>
    <footer>
      {showAdd && <button type="button" className="primary" disabled={busy} onClick={onAdd}>{t('addFriend')}</button>}
      {onMessage && <button type="button" disabled={busy} onClick={() => void onMessage(profile.id)}><Icon name="messenger" size={18} />{t('messages')}</button>}
      <button type="button" aria-label={t('profile')} onClick={() => onNavigate(`/profile/${profile.id}`)}><Icon name="more" size={18} /></button>
    </footer>
  </aside>
}
