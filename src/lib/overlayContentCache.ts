import type { GatewayPost } from '../api/gatewayTypes'

const NAVIGATION_SEED_TTL_MS = 15_000

interface ViewerSnapshot {
  post: GatewayPost
  storedAt: number
}

const navigationSeeds = new Map<string, ViewerSnapshot>()

function snapshotKey(viewerId: string, contentId: string) {
  return `${viewerId}:${contentId}`
}

/**
 * Stages the projection only for the navigation the user has just initiated.
 * It is consumed once by the matching overlay and never used by pasted URLs.
 */
export function stageOverlayContent(viewerId: string, post: GatewayPost) {
  if (!viewerId || !post.id) return
  const key = snapshotKey(viewerId, post.id)
  navigationSeeds.set(key, { post, storedAt: Date.now() })
}

export function takeOverlayContent(viewerId: string, contentId: string) {
  const key = snapshotKey(viewerId, contentId)
  const snapshot = navigationSeeds.get(key)
  if (!snapshot) return null
  navigationSeeds.delete(key)
  return Date.now() - snapshot.storedAt <= NAVIGATION_SEED_TTL_MS ? snapshot.post : null
}

export function clearOverlayContentForViewer(viewerId: string) {
  const prefix = `${viewerId}:`
  for (const key of navigationSeeds.keys()) {
    if (key.startsWith(prefix)) navigationSeeds.delete(key)
  }
}
