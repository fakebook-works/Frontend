import { useCallback, useEffect, useState } from 'react'
import { socialApi, type SocialProfile } from '../api/social'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'

type FriendSection = 'friends' | 'incoming' | 'outgoing' | 'blocked'

const ASSOCIATION: Record<FriendSection, number> = {
  friends: 0,
  incoming: 2,
  outgoing: 1,
  blocked: 5,
}

export function FriendsPage({ userId, section, onNavigate }: { userId: string; section: FriendSection; onNavigate: (path: string) => void }) {
  const { t } = useI18n()
  const [people, setPeople] = useState<SocialProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPeople(await socialApi.getRelationProfiles(userId, ASSOCIATION[section]))
    } catch {
      setPeople([])
      setError(t('friendsLoadError'))
    } finally {
      setLoading(false)
    }
  }, [section, t, userId])

  useEffect(() => { void load() }, [load])

  async function accept(requesterId: string) {
    setBusyId(requesterId)
    try {
      await socialApi.acceptFriendRequest(requesterId, userId)
      setPeople((current) => current.filter((person) => person.id !== requesterId))
    } catch {
      setError(t('friendActionError'))
    } finally {
      setBusyId(null)
    }
  }

  async function remove(personId: string, action: 'reject' | 'cancel' | 'unfriend' | 'unblock') {
    setBusyId(personId)
    try {
      if (action === 'reject') await socialApi.rejectFriendRequest(personId, userId)
      if (action === 'cancel') await socialApi.cancelFriendRequest(userId, personId)
      if (action === 'unfriend') await socialApi.unfriend(userId, personId)
      if (action === 'unblock') await socialApi.unblockUser(userId, personId)
      setPeople((current) => current.filter((person) => person.id !== personId))
    } catch {
      setError(t('friendActionError'))
    } finally {
      setBusyId(null)
    }
  }

  const sections: Array<{ id: FriendSection; label: string; icon: 'friends' | 'userPlus' | 'clock' | 'lock' }> = [
    { id: 'friends', label: t('allFriends'), icon: 'friends' },
    { id: 'incoming', label: t('incomingRequests'), icon: 'userPlus' },
    { id: 'outgoing', label: t('sentRequests'), icon: 'clock' },
    { id: 'blocked', label: t('blockedPeople'), icon: 'lock' },
  ]
  return <main className="discovery-layout">
    <aside className="discovery-sidebar"><h1>{t('friends')}</h1><p>{t('friendsSubtitle')}</p><nav>{sections.map((item) => <button type="button" key={item.id} className={section === item.id ? 'active' : ''} onClick={() => onNavigate(`/friends/${item.id}`)}><span><Icon name={item.icon} size={20} /></span>{item.label}</button>)}</nav></aside>
    <section className="discovery-content">
      <header className="page-content-head"><div><h2>{sections.find((item) => item.id === section)?.label}</h2><p>{t('peopleCount', { count: people.length })}</p></div><button type="button" className="btn-soft" onClick={() => void load()}>{t('refresh')}</button></header>
      {loading ? <div className="card state-card"><span className="spinner" /></div> : error ? <div className="card state-card"><h2>{t('unableToLoad')}</h2><p>{error}</p><button type="button" className="btn-primary" onClick={() => void load()}>{t('tryAgain')}</button></div> : people.length === 0 ? <div className="card state-card"><h2>{t('friendListEmpty')}</h2><p>{t('friendListEmptyDesc')}</p></div> : <div className="people-grid">{people.map((person) => <article className="card person-card" key={person.id}><button type="button" className="person-card-profile" onClick={() => onNavigate(`/profile/${person.id}`)}><Avatar name={person.displayName} src={person.avatarUrl} size={92} /><strong>{person.displayName}<VerifiedBadge verified={person.isVerified} /></strong><small>{t('friendsCount', { count: person.friendCount })}</small></button><div className="person-card-actions">{section === 'incoming' && <><button type="button" className="btn-primary" onClick={() => void accept(person.id)} disabled={busyId === person.id}>{t('confirm')}</button><button type="button" className="btn-soft" onClick={() => void remove(person.id, 'reject')} disabled={busyId === person.id}>{t('decline')}</button></>}{section === 'outgoing' && <button type="button" className="btn-soft block" onClick={() => void remove(person.id, 'cancel')} disabled={busyId === person.id}>{t('cancel')}</button>}{section === 'friends' && <button type="button" className="btn-soft block" onClick={() => void remove(person.id, 'unfriend')} disabled={busyId === person.id}>{t('removeFriend')}</button>}{section === 'blocked' && <button type="button" className="btn-soft block" onClick={() => void remove(person.id, 'unblock')} disabled={busyId === person.id}>{t('unblock')}</button>}</div></article>)}</div>}
    </section>
  </main>
}
