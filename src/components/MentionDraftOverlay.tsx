import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { parseHashtagText } from '../lib/hashtags'
import { parseMentionDraft, type MentionEntity } from '../lib/mentions'
import { extractWebUrls } from '../lib/urlMedia'

function DraftHashtagText({ value, keyPrefix }: { value: string; keyPrefix: string }) {
  const urls = extractWebUrls(value)
  const parts: ReactNode[] = []
  let cursor = 0

  const appendText = (text: string, prefix: string) => {
    parseHashtagText(text).forEach((segment, index) => {
      parts.push(segment.type === 'text'
        ? segment.value
        : <strong className="mention-draft-name hashtag-draft-name" key={`${prefix}-${index}`}>{segment.value}</strong>)
    })
  }

  urls.forEach((url, index) => {
    const offset = value.indexOf(url, cursor)
    if (offset < 0) return
    appendText(value.slice(cursor, offset), `${keyPrefix}-before-url-${index}`)
    parts.push(url)
    cursor = offset + url.length
  })
  appendText(value.slice(cursor), `${keyPrefix}-after-url`)
  return <>{parts}</>
}

function hasDraftHashtag(value: string): boolean {
  const urls = extractWebUrls(value)
  let cursor = 0
  for (const url of urls) {
    const offset = value.indexOf(url, cursor)
    if (offset < 0) continue
    if (parseHashtagText(value.slice(cursor, offset)).some((segment) => segment.type === 'hashtag')) return true
    cursor = offset + url.length
  }
  return parseHashtagText(value.slice(cursor)).some((segment) => segment.type === 'hashtag')
}

export function MentionDraftOverlay({ text, entities, textareaRef }: {
  text: string
  entities: readonly MentionEntity[]
  textareaRef: RefObject<HTMLTextAreaElement | null>
}) {
  const layerRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({})
  const draftSegments = parseMentionDraft(text, [...entities])
  const active = entities.length > 0 || draftSegments.some((segment) => segment.type === 'text' && hasDraftHashtag(segment.value))

  useLayoutEffect(() => {
    if (!active) return
    const textarea = textareaRef.current
    const layer = layerRef.current
    if (!textarea || !layer) return
    textarea.classList.add('mention-draft-input')

    const syncScroll = () => {
      layer.scrollTop = textarea.scrollTop
      layer.scrollLeft = textarea.scrollLeft
    }
    const syncGeometry = () => {
      const computed = window.getComputedStyle(textarea)
      setStyle({
        left: textarea.offsetLeft,
        top: textarea.offsetTop,
        width: textarea.offsetWidth,
        height: textarea.offsetHeight,
        boxSizing: computed.boxSizing as CSSProperties['boxSizing'],
        padding: computed.padding,
        borderWidth: computed.borderWidth,
        borderStyle: 'solid',
        borderColor: 'transparent',
        borderRadius: computed.borderRadius,
        fontFamily: computed.fontFamily,
        fontSize: computed.fontSize,
        fontStyle: computed.fontStyle,
        fontStretch: computed.fontStretch as CSSProperties['fontStretch'],
        fontWeight: computed.fontWeight,
        lineHeight: computed.lineHeight,
        letterSpacing: computed.letterSpacing,
        fontKerning: computed.fontKerning as CSSProperties['fontKerning'],
        fontVariantLigatures: computed.fontVariantLigatures as CSSProperties['fontVariantLigatures'],
        fontFeatureSettings: computed.fontFeatureSettings,
        wordSpacing: computed.wordSpacing,
        textAlign: computed.textAlign as CSSProperties['textAlign'],
        textIndent: computed.textIndent,
        textTransform: computed.textTransform as CSSProperties['textTransform'],
        tabSize: computed.tabSize,
      })
      syncScroll()
    }

    syncGeometry()
    textarea.addEventListener('scroll', syncScroll)
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncGeometry)
    resizeObserver?.observe(textarea)
    return () => {
      textarea.classList.remove('mention-draft-input')
      textarea.removeEventListener('scroll', syncScroll)
      resizeObserver?.disconnect()
    }
  }, [active, entities.length, text, textareaRef])

  if (!active) return null
  return <div ref={layerRef} className="mention-draft-overlay" style={style} aria-hidden="true">
    {draftSegments.map((segment, index) => segment.type === 'text'
      ? <DraftHashtagText value={segment.value} keyPrefix={`text-${index}`} key={`text-${index}`} />
      : <strong className="mention-draft-name" key={`${segment.entity.userId}-${segment.entity.start}-${index}`}>{segment.entity.displayName}</strong>)}
  </div>
}
