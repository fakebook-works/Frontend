import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api/client'
import type { FriendDto, FriendRequestDto, PostDto, UserProfile, UserSummary } from '../api/types'
import { Avatar } from '../components/Avatar'
import { Composer } from '../components/Composer'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { PostCard } from '../components/PostCard'
import { Stories } from '../components/Stories'
import { useAuth } from '../lib/auth'
import { firstName, timeAgo } from '../lib/format'
import { MessengerPage, MiniChat } from './messenger'
import { languageOptions, useI18n } from '../i18n'
import { useTheme } from '../theme'

const PAGE = 20

type View = { type: 'feed' } | { type: 'profile'; userId: string } | { type: 'messenger' }

export function HomePage({ me }: { me: UserSummary }) {
  const { logout } = useAuth()
  const { t } = useI18n()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [feed, setFeed] = useState<PostDto[]>([])
  const [feedHasMore, setFeedHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [incoming, setIncoming] = useState<FriendRequestDto[]>([])
  const [friends, setFriends] = useState<FriendDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [view, setView] = useState<View>({ type: 'feed' })
  const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(null)
  const [viewedPosts, setViewedPosts] = useState<PostDto[]>([])
  const [viewedLoading, setViewedLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())

  const friendIds = useMemo(() => new Set(friends.map((f) => f.user.id)), [friends])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [profileRes, feedRes, incomingRes, friendsRes] = await Promise.all([
          api.me(),
          api.feed(0, PAGE),
          api.incomingRequests(),
          api.friends(),
        ])
        if (cancelled) return
        setProfile(profileRes)
        setFeed(feedRes)
        setFeedHasMore(feedRes.length === PAGE)
        setIncoming(incomingRes)
        setFriends(friendsRes)
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : t('loadFeedError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [t])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const next = await api.feed(feed.length, PAGE)
      setFeed((prev) => [...prev, ...next])
      setFeedHasMore(next.length === PAGE)
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false)
    }
  }

  function handleCreated(post: PostDto) {
    setFeed((prev) => [post, ...prev])
    setProfile((p) => (p ? { ...p, postCount: p.postCount + 1 } : p))
  }

  function patchPost(updated: PostDto) {
    setFeed((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    setViewedPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  function removePost(id: string) {
    setFeed((prev) => prev.filter((p) => p.id !== id))
    setViewedPosts((prev) => prev.filter((p) => p.id !== id))
    setProfile((p) => (p ? { ...p, postCount: Math.max(0, p.postCount - 1) } : p))
  }

  function handleShared(post: PostDto) {
    setFeed((prev) => [post, ...prev])
  }

  async function openProfile(userId: string) {
    setView({ type: 'profile', userId })
    setViewedProfile(null)
    setViewedPosts([])
    setViewedLoading(true)
    try {
      const [p, posts] = await Promise.all([api.user(userId), api.userPosts(userId, 0, PAGE)])
      setViewedProfile(p)
      setViewedPosts(posts)
    } catch {
      /* ignore */
    } finally {
      setViewedLoading(false)
    }
  }

  function goHome() {
    setView({ type: 'feed' })
  }

  async function accept(req: FriendRequestDto) {
    setIncoming((prev) => prev.filter((r) => r.friendshipId !== req.friendshipId))
    try {
      await api.acceptRequest(req.friendshipId)
      const fresh = await api.friends()
      setFriends(fresh)
    } catch {
      setIncoming((prev) => [req, ...prev])
    }
  }

  async function decline(req: FriendRequestDto) {
    setIncoming((prev) => prev.filter((r) => r.friendshipId !== req.friendshipId))
    try {
      await api.declineRequest(req.friendshipId)
    } catch {
      setIncoming((prev) => [req, ...prev])
    }
  }

  async function addFriend(userId: string) {
    setSentIds((prev) => new Set(prev).add(userId))
    try {
      await api.sendFriendRequest(userId)
    } catch {
      setSentIds((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }

  if (loading) {
    return (
      <div className="boot">
        <img src="/brand/fakebook-minimal-cropped.png" alt="" />
        <span className="spinner" />
      </div>
    )
  }

  if (loadError || !profile) {
    return (
      <div className="boot error">
        <img src="/brand/fakebook-minimal-cropped.png" alt="" />
        <p>{loadError ?? t('genericError')}</p>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
          {t('tryAgain')}
        </button>
        <button type="button" className="btn-text" onClick={() => logout()}>
          {t('logout')}
        </button>
      </div>
    )
  }

  return (
    <div className="app">
      <TopBar
        me={me}
        friendIds={friendIds}
        sentIds={sentIds}
        onOpenProfile={openProfile}
        onAddFriend={addFriend}
        onHome={goHome}
        onLogout={logout}
        onOpenMessenger={() => setView({ type: 'messenger' })}
        activeView={view.type}
      />

      {view.type === 'messenger' ? (
        <MessengerPage me={me} friends={friends.map((f) => f.user)} onOpenProfile={openProfile} />
      ) : (
      <div className="layout">
        <LeftRail me={me} onOpenProfile={() => openProfile(me.id)} />

        <main className="center">
          {view.type === 'feed' ? (
            <>
              <Composer user={me} onCreated={handleCreated} />
              <Stories me={me} friends={friends} onOpenProfile={openProfile} />
              {feed.length === 0 ? (
                <div className="card empty-feed">
                  <h3>{t('yourFeedQuiet')}</h3>
                  <p>{t('feedQuietDesc')}</p>
                </div>
              ) : (
                feed.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={me.id}
                    onChange={patchPost}
                    onDelete={removePost}
                    onShared={handleShared}
                    onOpenProfile={openProfile}
                  />
                ))
              )}
              {feedHasMore && (
                <button type="button" className="btn-text load-more" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? t('loadingMore') : t('seeMorePosts')}
                </button>
              )}
            </>
          ) : (
            <ProfileView
              key={view.userId}
              profile={viewedProfile}
              posts={viewedPosts}
              loading={viewedLoading}
              isMe={view.userId === me.id}
              currentUserId={me.id}
              friendIds={friendIds}
              sentIds={sentIds}
              onBack={goHome}
              onEdit={() => setEditOpen(true)}
              onAddFriend={addFriend}
              onChange={patchPost}
              onDelete={removePost}
              onShared={handleShared}
              onOpenProfile={openProfile}
              onCreated={(post) => {
                handleCreated(post)
                setViewedPosts((prev) => [post, ...prev])
              }}
            />
          )}
        </main>

        <RightRail incoming={incoming} friends={friends} onAccept={accept} onDecline={decline} onOpenProfile={openProfile} />
      </div>
      )}

      {view.type !== 'messenger' && (
        <MiniChat
          me={me}
          friends={friends.map((f) => f.user)}
          onOpenProfile={openProfile}
          onOpenFullMessenger={() => setView({ type: 'messenger' })}
        />
      )}

      {editOpen && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setProfile(updated)
            if (view.type === 'profile' && view.userId === updated.id) setViewedProfile(updated)
            setEditOpen(false)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function TopBar({
  me,
  friendIds,
  sentIds,
  onOpenProfile,
  onAddFriend,
  onHome,
  onLogout,
  onOpenMessenger,
  activeView,
}: {
  me: UserSummary
  friendIds: Set<string>
  sentIds: Set<string>
  onOpenProfile: (id: string) => void
  onAddFriend: (id: string) => void
  onHome: () => void
  onLogout: () => void
  onOpenMessenger: () => void
  activeView: 'feed' | 'profile' | 'messenger'
}) {
  const { t, locale, setLocale } = useI18n()
  const { theme, toggleTheme } = useTheme()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSummary[]>([])
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    const id = window.setTimeout(() => {
      api
        .searchUsers(q)
        .then((r) => setResults(r))
        .catch(() => setResults([]))
    }, 300)
    return () => window.clearTimeout(id)
  }, [query])

  const tabs: { name: IconName; label: string }[] = [
    { name: 'home', label: t('home') },
    { name: 'watch', label: t('watch') },
    { name: 'groups', label: t('groups') },
  ]

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="brand-btn" onClick={onHome} aria-label={t('home')}>
          <img src="/brand/fakebook-minimal-cropped.png" alt="Fakebook" />
        </button>
        <div className="search-wrap">
          <label className="search-box">
            <Icon name="search" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setOpen(true)}
              onBlur={() => window.setTimeout(() => setOpen(false), 150)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
            />
          </label>
          {open && query.trim() && (
            <div className="search-results">
              {results.length === 0 ? (
                <p className="muted small pad">{t('noPeopleFound')}</p>
              ) : (
                results.map((r) => {
                  const isFriend = friendIds.has(r.id)
                  const isSent = sentIds.has(r.id)
                  const isMe = r.id === me.id
                  return (
                    <div className="search-row" key={r.id}>
                      <button type="button" className="search-id" onMouseDown={() => onOpenProfile(r.id)}>
                        <Avatar name={r.displayName} src={r.avatarUrl} size={36} />
                        <span>
                          <strong>{r.displayName}</strong>
                          <small>@{r.username}</small>
                        </span>
                      </button>
                      {!isMe && !isFriend && (
                        <button
                          type="button"
                          className="btn-soft sm"
                          disabled={isSent}
                          onMouseDown={() => onAddFriend(r.id)}
                        >
                          {isSent ? t('sent') : t('add')}
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>

      <nav className="topbar-tabs" aria-label={t('primaryNavLabel')}>
        {tabs.map((t) => {
          const isActive = t.name === 'home' && activeView === 'feed'
          return (
            <button
              key={t.name}
              type="button"
              className={`tab${isActive ? ' active' : ''}`}
              onClick={onHome}
              aria-label={t.label}
              title={t.label}
            >
              <Icon name={t.name} size={26} />
            </button>
          )
        })}
      </nav>

      <div className="topbar-right">
        <label className="lang-select" aria-label={t('languageLabel')}>
          <span>{t('languageLabel')}</span>
          <select value={locale} onChange={(e) => setLocale(e.target.value as typeof locale)}>
            {languageOptions.map((opt) => (
              <option key={opt.locale} value={opt.locale}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="icon-circle"
          aria-label={`${t('themeLabel')}: ${theme === 'dark' ? t('themeDark') : t('themeLight')}`}
          title={`${t('themeLabel')}: ${theme === 'dark' ? t('themeDark') : t('themeLight')}`}
          onClick={toggleTheme}
        >
          <Icon name="settings" size={20} />
        </button>
        <button type="button" className="icon-circle" aria-label="Menu">
          <Icon name="menu" size={20} />
        </button>
        <button
          type="button"
          className={`icon-circle${activeView === 'messenger' ? ' active' : ''}`}
          aria-label="Messenger"
          onClick={onOpenMessenger}
        >
          <Icon name="messenger" size={20} />
        </button>
        <button type="button" className="icon-circle" aria-label="Notifications">
          <Icon name="bell" size={20} />
        </button>
        <div className="account-wrap">
          <button type="button" className="account-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Account">
            <Avatar name={me.displayName} src={me.avatarUrl} size={40} />
            <span className="account-caret">
              <Icon name="caret" size={12} />
            </span>
          </button>
          {menuOpen && (
            <>
              <div className="menu-overlay" onClick={() => setMenuOpen(false)} />
              <div className="dropdown account-dropdown">
                <button
                  type="button"
                  onClick={() => {
                    onOpenProfile(me.id)
                    setMenuOpen(false)
                  }}
                >
                  <Avatar name={me.displayName} src={me.avatarUrl} size={36} />
                  <span className="acct-name">
                    <strong>{me.displayName}</strong>
                    <small>{t('seeYourProfile')}</small>
                  </span>
                </button>
                <div className="dropdown-divider" />
                <button type="button" className="danger" onClick={() => onLogout()}>
                  <Icon name="logout" size={18} /> {t('logout')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function LeftRail({ me, onOpenProfile }: { me: UserSummary; onOpenProfile: () => void }) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const items: { icon: IconName; label: string }[] = [
    { icon: 'friends', label: t('friends') },
    { icon: 'groups', label: t('groups') },
    { icon: 'watch', label: t('video') },
    { icon: 'bookmark', label: t('saved') },
    { icon: 'location', label: t('memories') },
    { icon: 'globe', label: t('pages') },
    { icon: 'settings', label: t('settingsPrivacy') },
  ]
  const shown = expanded ? items : items.slice(0, 5)
  return (
    <aside className="left-rail" aria-label="Shortcuts">
      <button type="button" className="rail-item" onClick={onOpenProfile}>
        <Avatar name={me.displayName} src={me.avatarUrl} size={36} />
        <span>{me.displayName}</span>
      </button>
      {shown.map((it) => (
        <button
          type="button"
          className="rail-item"
          key={it.label}
        >
          <span className="rail-icon">
            <Icon name={it.icon} size={22} />
          </span>
          <span>{it.label}</span>
        </button>
      ))}
      <button
        type="button"
        className={`rail-item see-more${expanded ? ' open' : ''}`}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="rail-icon see-more-icon">
          <Icon name="caret" size={22} />
        </span>
        <span>{expanded ? t('seeLess') : t('seeMore')}</span>
      </button>
      <div className="rail-footer">
        {t('footerLinks')}
      </div>
    </aside>
  )
}

function RightRail({
  incoming,
  friends,
  onAccept,
  onDecline,
  onOpenProfile,
}: {
  incoming: FriendRequestDto[]
  friends: FriendDto[]
  onAccept: (r: FriendRequestDto) => void
  onDecline: (r: FriendRequestDto) => void
  onOpenProfile: (id: string) => void
}) {
  const { t } = useI18n()

  return (
    <aside className="right-rail" aria-label="Friends">
      {incoming.length > 0 && (
        <section className="rail-section">
          <h2>{t('friendRequests')}</h2>
          {incoming.map((r) => (
            <div className="request" key={r.friendshipId}>
              <Avatar name={r.user.displayName} src={r.user.avatarUrl} size={48} onClick={() => onOpenProfile(r.user.id)} />
              <div className="request-body">
                <button type="button" className="request-name" onClick={() => onOpenProfile(r.user.id)}>
                  {r.user.displayName}
                </button>
                <span className="muted small">{timeAgo(r.createdAt)}</span>
                <div className="request-actions">
                  <button type="button" className="btn-primary sm" onClick={() => onAccept(r)}>
                    {t('confirm')}
                  </button>
                  <button type="button" className="btn-soft sm" onClick={() => onDecline(r)}>
                    {t('delete')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="rail-section bordered">
        <h2>{t('sponsored')}</h2>
        <button type="button" className="sponsored-ad">
          <img className="sponsored-thumb" src="https://picsum.photos/seed/fakebook-ad-merino/232/232" alt="" />
          <span className="sponsored-meta">
            <span className="sponsored-title">Merino Wool Sneakers</span>
            <span className="sponsored-domain">stride.co</span>
          </span>
        </button>
        <button type="button" className="sponsored-ad">
          <img className="sponsored-thumb" src="https://picsum.photos/seed/fakebook-ad-desk/232/232" alt="" />
          <span className="sponsored-meta">
            <span className="sponsored-title">Standing Desk, 40% off</span>
            <span className="sponsored-domain">deskhaus.com</span>
          </span>
        </button>
      </section>

      {/* Placeholder chrome: no birthday data on the user summary yet. */}
      <section className="rail-section bordered">
        <h2>{t('birthdays')}</h2>
        <div className="birthday">
          <span className="birthday-icon">
            <Icon name="gift" size={36} />
          </span>
          <p>
            <strong>Linh Tran</strong> and <strong>2 others</strong> have birthdays today.
          </p>
        </div>
      </section>

      <section className="rail-section">
        <h2>{t('contacts')}</h2>
        {friends.length === 0 ? (
          <p className="muted small">{t('noContactsYet')}</p>
        ) : (
          friends.map((f) => (
            <button type="button" className="contact" key={f.friendshipId} onClick={() => onOpenProfile(f.user.id)}>
              <Avatar name={f.user.displayName} src={f.user.avatarUrl} size={36} online />
              <span>{f.user.displayName}</span>
            </button>
          ))
        )}
      </section>
    </aside>
  )
}

function ProfileView({
  profile,
  posts,
  loading,
  isMe,
  currentUserId,
  friendIds,
  sentIds,
  onBack,
  onEdit,
  onAddFriend,
  onChange,
  onDelete,
  onShared,
  onOpenProfile,
  onCreated,
}: {
  profile: UserProfile | null
  posts: PostDto[]
  loading: boolean
  isMe: boolean
  currentUserId: string
  friendIds: Set<string>
  sentIds: Set<string>
  onBack: () => void
  onEdit: () => void
  onAddFriend: (id: string) => void
  onChange: (p: PostDto) => void
  onDelete: (id: string) => void
  onShared: (p: PostDto) => void
  onOpenProfile: (id: string) => void
  onCreated: (p: PostDto) => void
}) {
  const { t } = useI18n()

  if (loading || !profile) {
    return (
      <div className="boot inline">
        <span className="spinner" />
      </div>
    )
  }

  const isFriend = friendIds.has(profile.id)
  const isSent = sentIds.has(profile.id)

  return (
    <div className="profile-view">
      <div className="card profile-header">
        <div className="cover" />
        <div className="profile-id">
          <Avatar name={profile.displayName} src={profile.avatarUrl} size={148} className="profile-avatar" />
          <div className="profile-headline">
            <h1>{profile.displayName}</h1>
            <p className="muted">
              @{profile.username} · {profile.friendCount} {t('friends')} · {profile.postCount} {t('postsLabel')}
            </p>
          </div>
          <div className="profile-cta">
            {isMe ? (
              <button type="button" className="btn-primary" onClick={onEdit}>
                <Icon name="edit" size={16} /> {t('editProfile')}
              </button>
            ) : isFriend ? (
              <button type="button" className="btn-soft" disabled>
                <Icon name="check" size={16} /> {t('friends')}
              </button>
            ) : (
              <button type="button" className="btn-primary" disabled={isSent} onClick={() => onAddFriend(profile.id)}>
                <Icon name="userPlus" size={16} /> {isSent ? t('requestSent') : t('addFriend')}
              </button>
            )}
            <button type="button" className="btn-soft" onClick={onBack}>
              {t('backToFeed')}
            </button>
          </div>
        </div>
        {(profile.bio || profile.location) && (
          <div className="profile-about">
            {profile.bio && <p>{profile.bio}</p>}
            {profile.location && (
              <p className="muted">
                <Icon name="location" size={14} /> {profile.location}
              </p>
            )}
          </div>
        )}
      </div>

      {isMe && <Composer user={{ id: profile.id, username: profile.username, displayName: profile.displayName, avatarUrl: profile.avatarUrl }} onCreated={onCreated} />}

      {posts.length === 0 ? (
        <div className="card empty-feed">
          <h3>{t('profileNoPosts')}</h3>
          <p>{isMe ? t('yourPostsEmpty') : t('userPostsEmpty', { name: firstName(profile.displayName) })}</p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            onChange={onChange}
            onDelete={onDelete}
            onShared={onShared}
            onOpenProfile={onOpenProfile}
          />
        ))
      )}
    </div>
  )
}

function EditProfileModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: UserProfile
  onClose: () => void
  onSaved: (p: UserProfile) => void
}) {
  const { t } = useI18n()
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [location, setLocation] = useState(profile.location ?? '')
  const [gender, setGender] = useState(profile.gender ?? '')
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!displayName.trim()) {
      setError(t('nameRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      let result = await api.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        location: location.trim(),
        gender: gender.trim(),
        birthDate: birthDate || null,
      })
      if ((avatarUrl.trim() || null) !== (profile.avatarUrl ?? null)) {
        result = await api.updateAvatar(avatarUrl.trim())
      }
      onSaved(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveProfileError'))
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <form className="modal edit-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal-head">
          <h2>{t('editProfileTitle')}</h2>
          <button type="button" className="icon-circle subtle" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className="modal-body edit-body">
          <div className="edit-avatar-row">
            <Avatar name={displayName || profile.displayName} src={avatarUrl || null} size={72} />
            <label className="field grow">
              <span>{t('avatarUrlLabel')}</span>
              <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
            </label>
          </div>
          <label className="field">
            <span>{t('nameLabel')}</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label className="field">
            <span>{t('bioLabel')}</span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
          </label>
          <div className="field-row">
            <label className="field">
              <span>{t('locationLabel')}</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} />
            </label>
            <label className="field">
              <span>{t('genderLabel')}</span>
              <select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">{t('genderPreferNot')}</option>
                <option value="Female">{t('genderFemale')}</option>
                <option value="Male">{t('genderMale')}</option>
                <option value="Custom">{t('genderCustom')}</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>{t('birthDateLabel')}</span>
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </label>
          {error && <p className="form-error">{error}</p>}
        </div>
        <footer className="modal-foot">
          <button type="submit" className="btn-primary block" disabled={busy}>
            {busy ? t('saving') : t('saveChanges')}
          </button>
        </footer>
      </form>
    </div>
  )
}
