import { initials } from '../lib/format'

interface AvatarProps {
  name: string
  src?: string | null
  size?: number
  online?: boolean
  className?: string
  onClick?: () => void
}

export function Avatar({ name, src, size = 40, online = false, className, onClick }: AvatarProps) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) }
  const classes = ['avatar', className, onClick ? 'avatar-clickable' : null].filter(Boolean).join(' ')
  const inner = src ? <img src={src} alt="" /> : <span>{initials(name)}</span>

  if (onClick) {
    return (
      <button type="button" className={classes} style={style} onClick={onClick} aria-label={name} title={name}>
        {inner}
        {online && <i className="avatar-dot" aria-hidden="true" />}
      </button>
    )
  }

  return (
    <span className={classes} style={style} aria-label={name} title={name}>
      {inner}
      {online && <i className="avatar-dot" aria-hidden="true" />}
    </span>
  )
}
