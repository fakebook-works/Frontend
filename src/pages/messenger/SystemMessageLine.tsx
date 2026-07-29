import type { MessengerMessageDto } from '../../api/types'
import { useI18n } from '../../i18n'
import { formatTime, systemMessageLabel } from './helpers'

export function SystemMessageLine({
  message,
  viewerId,
  compact = false,
}: {
  message: MessengerMessageDto
  viewerId: string
  compact?: boolean
}) {
  const { t } = useI18n()
  return <div
    className={`message-system-line${compact ? ' compact' : ''}`}
    data-message-id={message.id}
    title={formatTime(message.createdAt)}
  >
    {systemMessageLabel(message, viewerId, t)}
  </div>
}
