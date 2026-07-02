import { useMemo, useState } from 'react'
import type { UserSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'

interface NewConversationModalProps {
  friends: UserSummary[]
  onStart: (person: UserSummary) => void
  onClose: () => void
}

export function NewConversationModal({ friends, onStart, onClose }: NewConversationModalProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return friends
    return friends.filter(
      (f) => f.displayName.toLowerCase().includes(q) || f.username.toLowerCase().includes(q),
    )
  }, [friends, search])

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal msg-new-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2>New Message</h2>
          <button type="button" className="icon-circle subtle" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </header>

        <label className="msg-new-search">
          <span>To:</span>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search friends..."
          />
        </label>

        <div className="msg-new-list">
          {filtered.length === 0 ? (
            <p className="muted small pad">No friends found.</p>
          ) : (
            filtered.map((f) => (
              <button type="button" key={f.id} className="msg-new-row" onClick={() => onStart(f)}>
                <Avatar name={f.displayName} src={f.avatarUrl} size={40} online />
                <span className="msg-new-row-info">
                  <strong>{f.displayName}</strong>
                  <small>@{f.username}</small>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
