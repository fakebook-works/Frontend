import type { IconName } from '../components/Icon'

export interface ReactionMeta {
  type: number
  label: string
  emoji: string
  color: string
}

// Order matches Fakebook.Server/Domain/Enums.cs ReactionType.
export const REACTIONS: ReactionMeta[] = [
  { type: 0, label: 'Like', emoji: '👍', color: '#1877f2' },
  { type: 1, label: 'Love', emoji: '❤️', color: '#f3425f' },
  { type: 2, label: 'Haha', emoji: '😆', color: '#f7b125' },
  { type: 3, label: 'Wow', emoji: '😮', color: '#f7b125' },
  { type: 4, label: 'Sad', emoji: '😢', color: '#f7b125' },
  { type: 5, label: 'Angry', emoji: '😡', color: '#e9710f' },
]

export function reactionMeta(type: number | null | undefined): ReactionMeta | null {
  if (type == null) return null
  return REACTIONS.find((r) => r.type === type) ?? null
}

export interface PrivacyMeta {
  value: number
  label: string
  icon: IconName
}

export const PRIVACY: PrivacyMeta[] = [
  { value: 0, label: 'Public', icon: 'globe' },
  { value: 1, label: 'Friends and followers', icon: 'friends' },
  { value: 2, label: 'Friends', icon: 'user' },
  { value: 3, label: 'Only me', icon: 'lock' },
]

export function privacyMeta(value: number): PrivacyMeta {
  return PRIVACY.find((p) => p.value === value) ?? PRIVACY[0]
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || 'F'
}

export function timeAgo(value: string, labels?: { justNow: string; minuteShort: string; hourShort: string; dayShort: string; weekShort: string }): string {
  const then = new Date(value).getTime()
  const minutes = Math.floor((Date.now() - then) / 60000)
  if (Number.isNaN(minutes)) return ''
  if (minutes < 1) return labels?.justNow ?? 'Just now'
  if (minutes < 60) return (labels?.minuteShort ?? '{count}m').replace('{count}', String(minutes))
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return (labels?.hourShort ?? '{count}h').replace('{count}', String(hours))
  const days = Math.floor(hours / 24)
  if (days < 7) return (labels?.dayShort ?? '{count}d').replace('{count}', String(days))
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return (labels?.weekShort ?? '{count}w').replace('{count}', String(weeks))
  return new Date(value).toLocaleDateString()
}

export function relativeTime(value: string, locale = 'vi-VN', now = Date.now()): string {
  const then = new Date(value).getTime()
  if (!Number.isFinite(then)) return ''
  const elapsedSeconds = Math.max(0, Math.floor((now - then) / 1_000))
  if (elapsedSeconds < 60) return locale.toLowerCase().startsWith('vi') ? 'Vừa xong' : 'Just now'

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'always' })
  const minutes = Math.floor(elapsedSeconds / 60)
  if (minutes < 60) return formatter.format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return formatter.format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  if (days < 7) return formatter.format(-days, 'day')
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return formatter.format(-weeks, 'week')
  const months = Math.floor(days / 30)
  if (months < 12) return formatter.format(-Math.max(1, months), 'month')
  const years = Math.floor(days / 365)
  return formatter.format(-Math.max(1, years), 'year')
}

export function groupVisitRelativeTime(value: string, locale = 'vi-VN', now = Date.now()): string {
  const visitedAt = new Date(value).getTime()
  if (!Number.isFinite(visitedAt)) return ''
  const elapsedMinutes = Math.max(0, Math.floor((now - visitedAt) / 60_000))
  if (elapsedMinutes < 60 || elapsedMinutes >= 24 * 60) return relativeTime(value, locale, now)

  const completedHours = Math.floor(elapsedMinutes / 60)
  const extraMinutes = elapsedMinutes % 60
  const isVietnamese = locale.toLowerCase().startsWith('vi')
  if (extraMinutes < 15) {
    return isVietnamese
      ? `${completedHours} giờ trước`
      : `${completedHours} ${completedHours === 1 ? 'hour' : 'hours'} ago`
  }
  if (extraMinutes < 45) {
    return isVietnamese
      ? `khoảng ${completedHours} giờ trước`
      : `about ${completedHours} ${completedHours === 1 ? 'hour' : 'hours'} ago`
  }
  const nextHour = completedHours + 1
  return isVietnamese
    ? `gần ${nextHour} giờ trước`
    : `nearly ${nextHour} ${nextHour === 1 ? 'hour' : 'hours'} ago`
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}
