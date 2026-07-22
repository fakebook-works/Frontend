const OWN_UNSEEN_STORY_KEY_PREFIX = 'fakebook.own-unseen-stories.'

function storageKey(userId: string) {
  return `${OWN_UNSEEN_STORY_KEY_PREFIX}${userId}`
}

function readIds(userId: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(storageKey(userId))
    if (!raw) return []
    const value = JSON.parse(raw)
    return Array.isArray(value) ? value.map(String).filter(Boolean) : []
  } catch {
    return []
  }
}

function writeIds(userId: string, storyIds: Iterable<string>) {
  if (typeof window === 'undefined') return
  const ids = [...new Set([...storyIds].map(String).filter(Boolean))]
  try {
    if (ids.length === 0) window.sessionStorage.removeItem(storageKey(userId))
    else window.sessionStorage.setItem(storageKey(userId), JSON.stringify(ids))
  } catch {
    // Story state still updates in memory when storage is unavailable.
  }
}

export function rememberOwnUnseenStory(userId: string, storyId: string) {
  writeIds(userId, [storyId, ...readIds(userId)])
}

export function forgetOwnUnseenStory(userId: string, storyId: string) {
  const current = readIds(userId)
  const wasUnseen = current.includes(storyId)
  writeIds(userId, current.filter((id) => id !== storyId))
  return wasUnseen
}

export function reconcileOwnUnseenStories(userId: string, activeStoryIds: Iterable<string>) {
  const activeIds = new Set([...activeStoryIds].map(String))
  const ids = readIds(userId).filter((id) => activeIds.has(id))
  writeIds(userId, ids)
  return new Set(ids)
}
