import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { UserSummary } from '../api/types'
import { Avatar } from './Avatar'
import { VerifiedBadge } from './VerifiedBadge'
import { useI18n } from '../i18n'
import { activeMentionAt, type ActiveMention } from '../lib/mentions'
import { textareaCaretCoordinates } from '../lib/textareaCaret'
import { useFriendSearch } from '../lib/useFriendSearch'

export function MentionSuggestions({
  text,
  people,
  textareaRef,
  caretIndex,
  onSelected,
  placement = 'below',
  limit = 6,
  className,
  fitToNames = false,
}: {
  text: string
  people: UserSummary[]
  textareaRef: RefObject<HTMLTextAreaElement | null>
  caretIndex: number
  onSelected: (person: UserSummary, mention: ActiveMention) => void
  placement?: 'above' | 'below'
  limit?: number
  className?: string
  fitToNames?: boolean
}) {
  const { t } = useI18n()
  const mention = activeMentionAt(text, caretIndex)
  const mentionStart = mention?.start ?? -1
  const [position, setPosition] = useState({ left: 4, top: 38, width: 240, maxHeight: 218 })
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const { people: friendMatches, loading } = useFriendSearch(people, mention?.query ?? '', Boolean(mention))
  const matches = useMemo(
    () => friendMatches.slice(0, Math.max(1, limit)),
    [friendMatches, limit],
  )
  const visibleRows = Math.max(1, matches.length)

  useLayoutEffect(() => {
    if (!fitToNames || !mention) {
      setMeasuredWidth(null)
      return
    }
    const renderedNameWidth = [...(popupRef.current?.querySelectorAll('strong') ?? [])]
      .reduce((widest, node) => Math.max(widest, node.scrollWidth), 0)
    const estimatedNameWidth = matches.reduce((widest, person) => Math.max(
      widest,
      person.displayName.length * 7.4 + (person.isVerified ? 18 : 0),
    ), 0)
    const nextWidth = Math.max(150, Math.min(320, Math.ceil(Math.max(renderedNameWidth, estimatedNameWidth) + 68)))
    setMeasuredWidth((current) => current === nextWidth ? current : nextWidth)
  }, [fitToNames, matches, mention])

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea || mentionStart < 0) return
    const updatePosition = () => {
      const anchor = textareaCaretCoordinates(textarea, mentionStart)
      const bounds = textarea.getBoundingClientRect()
      const availableWidth = textarea.clientWidth || bounds.width || 320
      const defaultWidth = Math.min(248, Math.max(190, availableWidth - 8))
      const width = fitToNames && measuredWidth
        ? Math.min(measuredWidth, Math.max(150, availableWidth - 8))
        : defaultWidth
      const localLeft = Math.max(4, Math.min(anchor.left, availableWidth - width - 4))
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth || availableWidth
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight || 640
      const left = Math.max(8, Math.min(bounds.left + localLeft, viewportWidth - width - 8))
      const estimatedHeight = visibleRows * 42 + Math.max(0, visibleRows - 1) + 10
      const top = placement === 'above'
        ? Math.max(8, bounds.top - estimatedHeight - 6)
        : Math.max(8, bounds.top + anchor.top + 3)
      const maxHeight = placement === 'above'
        ? estimatedHeight
        : Math.max(42, Math.min(218, viewportHeight - top - 8))
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
  }, [fitToNames, measuredWidth, mentionStart, placement, textareaRef, text, visibleRows])

  if (!mention) return null
  const popupClassName = ['mention-suggestions', placement === 'above' ? 'above' : '', className].filter(Boolean).join(' ')
  const popup = loading && matches.length === 0
    ? <div ref={popupRef} className={`${popupClassName} empty`} style={position}><span className="spinner" /></div>
    : matches.length === 0
      ? <div ref={popupRef} className={`${popupClassName} empty`} style={position}>{t('noFriendsFound')}</div>
      : <div ref={popupRef} className={popupClassName} style={position} role="listbox" aria-label={t('mentionPeople')}>{matches.map((person) => <button type="button" role="option" aria-selected="false" key={person.id} onMouseDown={(event) => event.preventDefault()} onClick={() => onSelected(person, mention)}><Avatar name={person.displayName} src={person.avatarUrl} size={30} /><span><strong>{person.displayName}<VerifiedBadge verified={person.isVerified} /></strong><small>{t('fakebookFriend')}</small></span></button>)}</div>
  return createPortal(popup, document.body)
}
