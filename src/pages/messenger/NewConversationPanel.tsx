import { useEffect, useMemo, useRef, useState } from 'react'
import type { UserSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { useI18n } from '../../i18n'
import { useFriendSearch } from '../../lib/useFriendSearch'

interface NewConversationPanelProps {
  friends: UserSummary[]
  creatorName: string
  onStart: (person: UserSummary) => void | Promise<void>
  onCreateGroup: (title: string, people: UserSummary[]) => void | Promise<void>
  onClose: () => void
}

const INITIAL_VISIBLE_FRIENDS = 8
const FRIEND_PAGE_STEP = 8

export function NewConversationPanel({ friends, creatorName, onStart, onCreateGroup, onClose }: NewConversationPanelProps) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [selectedPeople, setSelectedPeople] = useState<Map<string, UserSummary>>(new Map())
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_VISIBLE_FRIENDS)
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)
  const { people: visibleFriends, loading } = useFriendSearch(friends, search)
  const displayedFriends = useMemo(() => visibleFriends.slice(0, visibleLimit), [visibleFriends, visibleLimit])

  useEffect(() => setVisibleLimit(INITIAL_VISIBLE_FRIENDS), [search])

  function togglePerson(person: UserSummary) {
    if (submitting) return
    setSelectedPeople((current) => {
      const next = new Map(current)
      if (next.has(person.id)) next.delete(person.id)
      else next.set(person.id, person)
      return next
    })
  }

  async function submit() {
    const people = [...selectedPeople.values()]
    if (people.length === 0 || submitLock.current) return
    submitLock.current = true
    setSubmitting(true)
    try {
      if (people.length === 1) await onStart(people[0])
      else await onCreateGroup(t('defaultGroupChatName', { name: creatorName }), people)
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  return <section className="mini-chat-window new-conversation-window" role="dialog" aria-label={t('createConversation')}>
    <header className="mini-chat-head new-conversation-head"><strong>{t('createConversation')}</strong><button type="button" className="mini-ctrl" aria-label={t('close')} onClick={onClose}><Icon name="close" size={20} className="mini-chat-close-icon" /></button></header>
    <div className={`new-conversation-selected${selectedPeople.size === 0 ? ' empty' : ''}`} aria-label={t('selectedPeople', { count: selectedPeople.size })}>
      {selectedPeople.size === 0 ? <span>{t('chooseConversationPeople')}</span> : [...selectedPeople.values()].map((person) => <span className="new-conversation-chip" key={person.id}><Avatar name={person.displayName} src={person.avatarUrl} size={20} /><b>{person.displayName}</b><button type="button" aria-label={`${t('remove')} ${person.displayName}`} onClick={() => togglePerson(person)}><Icon name="close" size={12} /></button></span>)}
    </div>
    <div className="msg-new-list" onScroll={(event) => {
      const list = event.currentTarget
      if (list.scrollHeight - list.scrollTop - list.clientHeight <= 28 && visibleLimit < visibleFriends.length) setVisibleLimit((current) => Math.min(visibleFriends.length, current + FRIEND_PAGE_STEP))
    }}>
      {loading && visibleFriends.length === 0 ? <div className="messenger-loading"><span className="spinner" /></div> : visibleFriends.length === 0 ? <p className="muted small pad">{t('noFriendsFound')}</p> : displayedFriends.map((friend) => {
        const selected = selectedPeople.has(friend.id)
        return <button type="button" key={friend.id} className={`msg-new-row${selected ? ' selected' : ''}`} aria-pressed={selected} onClick={() => togglePerson(friend)}><Avatar name={friend.displayName} src={friend.avatarUrl} size={36} /><span className="msg-new-row-info"><strong>{friend.displayName}</strong><small>@{friend.username}</small></span><span className="msg-new-check" aria-hidden="true">{selected && <Icon name="check" size={14} />}</span></button>
      })}
    </div>
    <div className="new-conversation-compose"><label className="mini-compose-input"><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('searchFriends')} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }} /></label><button type="button" className="mini-compose-btn send ready" aria-label={t('confirmConversation')} disabled={selectedPeople.size === 0 || submitting} onClick={() => void submit()}><Icon name="send" size={21} /></button></div>
  </section>
}
