import { useMemo, useState } from 'react'
import type { UserSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { useI18n } from '../../i18n'

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return friends
    return friends.filter(
      (f) => f.displayName.toLowerCase().includes(q) || f.username.toLowerCase().includes(q),
    )
  }, [friends, search])

  function togglePerson(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function submitGroup() {
    const people = friends.filter((friend) => selectedIds.has(friend.id))
    if (!onCreateGroup || groupTitle.trim().length < 1 || people.length < 2) return
    onCreateGroup(groupTitle.trim(), people)
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal msg-new-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
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
            onChange={(e) => setGroupTitle(e.target.value)}
            placeholder={t('groupChatNamePlaceholder')}
          />
        </label>}

        <label className="msg-new-search">
          <span>{groupMode ? t('addPeople') : `${t('to')}:`}</span>
          <input
            autoFocus={!groupMode}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchFriends')}
          />
        </label>

        <div className="msg-new-list">
          {filtered.length === 0 ? (
            <p className="muted small pad">{t('noFriendsFound')}</p>
          ) : (
            filtered.map((f) => (
              <button type="button" key={f.id} className={`msg-new-row${selectedIds.has(f.id) ? ' selected' : ''}`} onClick={() => groupMode ? togglePerson(f.id) : onStart(f)}>
                <Avatar name={f.displayName} src={f.avatarUrl} size={40} online />
                <span className="msg-new-row-info">
                  <strong>{f.displayName}</strong>
                  <small>@{f.username}</small>
                </span>
                {groupMode && <span className="msg-new-check" aria-hidden="true">{selectedIds.has(f.id) ? '✓' : ''}</span>}
              </button>
            ))
          )}
        </div>
        {groupMode && <footer className="modal-foot"><span className="muted small">{t('selectedPeople', { count: selectedIds.size })}</span><button type="button" className="btn-primary" disabled={groupTitle.trim().length < 1 || selectedIds.size < 2} onClick={submitGroup}>{t('startGroupChat')}</button></footer>}
      </div>
    </div>
  )
}
