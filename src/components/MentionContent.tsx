import type { ReactNode } from 'react'
import { useI18n } from '../i18n'
import { parseHashtagText } from '../lib/hashtags'
import { parseMentionContent, type MentionDisplayUser } from '../lib/mentions'
import { extractWebUrls, toSafeWebUrl } from '../lib/urlMedia'

function HashtagText({ value, keyPrefix, onNavigate }: { value: string; keyPrefix: string; onNavigate?: (path: string) => void }) {
  return <>{parseHashtagText(value).map((segment, index) => {
    if (segment.type === 'text') return segment.value
    const path = `/search?q=${encodeURIComponent(segment.value)}&tab=posts`
    return (
      <a
        className="mention-content-link hashtag-content-link"
        href={path}
        key={`${keyPrefix}-hashtag-${index}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          if (!onNavigate) return
          event.preventDefault()
          onNavigate(path)
        }}
      >
        {segment.value}
      </a>
    )
  })}</>
}

function LinkifiedText({ value, keyPrefix, onNavigate }: { value: string; keyPrefix: string; onNavigate?: (path: string) => void }) {
  const urls = extractWebUrls(value)
  if (urls.length === 0) return <HashtagText value={value} keyPrefix={keyPrefix} onNavigate={onNavigate} />
  const parts: ReactNode[] = []
  let cursor = 0
  urls.forEach((rawUrl, index) => {
    const offset = value.indexOf(rawUrl, cursor)
    if (offset < 0) return
    if (offset > cursor) parts.push(<HashtagText value={value.slice(cursor, offset)} keyPrefix={`${keyPrefix}-before-url-${index}`} onNavigate={onNavigate} key={`${keyPrefix}-before-url-${index}`} />)
    const url = toSafeWebUrl(rawUrl)
    if (!url) parts.push(rawUrl)
    else {
      const internal = typeof window !== 'undefined' && url.origin === window.location.origin
      parts.push(<a className="mention-content-link inline-content-link" href={url.href} key={`${keyPrefix}-url-${index}`} target={internal ? undefined : '_blank'} rel={internal ? undefined : 'noopener noreferrer'} referrerPolicy="no-referrer" onPointerDown={(event) => event.stopPropagation()} onClick={internal && onNavigate ? (event) => { event.preventDefault(); event.stopPropagation(); onNavigate(`${url.pathname}${url.search}${url.hash}`) } : (event) => event.stopPropagation()}>{rawUrl}</a>)
    }
    cursor = offset + rawUrl.length
  })
  if (cursor < value.length) parts.push(<HashtagText value={value.slice(cursor)} keyPrefix={`${keyPrefix}-after-url`} onNavigate={onNavigate} key={`${keyPrefix}-after-url`} />)
  return <>{parts}</>
}

/** Renders safe URLs and hashtags for plain text surfaces such as Messenger. */
export function RichTextContent({ content, onNavigate }: { content: string; onNavigate?: (path: string) => void }) {
  return <LinkifiedText value={content} keyPrefix="plain" onNavigate={onNavigate} />
}

export function MentionContent({ content, mentions = [], onNavigate }: { content: string; mentions?: readonly MentionDisplayUser[]; onNavigate?: (path: string) => void }) {
  const { t } = useI18n()
  const users = new Map(mentions.map((mention) => [mention.userId, mention]))

  return parseMentionContent(content).map((segment, index): ReactNode => {
    if (segment.type === 'text') return <LinkifiedText value={segment.value} keyPrefix={String(index)} onNavigate={onNavigate} key={`text-${index}`} />
    const mention = users.get(segment.userId)
    const available = Boolean(mention?.available && mention.name)
    const label = available ? mention!.name : t('fakebookUser')
    if (!available || !onNavigate) return <strong className={`mention-content-name${available ? '' : ' unavailable'}`} key={`${segment.userId}-${index}`}>{label}</strong>
    return <button type="button" className="mention-content-link" key={`${segment.userId}-${index}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onNavigate(`/profile/${segment.userId}`) }}>{label}</button>
  })
}
