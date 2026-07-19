import { useState } from 'react'
import type { UserSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { useI18n } from '../../i18n'
import { useFriendSearch } from '../../lib/useFriendSearch'

interface NewConversationModalProps {
  friends: UserSummary[]
  onStart: (person: UserSummary) => void
  onCreateGroup?: (title: string, people: UserSummary[]) => void
  onClose: () => void
}

export function NewConversationModal({ friends, onStart, onCreateGroup, onClose }: NewConversationModalProps) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [groupMode, setGroupMode] = useState(false)
  const [groupTitle, setGroupTitle] = useState('')
  const [selectedPeople, setSelectedPeople] = useState<Map<string, UserSummary>>(new Map())
  const { people: visibleFriends, loading } = useFriendSearch(friends, search)

  function togglePerson(person: UserSummary) {
    setSelectedPeople((current) => {
      const next = new Map(current)
      if (next.has(person.id)) next.delete(person.id)
      else next.set(person.id, person)
      return next
    })
  }

  function submitGroup() {
    const people = [...selectedPeople.values()]
    if (!onCreateGroup || groupTitle.trim().length < 1 || people.length < 2) return
    onCreateGroup(groupTitle.trim(), people)
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal msg-new-modal"
        role="dialog"
        aria-modal="true"
        aria-label={groupMode ? t('newGroupChat') : t('newMessage')}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2>{groupMode ? t('newGroupChat') : t('newMessage')}</h2>
            <p className="muted small">{groupMode ? t('newGroupChatDesc') : t('newMessageDesc')}</p>
          </div>
          <div className="msg-new-head-actions">
            {onCreateGroup && <button type="button" className="btn-soft sm" onClick={() => setGroupMode((value) => !value)}>{groupMode ? t('directMessage') : t('createGroupChat')}</button>}
            <button type="button" className="icon-circle subtle" onClick={onClose} aria-label={t('close')}>
              <Icon name="close" size={20} />
            </button>
          </div>
        </header>

        {groupMode && <label className="msg-new-title">
          <span>{t('groupChatName')}</span>
          <input
            value={groupTitle}
            onChange={(event) => setGroupTitle(event.target.value)}
            placeholder={t('groupChatNamePlaceholder')}
          />
        </label>}

        <label className="msg-new-search">
          <span>{groupMode ? t('addPeople') : `${t('to')}:`}</span>
          <input
            autoFocus={!groupMode}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchFriends')}
          />
        </label>

        <div className="msg-new-list">
          {loading && visibleFriends.length === 0 ? (
            <div className="messenger-loading"><span className="spinner" /></div>
          ) : visibleFriends.length === 0 ? (
            <p className="muted small pad">{t('noFriendsFound')}</p>
          ) : visibleFriends.map((friend) => (
            <button
              type="button"
              key={friend.id}
              className={`msg-new-row${selectedPeople.has(friend.id) ? ' selected' : ''}`}
              onClick={() => groupMode ? togglePerson(friend) : onStart(friend)}
            >
              <Avatar name={friend.displayName} src={friend.avatarUrl} size={42} online />
              <span className="msg-new-row-info">
                <strong>{friend.displayName}</strong>
                <small>@{friend.username}</small>
              </span>
              {groupMode && <span className="msg-new-check" aria-hidden="true">{selectedPeople.has(friend.id) ? '✓' : ''}</span>}
            </button>
          ))}
        </div>

        {groupMode && <footer className="modal-foot">
          <span className="muted small">{t('selectedPeople', { count: selectedPeople.size })}</span>
          <button type="button" className="btn-primary" disabled={groupTitle.trim().length < 1 || selectedPeople.size < 2} onClick={submitGroup}>{t('startGroupChat')}</button>
        </footer>}
      </div>
    </div>
  )
}
