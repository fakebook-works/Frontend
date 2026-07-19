import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { parseMentionDraft, type MentionEntity } from '../lib/mentions'

export function MentionDraftOverlay({ text, entities, textareaRef }: {
  text: string
  entities: readonly MentionEntity[]
  textareaRef: RefObject<HTMLTextAreaElement | null>
}) {
  const layerRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({})

  useLayoutEffect(() => {
    if (entities.length === 0) return
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
        fontWeight: computed.fontWeight,
        lineHeight: computed.lineHeight,
        letterSpacing: computed.letterSpacing,
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
  }, [entities.length, text, textareaRef])

  if (entities.length === 0) return null
  return <div ref={layerRef} className="mention-draft-overlay" style={style} aria-hidden="true">
    {parseMentionDraft(text, [...entities]).map((segment, index) => segment.type === 'text'
      ? segment.value
      : <strong className="mention-draft-name" key={`${segment.entity.userId}-${segment.entity.start}-${index}`}>{segment.entity.displayName}</strong>)}
  </div>
}
