import { useEffect, type RefObject } from 'react'
import { recordRecommendationImpressions, type RecommendationImpression } from '../api/social'

const MAX_BATCH_SIZE = 50
const MIN_VISIBLE_MS = 800
const MAX_RETRIES = 1
const MAX_REMEMBERED_IMPRESSIONS = 5_000

type PendingImpression = {
  item: RecommendationImpression
  attempts: number
  generation: number
}

const pending = new Map<string, PendingImpression>()
const sent = new Set<string>()
let flushTimer: number | null = null
let flushing = false
let activeViewerKey: string | null = null
let viewerGeneration = 0

function cancelScheduledFlush() {
  if (flushTimer !== null && typeof window !== 'undefined') window.clearTimeout(flushTimer)
  flushTimer = null
}

/**
 * Scope analytics state to the authenticated browser session without ever
 * putting the viewer identifier on the wire. Switching or ending an account
 * session drops queued work before another account can inherit it.
 */
export function setRecommendationImpressionViewer(viewerKey: string | null) {
  const normalized = viewerKey?.trim() || null
  if (normalized === activeViewerKey) return
  activeViewerKey = normalized
  viewerGeneration += 1
  cancelScheduledFlush()
  pending.clear()
  sent.clear()
}

function rememberSent(key: string) {
  sent.add(key)
  while (sent.size > MAX_REMEMBERED_IMPRESSIONS) {
    const oldest = sent.values().next().value as string | undefined
    if (!oldest) break
    sent.delete(oldest)
  }
}

export function createRecommendationSessionKey(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.()
  if (randomUuid) return randomUuid
  const randomPart = Math.random().toString(36).slice(2)
  return `r-${Date.now().toString(36)}-${randomPart}`.slice(0, 96)
}

function scheduleFlush(delay = 250) {
  if (typeof window === 'undefined' || flushTimer !== null || pending.size === 0) return
  flushTimer = window.setTimeout(() => {
    flushTimer = null
    void flushRecommendationImpressions()
  }, delay)
}

export async function flushRecommendationImpressions(): Promise<void> {
  if (flushing || pending.size === 0 || activeViewerKey === null) return
  flushing = true
  const generation = viewerGeneration
  try {
    const entries = [...pending.entries()]
      .filter(([, value]) => value.generation === generation)
      .slice(0, MAX_BATCH_SIZE)
    entries.forEach(([key]) => pending.delete(key))
    if (entries.length === 0 || generation !== viewerGeneration || activeViewerKey === null) return
    try {
      const accepted = await recordRecommendationImpressions(entries.map(([, value]) => value.item))
      if (generation !== viewerGeneration) return
      if (accepted) {
        entries.forEach(([key]) => rememberSent(key))
      } else {
        requeue(entries, generation)
      }
    } catch {
      requeue(entries, generation)
    }
  } finally {
    flushing = false
    if (pending.size > 0) scheduleFlush(1000)
  }
}

function requeue(entries: Array<[string, PendingImpression]>, generation: number) {
  if (generation !== viewerGeneration || activeViewerKey === null) return
  entries.forEach(([key, value]) => {
    if (value.generation !== generation || value.attempts >= MAX_RETRIES || sent.has(key)) return
    pending.set(key, { ...value, attempts: value.attempts + 1 })
  })
}

/** Queue one impression using an opaque per-session key. The viewer identity is
 * intentionally absent; the Gateway/SocialGraph derive it from the session. */
export function queueRecommendationImpression(
  targetId: string,
  sessionKey: string,
  dwellMs = MIN_VISIBLE_MS,
  completionPct?: number,
) {
  const normalizedSessionKey = sessionKey.trim()
  if (activeViewerKey === null || !/^\d+$/.test(String(targetId)) || !normalizedSessionKey || normalizedSessionKey.length > 96) return
  const key = `${normalizedSessionKey}:${targetId}`
  if (sent.has(key) || pending.has(key)) return
  pending.set(key, {
    item: {
      targetId: String(targetId),
      idempotencyKey: key.slice(0, 128),
      dwellMs: Math.max(0, Math.min(900_000, Math.trunc(dwellMs))),
      ...(completionPct == null ? {} : { completionPct: Math.max(0, Math.min(100, completionPct)) }),
    },
    attempts: 0,
    generation: viewerGeneration,
  })
  if (pending.size >= MAX_BATCH_SIZE) void flushRecommendationImpressions()
  else scheduleFlush()
}

/** Observe actual visibility rather than render/mount. This prevents hidden
 * tabs, prefetched cards and fast scroll-throughs from becoming impressions. */
export function useRecommendationImpression(
  targetRef: RefObject<HTMLElement | null>,
  targetId: string | undefined,
  sessionKey: string | undefined,
  threshold = 0.5,
) {
  useEffect(() => {
    if (!targetId || !sessionKey || typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return
    const element = targetRef.current
    if (!element) return
    let visibleSince: number | null = null
    let timer: number | null = null
    let recorded = false
    let intersecting = false
    const clearTimer = () => {
      if (timer !== null) window.clearTimeout(timer)
      timer = null
      visibleSince = null
    }
    const beginTiming = () => {
      if (!intersecting || recorded || document.visibilityState !== 'visible' || visibleSince !== null) return
      visibleSince = Date.now()
      timer = window.setTimeout(() => {
        if (visibleSince === null || document.visibilityState !== 'visible' || !intersecting) {
          clearTimer()
          return
        }
        const dwellMs = Date.now() - visibleSince
        queueRecommendationImpression(targetId, sessionKey, dwellMs)
        recorded = true
        clearTimer()
      }, MIN_VISIBLE_MS)
    }
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = Boolean(entry?.isIntersecting && entry.intersectionRatio >= threshold)
      if (!intersecting) clearTimer()
      else beginTiming()
    }, { threshold: [threshold] })
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') clearTimer()
      else beginTiming()
    }
    observer.observe(element)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearTimer()
    }
  }, [sessionKey, targetId, targetRef, threshold])
}
