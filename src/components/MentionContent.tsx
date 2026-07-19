import type { ReactNode } from 'react'
import { useI18n } from '../i18n'
import { parseMentionContent, type MentionDisplayUser } from '../lib/mentions'

export function MentionContent({ content, mentions = [], onNavigate }: { content: string; mentions?: readonly MentionDisplayUser[]; onNavigate?: (path: string) => void }) {
  const { t } = useI18n()
  const users = new Map(mentions.map((mention) => [mention.userId, mention]))

  return parseMentionContent(content).map((segment, index): ReactNode => {
    if (segment.type === 'text') return segment.value
    const mention = users.get(segment.userId)
    const available = Boolean(mention?.available && mention.name)
    const label = available ? mention!.name : t('fakebookUser')
    if (!available || !onNavigate) return <strong className={`mention-content-name${available ? '' : ' unavailable'}`} key={`${segment.userId}-${index}`}>{label}</strong>
    return <button type="button" className="mention-content-link" key={`${segment.userId}-${index}`} onClick={(event) => { event.stopPropagation(); onNavigate(`/profile/${segment.userId}`) }}>{label}</button>
  })
}
