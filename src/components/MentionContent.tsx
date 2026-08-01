import type { ReactNode } from 'react'
import { useI18n } from '../i18n'
import { parseMentionContent, type MentionDisplayUser } from '../lib/mentions'
import { extractWebUrls, toSafeWebUrl } from '../lib/urlMedia'

function LinkifiedText({ value, keyPrefix, onNavigate }: { value: string; keyPrefix: string; onNavigate?: (path: string) => void }) {
  const urls = extractWebUrls(value)
  if (urls.length === 0) return <>{value}</>
  const parts: ReactNode[] = []
  let cursor = 0
  urls.forEach((rawUrl, index) => {
    const offset = value.indexOf(rawUrl, cursor)
    if (offset < 0) return
    if (offset > cursor) parts.push(value.slice(cursor, offset))
    const url = toSafeWebUrl(rawUrl)
    if (!url) parts.push(rawUrl)
    else {
      const internal = typeof window !== 'undefined' && url.origin === window.location.origin
      parts.push(<a className="mention-content-link inline-content-link" href={url.href} key={`${keyPrefix}-url-${index}`} target={internal ? undefined : '_blank'} rel={internal ? undefined : 'noopener noreferrer'} referrerPolicy="no-referrer" onClick={internal && onNavigate ? (event) => { event.preventDefault(); event.stopPropagation(); onNavigate(`${url.pathname}${url.search}${url.hash}`) } : (event) => event.stopPropagation()}>{rawUrl}</a>)
    }
    cursor = offset + rawUrl.length
  })
  if (cursor < value.length) parts.push(value.slice(cursor))
  return <>{parts}</>
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
    return <button type="button" className="mention-content-link" key={`${segment.userId}-${index}`} onClick={(event) => { event.stopPropagation(); onNavigate(`/profile/${segment.userId}`) }}>{label}</button>
  })
}
