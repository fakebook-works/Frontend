import type { MessengerMessageDto } from '../../api/types'

export function MessageEditMarker({
  active,
  expanded,
  onClick,
}: {
  active: boolean
  expanded: boolean
  onClick: () => void
}) {
  return <button
    type="button"
    className={`message-edit-state-button${active ? ' active' : ''}${expanded ? ' expanded' : ''}`}
    onClick={onClick}
  >
    {active ? 'Đang được chỉnh sửa' : expanded ? 'Ẩn lịch sử chỉnh sửa' : 'Đã chỉnh sửa'}
  </button>
}

export function MessageEditHistory({
  revisions,
  compact = false,
}: {
  revisions: NonNullable<MessengerMessageDto['editHistory']>
  compact?: boolean
}) {
  if (revisions.length === 0) return null
  return <div className={`message-edit-history${compact ? ' compact' : ''}`} aria-label="Lịch sử chỉnh sửa">
    {revisions.map((revision, index) => <div className="message-edit-history-bubble" key={`${revision.versionAt}-${index}`}>
      {revision.text}
    </div>)}
  </div>
}

export function MessageEditingBar({
  message,
  compact = false,
  onCancel,
}: {
  message: MessengerMessageDto
  compact?: boolean
  onCancel: () => void
}) {
  return <div className={`message-reply-preview composer message-editing-preview${compact ? ' compact' : ''}`}>
    <span className="message-reply-copy">
      <strong>Đang chỉnh sửa</strong>
      <small>{message.body}</small>
    </span>
    <button type="button" aria-label="Huỷ chỉnh sửa" onClick={onCancel}>×</button>
  </div>
}
