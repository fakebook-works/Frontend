import { useEffect, useState } from 'react'
import { socialApi, type SocialProfile } from '../api/social'
import type { UserSummary } from '../api/types'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'

export type FriendSection = 'home' | 'incoming' | 'outgoing' | 'friends' | 'blocked'

const ASSOCIATION: Record<Exclude<FriendSection, 'home'>, number> = {
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
  onMessage,
}: {
  userId: string
  section: FriendSection
  onNavigate: (path: string) => void
  onMessage?: (profileId: string) => Promise<void>
}) {
  const { t } = useI18n()
  const [people, setPeople] = useState<FriendCardModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    async function load() {
      try {
        if (section === 'home') {
          const suggestions = await socialApi.getFriendSuggestions(userId, 36)
          if (active) setPeople(suggestions)
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
        if (active) setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [section, t, userId])

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

  const sections: Array<{ id: FriendSection; path: string; label: string; icon: 'home' | 'userPlus' | 'clock' | 'friends' | 'block' }> = [
    { id: 'home', path: '/friends', label: t('friendsHome'), icon: 'home' },
    { id: 'incoming', path: '/friends/incoming', label: t('incomingRequests'), icon: 'userPlus' },
    { id: 'outgoing', path: '/friends/outgoing', label: t('sentRequests'), icon: 'clock' },
    { id: 'friends', path: '/friends/friends', label: t('allFriends'), icon: 'friends' },
    { id: 'blocked', path: '/friends/blocked', label: t('blockedPeople'), icon: 'block' },
  ]
  const title = section === 'home'
    ? t('friendSuggestionsTitle')
    : sections.find((item) => item.id === section)?.label ?? t('friends')
  const emptyState = section === 'home'
    ? { title: t('friendSuggestionsEmpty'), description: t('friendSuggestionsEmptyDesc') }
    : section === 'incoming'
      ? { title: t('incomingRequestsEmpty'), description: t('incomingRequestsEmptyDesc') }
      : section === 'outgoing'
        ? { title: t('sentRequestsEmpty'), description: t('sentRequestsEmptyDesc') }
        : section === 'friends'
          ? { title: t('allFriendsEmpty'), description: t('allFriendsEmptyDesc') }
          : { title: t('blockedPeopleEmpty'), description: t('blockedPeopleEmptyDesc') }

  return <main className="friends-page-layout">
    <aside className="friends-page-sidebar">
      <header><h1>{t('friends')}</h1></header>
      <nav aria-label={t('friends')}>
        {sections.map((item) => <button type="button" key={item.id} className={section === item.id ? 'active' : ''} onClick={() => onNavigate(item.path)}>
          <span><Icon name={item.icon} size={21} /></span><strong>{item.label}</strong>
        </button>)}
      </nav>
    </aside>

    <section className="friends-page-content">
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
    </section>
  </main>
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
      {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" loading="lazy" /> : <span><Avatar name={profile.displayName} size={96} /></span>}
    </button>
    <div className="friend-card-body">
      <div className="friend-card-name-area">
        <button type="button" className="friend-card-name" onClick={() => onNavigate(profilePath)}><strong>{profile.displayName}<VerifiedBadge verified={profile.isVerified} size={14} /></strong></button>
        <FriendProfilePopover profile={profile} mutualFriendCount={mutualFriendCount} mutualFriends={mutualFriends} showAdd={section === 'home'} busy={busy} onAdd={onAdd} onMessage={onMessage} onNavigate={onNavigate} />
      </div>
      <MutualFriendsLine count={mutualFriendCount} friends={mutualFriends} followerCount={profile.followerCount} />
      <div className="friend-card-actions">
        {section === 'home' && <><button type="button" className="primary" disabled={busy} onClick={onAdd}><Icon name="userPlus" size={18} />{t('addFriend')}</button><button type="button" disabled={busy} onClick={onDismiss}>{t('dismiss')}</button></>}
        {section === 'incoming' && <><button type="button" className="primary" disabled={busy} onClick={onAccept}>{t('confirm')}</button><button type="button" disabled={busy} onClick={() => onRemove('reject')}>{t('decline')}</button></>}
        {section === 'outgoing' && <button type="button" disabled={busy} onClick={() => onRemove('cancel')}>{t('cancel')}</button>}
        {section === 'friends' && <button type="button" disabled={busy} onClick={() => onRemove('unfriend')}>{t('removeFriend')}</button>}
        {section === 'blocked' && <button type="button" disabled={busy} onClick={() => onRemove('unblock')}>{t('unblock')}</button>}
      </div>
    </div>
  </article>
}

function MutualFriendsLine({ count, friends, followerCount }: { count: number; friends: UserSummary[]; followerCount: number }) {
  const { t } = useI18n()
  if (count <= 0) return <div className="friend-mutual-line empty">{followerCount > 0 ? t('followersCount', { count: followerCount }) : null}</div>
  return <div className="friend-mutual-line" tabIndex={0}>
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
      {showAdd && <button type="button" className="primary" disabled={busy} onClick={onAdd}><Icon name="userPlus" size={18} />{t('addFriend')}</button>}
      {onMessage && <button type="button" disabled={busy} onClick={() => void onMessage(profile.id)}><Icon name="messenger" size={18} />{t('messages')}</button>}
      <button type="button" aria-label={t('profile')} onClick={() => onNavigate(`/profile/${profile.id}`)}><Icon name="more" size={18} /></button>
    </footer>
  </aside>
}
