import { socialApi, type SocialComment } from '../api/social'

export interface CommentPage {
  items: SocialComment[]
  endCursor: string | null
  hasNextPage: boolean
}

interface CachedCommentPage {
  viewerId: string
  targetId: string
  limit: number
  createdAt: number
  lastAccessedAt: number
  request: Promise<CommentPage>
  data?: CommentPage
}

const PREFETCH_TTL_MS = 60_000
const MAX_PREFETCHED_PAGES = 12
const prefetchedPages = new Map<string, CachedCommentPage>()

function cacheKey(viewerId: string, targetId: string, limit: number) {
  return JSON.stringify([viewerId, targetId, limit])
}

function isFresh(entry: CachedCommentPage) {
  return Date.now() - entry.createdAt <= PREFETCH_TTL_MS
}

function touchEntry(key: string, entry: CachedCommentPage) {
  entry.lastAccessedAt = Date.now()
  prefetchedPages.delete(key)
  prefetchedPages.set(key, entry)
}

function trimCache() {
  while (prefetchedPages.size > MAX_PREFETCHED_PAGES) {
    const oldestKey = prefetchedPages.keys().next().value as string | undefined
    if (!oldestKey) return
    prefetchedPages.delete(oldestKey)
  }
}

function currentEntry(viewerId: string, targetId: string, limit: number) {
  const key = cacheKey(viewerId, targetId, limit)
  const entry = prefetchedPages.get(key)
  if (!entry) return { key, entry: null }
  if (!isFresh(entry)) {
    prefetchedPages.delete(key)
    return { key, entry: null }
  }
  touchEntry(key, entry)
  return { key, entry }
}

function ensureCommentPage(viewerId: string, targetId: string, limit: number) {
  const cached = currentEntry(viewerId, targetId, limit)
  if (cached.entry) return cached.entry

  const entry: CachedCommentPage = {
    viewerId,
    targetId,
    limit,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    request: socialApi.getComments(targetId, limit, null),
  }
  entry.request = entry.request.then((page) => {
    if (prefetchedPages.get(cached.key) === entry) {
      entry.data = page
      entry.createdAt = Date.now()
      touchEntry(cached.key, entry)
    }
    return page
  })
  prefetchedPages.set(cached.key, entry)
  trimCache()
  void entry.request.catch(() => {
    if (prefetchedPages.get(cached.key) === entry) prefetchedPages.delete(cached.key)
  })
  return entry
}

/** Warm only the first comments page and deduplicate it with the real reader. */
export function prefetchCommentPage(viewerId: string, targetId: string, limit = 30) {
  void ensureCommentPage(viewerId, targetId, limit).request.catch(() => undefined)
}

/** Read a completed first page synchronously so an already-warm sidebar never flashes a spinner. */
export function readCachedCommentPage(viewerId: string, targetId: string, limit = 30): CommentPage | null {
  return currentEntry(viewerId, targetId, limit).entry?.data ?? null
}

export async function loadCommentPage(viewerId: string, targetId: string, limit = 30, cursor: string | null = null): Promise<CommentPage> {
  if (cursor !== null) return socialApi.getComments(targetId, limit, cursor)
  return ensureCommentPage(viewerId, targetId, limit).request
}

export function clearPrefetchedCommentPage(targetId: string, viewerId?: string) {
  for (const [key, entry] of prefetchedPages) {
    if (entry.targetId === targetId && (!viewerId || entry.viewerId === viewerId)) prefetchedPages.delete(key)
  }
}

export function clearAllPrefetchedCommentPagesForTests() {
  prefetchedPages.clear()
}
