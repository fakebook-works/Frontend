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
  { value: 1, label: 'Friends', icon: 'friends' },
  { value: 2, label: 'Only me', icon: 'lock' },
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

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

export function money(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

// Human countdown for an auction end timestamp. Reads "now" each call, so a
// component that re-renders on a timer shows a live value.
export function timeLeft(iso: string | null, labels?: { ended: string; left: string }): string {
  if (!iso) return ''
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return labels?.ended ?? 'Ended'
  const mins = Math.floor(ms / 60000)
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (days > 0) return (labels?.left ?? '{value} left').replace('{value}', `${days}d ${hours}h`)
  if (hours > 0) return (labels?.left ?? '{value} left').replace('{value}', `${hours}h ${m}m`)
  return (labels?.left ?? '{value} left').replace('{value}', `${m}m`)
}

export const LISTING_CATEGORIES: { value: number; label: string }[] = [
  { value: 1, label: 'Vehicles' },
  { value: 2, label: 'Electronics' },
  { value: 3, label: 'Home & Garden' },
  { value: 4, label: 'Clothing' },
  { value: 5, label: 'Toys & Games' },
  { value: 6, label: 'Sporting Goods' },
  { value: 7, label: 'Hobbies' },
  { value: 8, label: 'Property' },
  { value: 0, label: 'Other' },
]

export function categoryLabel(value: number): string {
  return LISTING_CATEGORIES.find((c) => c.value === value)?.label ?? 'Other'
}
