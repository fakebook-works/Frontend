export const POST_PRIVACY_VALUES = [0, 1, 2, 3] as const
export type PostPrivacy = typeof POST_PRIVACY_VALUES[number]

export function isPostPrivacy(value: number): value is PostPrivacy {
  return POST_PRIVACY_VALUES.includes(value as PostPrivacy)
}

export function defaultPostPrivacyKey(userId: string): string {
  return `fb.defaultPostPrivacy:${userId}`
}

export function readDefaultPostPrivacy(userId: string): PostPrivacy {
  const value = Number(localStorage.getItem(defaultPostPrivacyKey(userId)))
  return isPostPrivacy(value) ? value : 0
}

export function writeDefaultPostPrivacy(userId: string, value: number): PostPrivacy {
  const normalized = isPostPrivacy(value) ? value : 0
  localStorage.setItem(defaultPostPrivacyKey(userId), String(normalized))
  return normalized
}
