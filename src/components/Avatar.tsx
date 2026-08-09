import { useState } from 'react'
import { initials } from '../lib/format'

export const DEFAULT_AVATAR_URL = '/default-avatar.jpg'

export function isDefaultAvatarUrl(source?: string | null) {
  const value = source?.trim()
  if (!value) return false
  try {
    return new URL(value, window.location.origin).pathname.endsWith(DEFAULT_AVATAR_URL)
  } catch {
    return value.endsWith(DEFAULT_AVATAR_URL)
  }
}

interface AvatarProps {
  name: string
  src?: string | null
  size?: number
  online?: boolean
  className?: string
  onClick?: () => void
  title?: string | false
  loading?: 'eager' | 'lazy'
  fallback?: 'avatar' | 'initials'
}

export function Avatar({ name, src, size = 40, online = false, className, onClick, title = name, loading = 'lazy', fallback = 'avatar' }: AvatarProps) {
  const [failedSources, setFailedSources] = useState<ReadonlySet<string>>(() => new Set())
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) }
  const classes = ['avatar', fallback === 'initials' ? 'avatar-initials-fallback' : null, className, onClick ? 'avatar-clickable' : null].filter(Boolean).join(' ')
  const requestedSource = src?.trim() || null
  const entitySource = fallback === 'initials' && isDefaultAvatarUrl(requestedSource) ? null : requestedSource
  const imageSource = entitySource && !failedSources.has(entitySource)
    ? entitySource
    : fallback === 'avatar' && !failedSources.has(DEFAULT_AVATAR_URL)
      ? DEFAULT_AVATAR_URL
      : null
  const inner = imageSource
    ? <img src={imageSource} alt="" loading={loading} decoding="async" onError={() => setFailedSources((current) => new Set(current).add(imageSource))} />
    : <span>{initials(name)}</span>

  if (onClick) {
    return (
      <button type="button" className={classes} style={style} onClick={onClick} aria-label={name} title={title || undefined}>
        {inner}
        {online && <i className="avatar-dot" aria-hidden="true" />}
      </button>
    )
  }

  return (
    <span className={classes} style={style} aria-label={name} title={title || undefined}>
      {inner}
      {online && <i className="avatar-dot" aria-hidden="true" />}
    </span>
  )
}
