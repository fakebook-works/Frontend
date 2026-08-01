import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { socialApi } from '../api/social'
import { extractWebUrls, isDirectImageUrl, toSafeWebUrl } from '../lib/urlMedia'
import { Icon } from './Icon'
import { useI18n } from '../i18n'

interface PreviewData {
  title: string
  subtitle: string
  imageUrl: string | null
  href: string
}

function internalTarget(url: URL): { type: 'content' | 'group'; id: string } | null {
  const content = url.pathname.match(/^\/content\/([1-9]\d*)\/?$/)
  if (content) return { type: 'content', id: content[1] }
  const group = url.pathname.match(/^\/groups\/([1-9]\d*)\/?$/)
  return group ? { type: 'group', id: group[1] } : null
}

export function LinkPreview({ content, onNavigate }: { content: string; onNavigate?: (path: string) => void }) {
  const { t } = useI18n()
  const publicGroupLabel = t('publicGroup')
  const privateGroupLabel = t('privateGroup')
  const rawUrl = useMemo(() => extractWebUrls(content)[0] ?? '', [content])
  const safeUrl = useMemo(() => toSafeWebUrl(rawUrl), [rawUrl])
  const [preview, setPreview] = useState<PreviewData | null>(null)

  useEffect(() => {
    let active = true
    if (!safeUrl) {
      setPreview(null)
      return () => { active = false }
    }
    setPreview(null)
    const target = safeUrl.origin === window.location.origin ? internalTarget(safeUrl) : null
    if (target?.type === 'content') {
      api.postDetail(target.id).then((post) => {
        if (!active || !post) return
        const media = post.media[0] ?? post.sharedSource?.media[0] ?? null
        setPreview({ title: post.author.name, subtitle: safeUrl.hostname, imageUrl: media?.type === 0 ? media.url : null, href: safeUrl.href })
      }).catch(() => undefined)
    } else if (target?.type === 'group') {
      socialApi.getGroup(target.id).then((group) => {
        if (!active || !group) return
        setPreview({ title: group.name, subtitle: group.privacy === 0 ? publicGroupLabel : privateGroupLabel, imageUrl: group.backgroundUrl || group.avatarUrl, href: safeUrl.href })
      }).catch(() => undefined)
    } else {
      // Do not hot-link arbitrary external images: that would disclose every viewer's IP
      // address to the URL owner. Direct-image paste is imported through the bounded upload
      // pipeline instead; same-origin image links remain safe to preview directly.
      const sameOriginImage = safeUrl.origin === window.location.origin && isDirectImageUrl(safeUrl.href)
      setPreview({ title: safeUrl.hostname.replace(/^www\./, ''), subtitle: safeUrl.href, imageUrl: sameOriginImage ? safeUrl.href : null, href: safeUrl.href })
    }
    return () => { active = false }
  }, [privateGroupLabel, publicGroupLabel, safeUrl])

  if (!preview) return null
  const internal = safeUrl?.origin === window.location.origin
  return <a className="rich-link-preview" href={preview.href} target={internal ? undefined : '_blank'} rel={internal ? undefined : 'noopener noreferrer'} referrerPolicy="no-referrer" onClick={internal && onNavigate ? (event) => { event.preventDefault(); onNavigate(`${safeUrl.pathname}${safeUrl.search}${safeUrl.hash}`) } : undefined}>
    {preview.imageUrl ? <img src={preview.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true }} /> : <span className="rich-link-preview-icon"><Icon name="link" size={18} /></span>}
    <span><strong>{preview.title}</strong><small>{preview.subtitle}</small></span>
  </a>
}
