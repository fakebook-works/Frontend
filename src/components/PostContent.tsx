import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { MentionDisplayUser } from '../lib/mentions'
import { buildMentionTruncationMap } from '../lib/mentionTruncation'
import { MentionContent } from './MentionContent'
import { useI18n } from '../i18n'

const POST_COLLAPSE_LINES = 5
const POST_MEASURE_ROOT_MARGIN = 720

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

  useLayoutEffect(() => {
    setExpanded(false)
    setCollapsedContent(content)
    setCollapsible(false)
  }, [content])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const visibilityTarget = root.closest<HTMLElement>('.gateway-post') ?? root
    const canObserveVisibility = typeof IntersectionObserver !== 'undefined'
    const gateOffscreenMeasurement = canObserveVisibility
      && visibilityTarget !== root
      && window.getComputedStyle(visibilityTarget).contentVisibility === 'auto'
    const boundaryMap = buildMentionTruncationMap(content, mentions, t('fakebookUser'))
    let probe: HTMLParagraphElement | null = null
    let lastMeasuredWidth = -1

    const ensureProbe = () => {
      if (probe) return probe
      probe = document.createElement('p')
      Object.assign(probe.style, {
        position: 'fixed',
        visibility: 'hidden',
        pointerEvents: 'none',
        inset: '0 auto auto -100000px',
        margin: '0',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
      })
      document.body.appendChild(probe)
      return probe
    }

    const targetNearViewport = () => {
      if (!gateOffscreenMeasurement) return true
      const bounds = visibilityTarget.getBoundingClientRect()
      if (bounds.width <= 0 && bounds.height <= 0) return false
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
      return bounds.bottom >= -POST_MEASURE_ROOT_MARGIN && bounds.top <= viewportHeight + POST_MEASURE_ROOT_MARGIN
    }

    const measure = (force = false, allowOffscreen = false) => {
      if (!allowOffscreen && !targetNearViewport()) return
      const outerWidth = root.getBoundingClientRect().width || root.clientWidth
      const computed = window.getComputedStyle(root)
      const horizontalPadding = (Number.parseFloat(computed.paddingLeft) || 0) + (Number.parseFloat(computed.paddingRight) || 0)
      const width = Math.max(0, outerWidth - horizontalPadding)

      if (!force && Math.abs(width - lastMeasuredWidth) < .5) return
      lastMeasuredWidth = width

      // Fallback when not yet in DOM or zero-width (e.g. SSR / test env)
      if (width <= 0) {
        const lines = content.split(/\r?\n/).length
        const overflow = content.length > 300 || lines > POST_COLLAPSE_LINES
        setCollapsible(overflow)
        setCollapsedContent(overflow ? content.slice(0, 280).trimEnd() : content)
        return
      }

      const lineHeight =
        Number.parseFloat(computed.lineHeight) ||
        (Number.parseFloat(computed.fontSize) || 16) * 1.52

      // Probe element mirrors the paragraph's text metrics
      const measurementProbe = ensureProbe()
      Object.assign(measurementProbe.style, {
        width: `${width}px`,
        font: computed.font,
        fontSize: computed.fontSize,
        fontWeight: computed.fontWeight,
        letterSpacing: computed.letterSpacing,
        lineHeight: computed.lineHeight,
      })
      measurementProbe.textContent = boundaryMap.display

      const maxHeight = lineHeight * POST_COLLAPSE_LINES + 0.5
      const overflowing = measurementProbe.scrollHeight > maxHeight

      if (!overflowing) {
        setCollapsible(false)
        setCollapsedContent(content)
        return
      }

      // Binary-search for the longest truncated version that still fits
      const suffix = `… ${t('seeMore')}`
      let low = 0
      let high = Math.max(0, boundaryMap.rawOffsets.length - 1)
      while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        const displayOffset = boundaryMap.displayOffsets[middle] ?? 0
        measurementProbe.textContent = `${boundaryMap.display.slice(0, displayOffset).trimEnd()}${suffix}`
        if (measurementProbe.scrollHeight <= maxHeight) low = middle
        else high = middle - 1
      }
      setCollapsible(true)
      const rawOffset = boundaryMap.rawOffsets[low] ?? 0
      setCollapsedContent(content.slice(0, rawOffset).trimEnd())
    }

    const intersectionObserver = gateOffscreenMeasurement
      ? new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) measure(true, true)
      }, { rootMargin: `${POST_MEASURE_ROOT_MARGIN}px 0px` })
      : null
    intersectionObserver?.observe(visibilityTarget)
    measure(true, !gateOffscreenMeasurement)
    const handleWindowResize = () => measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure())
    observer?.observe(root)
    if (!observer) window.addEventListener('resize', handleWindowResize)
    return () => {
      observer?.disconnect()
      intersectionObserver?.disconnect()
      if (!observer) window.removeEventListener('resize', handleWindowResize)
      probe?.remove()
    }
  }, [content, mentions, t])

  const visibleContent = expanded ? content : collapsedContent

  return (
    <p ref={rootRef} className={className} style={style}>
      <MentionContent content={visibleContent} mentions={mentions} onNavigate={onNavigate} />
      {collapsible && (
        <>
          {!expanded && <span aria-hidden="true">… </span>}
          {expanded && ' '}
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
