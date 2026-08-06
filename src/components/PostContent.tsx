import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { MentionDisplayUser } from '../lib/mentions'
import { parseMentionContent } from '../lib/mentions'
import { MentionContent } from './MentionContent'
import { useI18n } from '../i18n'

/** Character-level boundaries for binary-search truncation. */
function contentBoundaries(content: string, mentions: readonly MentionDisplayUser[], unavailableLabel: string) {
  const users = new Map(mentions.map((m) => [m.userId, m]))
  const boundaries: Array<{ raw: string; display: string }> = [{ raw: '', display: '' }]
  let raw = ''
  let display = ''
  parseMentionContent(content).forEach((segment) => {
    if (segment.type === 'mention') {
      const mention = users.get(segment.userId)
      raw += `[[mention:${segment.userId}]]`
      display += mention?.available && mention.name ? mention.name : unavailableLabel
      boundaries.push({ raw, display })
      return
    }
    Array.from(segment.value).forEach((char) => {
      raw += char
      display += char
      boundaries.push({ raw, display })
    })
  })
  return boundaries
}

const POST_COLLAPSE_LINES = 5

export function PostContent({
  content,
  mentions,
  className,
  style,
  onNavigate,
}: {
  content: string
  mentions: readonly MentionDisplayUser[]
  className?: string
  style?: CSSProperties
  onNavigate?: (path: string) => void
}) {
  const { t } = useI18n()
  const rootRef = useRef<HTMLParagraphElement | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [collapsible, setCollapsible] = useState(false)
  const [collapsedContent, setCollapsedContent] = useState(content)

  // Reset when content changes (e.g. post edited)
  useEffect(() => {
    setExpanded(false)
    setCollapsedContent(content)
    setCollapsible(false)
  }, [content])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const measure = () => {
      const width = root.getBoundingClientRect().width || root.clientWidth

      // Fallback when not yet in DOM or zero-width (e.g. SSR / test env)
      if (width <= 0) {
        const lines = content.split(/\r?\n/).length
        const overflow = content.length > 300 || lines > POST_COLLAPSE_LINES
        setCollapsible(overflow)
        setCollapsedContent(overflow ? content.slice(0, 280).trimEnd() : content)
        return
      }

      const computed = window.getComputedStyle(root)
      const lineHeight =
        Number.parseFloat(computed.lineHeight) ||
        (Number.parseFloat(computed.fontSize) || 16) * 1.52

      // Probe element mirrors the paragraph's text metrics
      const probe = document.createElement('p')
      Object.assign(probe.style, {
        position: 'fixed',
        visibility: 'hidden',
        pointerEvents: 'none',
        inset: '0 auto auto -100000px',
        margin: '0',
        width: `${width}px`,
        font: computed.font,
        fontSize: computed.fontSize,
        fontWeight: computed.fontWeight,
        letterSpacing: computed.letterSpacing,
        lineHeight: computed.lineHeight,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
      })
      document.body.appendChild(probe)

      const boundaries = contentBoundaries(content, mentions, t('fakebookUser'))
      const fullDisplay = boundaries[boundaries.length - 1]?.display ?? ''
      probe.textContent = fullDisplay

      const maxHeight = lineHeight * POST_COLLAPSE_LINES + 0.5
      const overflowing = probe.scrollHeight > maxHeight

      if (!overflowing) {
        setCollapsible(false)
        setCollapsedContent(content)
        probe.remove()
        return
      }

      // Binary-search for the longest truncated version that still fits
      const suffix = `… ${t('seeMore')}`
      let low = 0
      let high = Math.max(0, boundaries.length - 1)
      while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        probe.textContent = `${boundaries[middle].display.trimEnd()}${suffix}`
        if (probe.scrollHeight <= maxHeight) low = middle
        else high = middle - 1
      }
      setCollapsible(true)
      setCollapsedContent(boundaries[low]?.raw.trimEnd() ?? '')
      probe.remove()
    }

    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(root)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [content, mentions, t])

  const visibleContent = expanded ? content : collapsedContent

  return (
    <p ref={rootRef} className={className} style={style}>
      <MentionContent content={visibleContent} mentions={mentions} onNavigate={onNavigate} />
      {collapsible && (
        <>
          {!expanded && <span aria-hidden="true">… </span>}
          <button
            type="button"
            className="post-content-toggle"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? t('seeLess') : t('seeMore')}
          </button>
        </>
      )}
    </p>
  )
}
