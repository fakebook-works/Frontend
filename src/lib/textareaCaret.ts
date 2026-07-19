const MIRRORED_PROPERTIES = [
  'boxSizing',
  'width',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
] as const

export interface TextareaCaretCoordinates {
  left: number
  top: number
  lineHeight: number
}

export function textareaCaretCoordinates(textarea: HTMLTextAreaElement, index: number): TextareaCaretCoordinates {
  const style = window.getComputedStyle(textarea)
  const mirror = document.createElement('div')
  mirror.setAttribute('aria-hidden', 'true')
  mirror.style.position = 'fixed'
  mirror.style.left = '-10000px'
  mirror.style.top = '0'
  mirror.style.visibility = 'hidden'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.overflowWrap = 'break-word'
  mirror.style.wordBreak = 'normal'
  mirror.style.overflow = 'hidden'
  for (const property of MIRRORED_PROPERTIES) {
    mirror.style.setProperty(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), style[property])
  }
  mirror.style.width = `${textarea.offsetWidth || textarea.clientWidth}px`

  mirror.textContent = textarea.value.slice(0, Math.max(0, Math.min(index, textarea.value.length)))
  const marker = document.createElement('span')
  marker.textContent = textarea.value.slice(index, index + 1) || '\u200b'
  mirror.append(marker)
  document.body.append(mirror)

  const fontSize = Number.parseFloat(style.fontSize) || 16
  const parsedLineHeight = Number.parseFloat(style.lineHeight)
  const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.2
  const coordinates = {
    left: marker.offsetLeft - textarea.scrollLeft,
    top: marker.offsetTop - textarea.scrollTop + lineHeight,
    lineHeight,
  }
  mirror.remove()
  return coordinates
}
