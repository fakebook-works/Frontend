import { useLayoutEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { UserSummary } from '../api/types'
import { Avatar } from './Avatar'
import { VerifiedBadge } from './VerifiedBadge'
import { useI18n } from '../i18n'
import { activeMentionAt, type ActiveMention } from '../lib/mentions'
import { textareaCaretCoordinates } from '../lib/textareaCaret'
import { useFriendSearch } from '../lib/useFriendSearch'

export function MentionSuggestions({ text, people, textareaRef, caretIndex, onSelected }: { text: string; people: UserSummary[]; textareaRef: RefObject<HTMLTextAreaElement | null>; caretIndex: number; onSelected: (person: UserSummary, mention: ActiveMention) => void }) {
  const { t } = useI18n()
  const mention = activeMentionAt(text, caretIndex)
  const mentionStart = mention?.start ?? -1
  const [position, setPosition] = useState({ left: 4, top: 38, width: 240, maxHeight: 218 })
  const { people: friendMatches, loading } = useFriendSearch(people, mention?.query ?? '', Boolean(mention))

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea || mentionStart < 0) return
    const updatePosition = () => {
      const anchor = textareaCaretCoordinates(textarea, mentionStart)
      const bounds = textarea.getBoundingClientRect()
      const availableWidth = textarea.clientWidth || bounds.width || 320
      const width = Math.min(248, Math.max(190, availableWidth - 8))
      const localLeft = Math.max(4, Math.min(anchor.left, availableWidth - width - 4))
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth || availableWidth
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight || 640
      const left = Math.max(8, Math.min(bounds.left + localLeft, viewportWidth - width - 8))
      const top = Math.max(8, bounds.top + anchor.top + 3)
      const maxHeight = Math.max(42, Math.min(218, viewportHeight - top - 8))
      setPosition({ left, top, width, maxHeight })
    }
    updatePosition()
    textarea.addEventListener('scroll', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      textarea.removeEventListener('scroll', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [mentionStart, textareaRef, text])

  if (!mention) return null
  const matches = friendMatches.slice(0, 6)
  const popup = loading && matches.length === 0
    ? <div className="mention-suggestions empty" style={position}><span className="spinner" /></div>
    : matches.length === 0
      ? <div className="mention-suggestions empty" style={position}>{t('noFriendsFound')}</div>
      : <div className="mention-suggestions" style={position} role="listbox" aria-label={t('mentionPeople')}>{matches.map((person) => <button type="button" role="option" aria-selected="false" key={person.id} onMouseDown={(event) => event.preventDefault()} onClick={() => onSelected(person, mention)}><Avatar name={person.displayName} src={person.avatarUrl} size={30} /><span><strong>{person.displayName}<VerifiedBadge verified={person.isVerified} /></strong><small>{t('fakebookFriend')}</small></span></button>)}</div>
  return createPortal(popup, document.body)
}
