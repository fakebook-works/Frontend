import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react'
import { recordRecommendationImpressions, type RecommendationImpression } from '../api/social'
import { getCurrentAuthIdentity, subscribeAuthIdentityTransition } from './authIdentityBoundary'

const MAX_BATCH_SIZE = 50
const MIN_VISIBLE_MS = 800
const MIN_INTENTIONAL_SKIP_MS = 350
const INTENTIONAL_SCROLL_WINDOW_MS = 1_500
const STATIC_IDLE_MS = 60_000
const MAX_DWELL_MS = 15 * 60 * 1_000
const MAX_SAMPLE_GAP_MS = 2 * 60 * 1_000
const MAX_RETRIES = 1
const MAX_REMEMBERED_IMPRESSIONS = 5_000
const MAX_RECENT_TARGET_TIERS = 5_000
const MAX_SURFACE_SESSION_KEYS = 64
const IMPRESSION_DEDUPE_TTL_MS = 5 * 60_000

type PendingImpression = {
  item: RecommendationImpression
  attempts: number
  generation: number
  recentKey: string
}

export type RecommendationImpressionKind = 'post' | 'video' | 'video-post'

export interface RecommendationImpressionOptions {
  kind?: RecommendationImpressionKind
  overlay?: boolean
  /** Track only while this renderer owns the active surface (for example one Reel card). */
  active?: boolean
  /** A true -> false transition represents an explicit next/previous/scroll action. */
  intentionalDeactivation?: boolean
}

const pending = new Map<string, PendingImpression>()
const sent = new Map<string, number>()
const recentlyQueuedTargets = new Map<string, number>()
const surfaceSessionKeys = new Map<string, { bucket: number; key: string }>()
let flushTimer: number | null = null
let activeViewerKey: string | null = null
let viewerGeneration = 0
let viewerRequestAbortController: AbortController | null = null
const viewerStateSubscribers = new Set<() => void>()

function monotonicNow(): number {
  const value = globalThis.performance?.now?.()
  return Number.isFinite(value) ? value : Date.now()
}

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
  viewerRequestAbortController?.abort()
  viewerRequestAbortController = normalized && typeof AbortController !== 'undefined'
    ? new AbortController()
    : null
  activeViewerKey = normalized
  viewerGeneration += 1
  cancelScheduledFlush()
  pending.clear()
  sent.clear()
  recentlyQueuedTargets.clear()
  surfaceSessionKeys.clear()
  viewerStateSubscribers.forEach((subscriber) => subscriber())
}

// Bind telemetry directly to the authoritative auth-store transition. The
// callback runs before client.ts publishes a replacement token, so no timer,
// pagehide flush or stale retry can send account A's queue as account B.
setRecommendationImpressionViewer(getCurrentAuthIdentity())
subscribeAuthIdentityTransition((viewerKey) => {
  setRecommendationImpressionViewer(viewerKey)
})

function subscribeViewerState(subscriber: () => void): () => void {
  viewerStateSubscribers.add(subscriber)
  return () => viewerStateSubscribers.delete(subscriber)
}

function wasRecentlySent(key: string, now = monotonicNow()): boolean {
  const sentAt = sent.get(key)
  if (sentAt == null) return false
  if (now - sentAt < IMPRESSION_DEDUPE_TTL_MS) return true
  sent.delete(key)
  return false
}

function rememberSent(key: string) {
  const now = monotonicNow()
  // Refresh insertion order so the size bound behaves as an LRU even when a
  // key is acknowledged again near a window boundary.
  sent.delete(key)
  sent.set(key, now)
  while (sent.size > MAX_REMEMBERED_IMPRESSIONS) {
    const oldest = sent.keys().next().value as string | undefined
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

/** One organic surface session is shared by reusable cards, grids and overlays.
 * Concurrent/nested renderers additionally coordinate ownership below. */
export function getRecommendationSurfaceSessionKey(surface = 'content'): string {
  const normalized = surface.trim().slice(0, 32) || 'content'
  const bucket = Math.floor(Date.now() / (5 * 60_000))
  for (const [candidate, state] of surfaceSessionKeys) {
    if (state.bucket !== bucket) surfaceSessionKeys.delete(candidate)
  }
  const existing = surfaceSessionKeys.get(normalized)
  if (existing?.bucket === bucket) return existing.key
  const key = createRecommendationSessionKey()
  surfaceSessionKeys.set(normalized, { bucket, key })
  while (surfaceSessionKeys.size > MAX_SURFACE_SESSION_KEYS) {
    const oldest = surfaceSessionKeys.keys().next().value as string | undefined
    if (!oldest) break
    surfaceSessionKeys.delete(oldest)
  }
  return key
}

function scheduleFlush(delay = 250) {
  if (typeof window === 'undefined' || flushTimer !== null || pending.size === 0) return
  flushTimer = window.setTimeout(() => {
    flushTimer = null
    void flushRecommendationImpressions()
  }, delay)
}

export async function flushRecommendationImpressions(options: { keepalive?: boolean } = {}): Promise<void> {
  if (pending.size === 0 || activeViewerKey === null) return
  cancelScheduledFlush()
  const generation = viewerGeneration
  const signal = viewerRequestAbortController?.signal
  const entries = [...pending.entries()]
    .filter(([, value]) => value.generation === generation)
    .slice(0, MAX_BATCH_SIZE)
  entries.forEach(([key]) => pending.delete(key))
  if (entries.length === 0 || generation !== viewerGeneration || activeViewerKey === null) return

  try {
    const items = entries.map(([, value]) => value.item)
    const accepted = options.keepalive
      ? await recordRecommendationImpressions(items, { keepalive: true, signal })
      : await recordRecommendationImpressions(items, { signal })
    if (generation !== viewerGeneration) return
    if (accepted) entries.forEach(([key]) => rememberSent(key))
    else requeue(entries, generation)
  } catch {
    requeue(entries, generation)
  } finally {
    if (pending.size > 0) {
      if (options.keepalive) queueMicrotask(() => void flushRecommendationImpressions({ keepalive: true }))
      else scheduleFlush(1_000)
    }
  }
}

function requeue(entries: Array<[string, PendingImpression]>, generation: number) {
  if (generation !== viewerGeneration || activeViewerKey === null) return
  entries.forEach(([key, value]) => {
    if (value.generation !== generation || wasRecentlySent(key)) return
    if (value.attempts >= MAX_RETRIES) {
      recentlyQueuedTargets.delete(value.recentKey)
      return
    }
    pending.set(key, { ...value, attempts: value.attempts + 1 })
  })
}

function rememberRecentTargetTier(key: string, now: number) {
  recentlyQueuedTargets.delete(key)
  recentlyQueuedTargets.set(key, now)
  for (const [candidate, queuedAt] of recentlyQueuedTargets) {
    if (now - queuedAt >= IMPRESSION_DEDUPE_TTL_MS) recentlyQueuedTargets.delete(candidate)
  }
  while (recentlyQueuedTargets.size > MAX_RECENT_TARGET_TIERS) {
    const oldest = recentlyQueuedTargets.keys().next().value as string | undefined
    if (!oldest) break
    recentlyQueuedTargets.delete(oldest)
  }
}

/** Queue one impression using an opaque per-session key. The viewer identity is
 * intentionally absent; the Gateway/SocialGraph derive it from the session. */
export function queueRecommendationImpression(
  targetId: string,
  sessionKey: string,
  dwellMs = MIN_VISIBLE_MS,
  completionPct?: number,
  kind: RecommendationImpressionKind = 'post',
): boolean {
  const normalizedSessionKey = sessionKey.trim()
  if (activeViewerKey === null || !/^\d+$/.test(String(targetId)) || !normalizedSessionKey || normalizedSessionKey.length > 96) return false
  const boundedDwell = Math.max(0, Math.min(MAX_DWELL_MS, Math.trunc(dwellMs)))
  const boundedCompletion = completionPct == null ? 0 : Math.max(0, Math.min(100, completionPct))
  const tier = localMetricTier(kind, boundedDwell, boundedCompletion)
  const key = `${normalizedSessionKey}:${targetId}:${tier}`
  const now = monotonicNow()
  const recentKey = `${targetId}:${tier}`
  const recentlyQueuedAt = recentlyQueuedTargets.get(recentKey)
  if (wasRecentlySent(key, now) || pending.has(key) || (recentlyQueuedAt != null && now - recentlyQueuedAt < IMPRESSION_DEDUPE_TTL_MS)) return false
  const existingForTarget = [...pending.entries()].filter(([, value]) =>
    value.generation === viewerGeneration && value.item.targetId === String(targetId))
  if (existingForTarget.length > 0) {
    const strongestExistingRank = Math.max(...existingForTarget.map(([existingKey]) =>
      localTierRank(existingKey.slice(existingKey.lastIndexOf(':') + 1))))
    if (strongestExistingRank >= localTierRank(tier)) return false
    existingForTarget.forEach(([existingKey, existing]) => {
      pending.delete(existingKey)
      recentlyQueuedTargets.delete(existing.recentKey)
    })
  }
  pending.set(key, {
    item: {
      targetId: String(targetId),
      idempotencyKey: key.slice(0, 128),
      dwellMs: boundedDwell,
      ...(completionPct == null ? {} : { completionPct: boundedCompletion }),
    },
    attempts: 0,
    generation: viewerGeneration,
    recentKey,
  })
  if (pending.size >= MAX_BATCH_SIZE) void flushRecommendationImpressions()
  else scheduleFlush()
  rememberRecentTargetTier(recentKey, now)
  return true
}

function localMetricTier(kind: RecommendationImpressionKind, dwellMs: number, completionPct: number): string {
  if (kind === 'video') {
    if (dwellMs === 0 && completionPct === 0) return 'SEEN'
    if (dwellMs < 800 && completionPct < 10) return 'SKIP'
    if (completionPct < 25) return 'LOW'
    if (completionPct < 60) return 'MID'
    if (completionPct < 90) return 'HIGH'
    return 'COMPLETE'
  }
  if (kind === 'video-post') {
    if (dwellMs >= 300_000 && completionPct === 0) return 'IDLE'
    if (dwellMs < 800 && completionPct < 10) return 'SKIP'
    const postTier = dwellMs < 3_000 ? 'SHORT' : dwellMs < 15_000 ? 'READ' : 'DEEP'
    if (completionPct <= 0) return postTier
    const videoTier = completionPct < 25
      ? 'LOW'
      : completionPct < 60
        ? 'MID'
        : completionPct < 90
          ? 'HIGH'
          : 'COMPLETE'
    return localTierRank(videoTier) >= localTierRank(postTier) ? videoTier : postTier
  }
  if (dwellMs >= 300_000) return 'IDLE'
  if (dwellMs < 800) return 'FAST_SKIP'
  if (dwellMs < 3_000) return 'SHORT'
  if (dwellMs < 15_000) return 'READ'
  return 'DEEP'
}

function localTierRank(tier: string): number {
  return ({
    FAST_SKIP: 0,
    SKIP: 0,
    SHORT: 1,
    LOW: 1,
    READ: 2,
    MID: 3,
    DEEP: 3,
    HIGH: 4,
    COMPLETE: 5,
    SEEN: -1,
    IDLE: -2,
  } as Record<string, number>)[tier] ?? -1
}

// One lifecycle listener finalizes every mounted tracker first, then starts one
// keepalive Gateway batch in a microtask. This avoids the first hook beginning a
// request while later hooks have not queued their final samples yet.
const lifecycleFinalizers = new Set<() => void>()
let lifecycleInstalled = false
let lifecycleFlushQueued = false

function scheduleLifecycleFlush() {
  if (lifecycleFlushQueued) return
  lifecycleFlushQueued = true
  queueMicrotask(() => {
    lifecycleFlushQueued = false
    void flushRecommendationImpressions({ keepalive: true })
  })
}

function finalizeLifecycleTrackers() {
  lifecycleFinalizers.forEach((finalize) => finalize())
  scheduleLifecycleFlush()
}

function handlePageHide() {
  finalizeLifecycleTrackers()
}

function handleLifecycleVisibilityChange() {
  if (document.visibilityState !== 'visible') finalizeLifecycleTrackers()
}

function registerLifecycleFinalizer(finalize: () => void): () => void {
  lifecycleFinalizers.add(finalize)
  if (!lifecycleInstalled) {
    lifecycleInstalled = true
    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleLifecycleVisibilityChange)
  }
  return () => {
    lifecycleFinalizers.delete(finalize)
    if (lifecycleFinalizers.size === 0 && lifecycleInstalled) {
      lifecycleInstalled = false
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleLifecycleVisibilityChange)
    }
  }
}

// Attention is shared instead of installing wheel/focus/idle listeners for every card.
const attentionSubscribers = new Set<() => void>()
let attentionInstalled = false
let windowFocused = true
let lastUserInputAt = 0
let lastIntentionalScrollAt = Number.NEGATIVE_INFINITY
let attentionInputRevision = 0
let idleTimer: number | null = null

function clearIdleTimer() {
  if (idleTimer !== null && typeof window !== 'undefined') window.clearTimeout(idleTimer)
  idleTimer = null
}

function notifyAttentionSubscribers() {
  attentionSubscribers.forEach((subscriber) => subscriber())
}

function scheduleIdleTransition() {
  clearIdleTimer()
  if (!attentionInstalled || attentionSubscribers.size === 0) return
  const remaining = Math.max(0, STATIC_IDLE_MS - (monotonicNow() - lastUserInputAt))
  idleTimer = window.setTimeout(() => {
    idleTimer = null
    notifyAttentionSubscribers()
  }, remaining + 1)
}

function markUserInput(intentionalScroll = false) {
  const now = monotonicNow()
  lastUserInputAt = now
  attentionInputRevision += 1
  if (intentionalScroll) lastIntentionalScrollAt = now
  scheduleIdleTransition()
  notifyAttentionSubscribers()
}

function handleAttentionFocus() {
  windowFocused = true
  markUserInput()
}

function handleAttentionBlur() {
  windowFocused = false
  clearIdleTimer()
  notifyAttentionSubscribers()
}

function handleAttentionVisibilityChange() {
  if (document.visibilityState === 'visible') scheduleIdleTransition()
  else clearIdleTimer()
  notifyAttentionSubscribers()
}

function handlePointerOrKeyInput(event: Event) {
  const key = event instanceof KeyboardEvent ? event.key : ''
  const scrollKey = key === 'ArrowDown' || key === 'ArrowUp' || key === 'PageDown' || key === 'PageUp' || key === 'Home' || key === 'End' || key === ' '
  markUserInput(scrollKey)
}

function handleScrollIntent() {
  markUserInput(true)
}

function installAttentionListeners() {
  if (attentionInstalled) return
  attentionInstalled = true
  try {
    windowFocused = typeof document.hasFocus === 'function' ? document.hasFocus() : true
  } catch {
    // Non-browser/test documents may not implement focus state. Visibility is
    // still enforced, and real browsers always provide document.hasFocus().
    windowFocused = true
  }
  lastUserInputAt = monotonicNow()
  lastIntentionalScrollAt = Number.NEGATIVE_INFINITY
  window.addEventListener('focus', handleAttentionFocus)
  window.addEventListener('blur', handleAttentionBlur)
  document.addEventListener('visibilitychange', handleAttentionVisibilityChange)
  window.addEventListener('pointerdown', handlePointerOrKeyInput, { passive: true })
  window.addEventListener('keydown', handlePointerOrKeyInput)
  window.addEventListener('wheel', handleScrollIntent, { passive: true })
  window.addEventListener('touchmove', handleScrollIntent, { passive: true })
  scheduleIdleTransition()
}

function uninstallAttentionListeners() {
  if (!attentionInstalled) return
  attentionInstalled = false
  clearIdleTimer()
  window.removeEventListener('focus', handleAttentionFocus)
  window.removeEventListener('blur', handleAttentionBlur)
  document.removeEventListener('visibilitychange', handleAttentionVisibilityChange)
  window.removeEventListener('pointerdown', handlePointerOrKeyInput)
  window.removeEventListener('keydown', handlePointerOrKeyInput)
  window.removeEventListener('wheel', handleScrollIntent)
  window.removeEventListener('touchmove', handleScrollIntent)
}

function subscribeAttention(subscriber: () => void): () => void {
  attentionSubscribers.add(subscriber)
  installAttentionListeners()
  return () => {
    attentionSubscribers.delete(subscriber)
    if (attentionSubscribers.size === 0) uninstallAttentionListeners()
  }
}

function hasBaseAttention(): boolean {
  return document.visibilityState === 'visible' && windowFocused
}

function hasRecentStaticInput(): boolean {
  return monotonicNow() - lastUserInputAt <= STATIC_IDLE_MS
}

function hasRecentScrollIntent(): boolean {
  return monotonicNow() - lastIntentionalScrollAt <= INTENTIONAL_SCROLL_WINDOW_MS
}

// Prevent two simultaneously mounted views of the same target (for example an
// underlying feed card plus its detail overlay) from recording in parallel.
type TargetOwner = {
  token: symbol
  overlay: boolean
  retry: () => void
  preempt: () => TargetMetricHandoff
  acceptHandoff: (handoff: TargetMetricHandoff) => void
}

type VideoProgressHandoff = {
  playedContentMs: number
  durationMs: number
}

type TargetMetricHandoff = {
  exposureMs: number
  dwellMs: number
  videoProgress: Map<string, VideoProgressHandoff>
}

const targetOwners = new Map<string, TargetOwner>()
const targetWaiters = new Map<string, Set<() => void>>()

function removeTargetWaiter(targetId: string, retry: () => void) {
  const waiters = targetWaiters.get(targetId)
  if (!waiters) return
  waiters.delete(retry)
  if (waiters.size === 0) targetWaiters.delete(targetId)
}

function tryOwnTarget(targetId: string, owner: TargetOwner): boolean {
  const current = targetOwners.get(targetId)
  if (!current || current.token === owner.token) {
    targetOwners.set(targetId, owner)
    removeTargetWaiter(targetId, owner.retry)
    return true
  }
  if (owner.overlay && !current.overlay) {
    owner.acceptHandoff(current.preempt())
    const waiters = targetWaiters.get(targetId) ?? new Set<() => void>()
    waiters.add(current.retry)
    targetWaiters.set(targetId, waiters)
    targetOwners.set(targetId, owner)
    removeTargetWaiter(targetId, owner.retry)
    return true
  }
  const waiters = targetWaiters.get(targetId) ?? new Set<() => void>()
  waiters.add(owner.retry)
  targetWaiters.set(targetId, waiters)
  return false
}

function releaseTarget(targetId: string, owner: symbol, retry: () => void) {
  removeTargetWaiter(targetId, retry)
  if (targetOwners.get(targetId)?.token !== owner) return
  targetOwners.delete(targetId)
  const waiters = targetWaiters.get(targetId)
  if (!waiters || waiters.size === 0) {
    targetWaiters.delete(targetId)
    return
  }
  queueMicrotask(() => waiters.forEach((waiter) => waiter()))
}

function videoIsRenderable(video: HTMLVideoElement): boolean {
  if (!video.isConnected || video.hidden || video.closest('[hidden],[aria-hidden="true"]')) return false
  const style = window.getComputedStyle(video)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  const rect = video.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    // jsdom has no layout engine. A real zero-sized video is not visible and must
    // never accrue playback merely because it remains mounted in a carousel.
    return /jsdom/i.test(globalThis.navigator?.userAgent ?? '')
  }
  const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0))
  const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0))
  return visibleWidth * visibleHeight >= rect.width * rect.height * 0.5
}

/** Observe actual visibility rather than render/mount. Static posts accumulate
 * attentive dwell; video/Reel surfaces accumulate only active, visible playback.
 * Content kind on the trusted outbox remains server-derived after visibility checks. */
export function useRecommendationImpression(
  targetRef: RefObject<HTMLElement | null>,
  targetId: string | undefined,
  sessionKey: string | undefined,
  threshold = 0.5,
  options: RecommendationImpressionOptions = {},
) {
  const kind = options.kind ?? 'post'
  const overlay = options.overlay === true
  const active = options.active !== false
  const activeRef = useRef(active)
  const intentionalDeactivationRef = useRef(options.intentionalDeactivation === true)
  activeRef.current = active
  intentionalDeactivationRef.current = options.intentionalDeactivation === true
  const mountedViewerGeneration = useSyncExternalStore(
    subscribeViewerState,
    () => viewerGeneration,
    () => 0,
  )
  useEffect(() => {
    if (!active || !targetId || !sessionKey || typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return
    const element = targetRef.current
    if (!element) return

    const effectViewerGeneration = mountedViewerGeneration
    const tracksVideo = kind === 'video' || kind === 'video-post'
    const tracksStaticAttention = kind !== 'video'
    const owner = Symbol(targetId)
    let ownsTarget = false
    let intersecting = false
    let recorded = false
    let exposureStartedAt: number | null = null
    let metricStartedAt: number | null = null
    let exposureMs = 0
    let dwellMs = 0
    let staticInputRevisionAtSegmentStart = attentionInputRevision
    let staticSegmentStartDwellMs = 0
    let staticSegmentHadInput = false
    let staticIdleInvalidated = false
    let activeVideo: HTMLVideoElement | null = null
    const seekingVideos = new Set<HTMLVideoElement>()
    const bufferingVideos = new Set<HTMLVideoElement>()
    const videoProgress = new Map<HTMLVideoElement, { playedContentMs: number; lastCurrentTime: number | null; durationMs: number }>()
    const inheritedVideoProgress = new Map<string, VideoProgressHandoff>()

    const videoProgressKey = (video: HTMLVideoElement) => video.currentSrc || video.src || video.getAttribute('src') || ''

    const progressStateFor = (video: HTMLVideoElement) => {
      const existing = videoProgress.get(video)
      if (existing) return existing
      const duration = Number(video.duration)
      const inherited = inheritedVideoProgress.get(videoProgressKey(video))
      const state = {
        playedContentMs: inherited?.playedContentMs ?? 0,
        lastCurrentTime: null,
        durationMs: Number.isFinite(duration) && duration > 0 ? duration * 1_000 : inherited?.durationMs ?? 0,
      }
      videoProgress.set(video, state)
      return state
    }

    const suspendActiveVideo = () => {
      if (activeVideo) {
        const state = videoProgress.get(activeVideo)
        if (state) state.lastCurrentTime = null
      }
      activeVideo = null
    }

    const videoCanAccrue = (video: HTMLVideoElement) =>
      videoIsRenderable(video) &&
      !video.paused &&
      !video.ended &&
      !seekingVideos.has(video) &&
      !bufferingVideos.has(video)

    const playingVideo = () => {
      if (!tracksVideo) return null
      if (activeVideo && videoCanAccrue(activeVideo)) return activeVideo
      const candidates = element instanceof HTMLVideoElement
        ? [element]
        : [...element.querySelectorAll<HTMLVideoElement>('video')]
      return candidates.find(videoCanAccrue) ?? null
    }

    const addBoundedSample = (current: number, startedAt: number | null, now: number, multiplier = 1) => {
      if (startedAt === null) return current
      const elapsed = now - startedAt
      if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > MAX_SAMPLE_GAP_MS) return current
      return Math.min(MAX_DWELL_MS, current + elapsed * multiplier)
    }

    const snapshotTiming = (now = monotonicNow()) => {
      exposureMs = addBoundedSample(exposureMs, exposureStartedAt, now)
      dwellMs = addBoundedSample(dwellMs, metricStartedAt, now)
      exposureStartedAt = null
      metricStartedAt = null
    }

    const recordVideoProgress = (video: HTMLVideoElement) => {
      const currentTime = Number(video.currentTime)
      const duration = Number(video.duration)
      const existing = progressStateFor(video)
      if (existing.lastCurrentTime !== null && Number.isFinite(currentTime)) {
        const deltaSeconds = currentTime - existing.lastCurrentTime
        // Normal timeupdate cadence is far below this bound. Larger jumps are
        // seeks/background anomalies and must not manufacture completion.
        if (deltaSeconds >= 0 && deltaSeconds <= 5) {
          existing.playedContentMs = Math.min(MAX_DWELL_MS, existing.playedContentMs + deltaSeconds * 1_000)
        }
      }
      existing.lastCurrentTime = Number.isFinite(currentTime) ? currentTime : null
      if (Number.isFinite(duration) && duration > 0) existing.durationMs = duration * 1_000
      videoProgress.set(video, existing)
    }

    const startTiming = (now = monotonicNow()) => {
      if (recorded || !ownsTarget || !intersecting || !hasBaseAttention()) return
      exposureStartedAt = now
      if (tracksStaticAttention) {
        if (hasRecentStaticInput()) metricStartedAt = now
      }
      if (!tracksVideo) return
      const nextVideo = playingVideo()
      if (nextVideo && nextVideo !== activeVideo) {
        activeVideo = nextVideo
        const state = progressStateFor(nextVideo)
        state.lastCurrentTime = Number.isFinite(nextVideo.currentTime) ? nextVideo.currentTime : null
        if (Number.isFinite(nextVideo.duration) && nextVideo.duration > 0) state.durationMs = nextVideo.duration * 1_000
        videoProgress.set(nextVideo, state)
      }
      if (kind === 'video' && activeVideo && videoCanAccrue(activeVideo)) metricStartedAt = now
    }

    const syncTiming = () => {
      const now = monotonicNow()
      snapshotTiming(now)
      startTiming(now)
    }

    const completionPct = () => {
      if (!tracksVideo) return 0
      let maximum = 0
      videoProgress.forEach((state) => {
        if (state.durationMs > 0) maximum = Math.max(maximum, (state.playedContentMs / state.durationMs) * 100)
      })
      return Math.max(0, Math.min(100, maximum))
    }

    const finalize = (allowFastSkip = false, explicitIntent = false) => {
      snapshotTiming()
      if (recorded || effectViewerGeneration !== viewerGeneration) return
      const measuredDwell = Math.max(0, Math.min(MAX_DWELL_MS, Math.trunc(dwellMs)))
      const measuredExposure = Math.max(0, Math.min(MAX_DWELL_MS, Math.trunc(exposureMs)))
      const completion = completionPct()
      const intentionalFastSkip = allowFastSkip &&
        measuredExposure >= MIN_INTENTIONAL_SKIP_MS &&
        measuredExposure < MIN_VISIBLE_MS &&
        (tracksStaticAttention || measuredDwell >= 250 || completion >= 5) &&
        (explicitIntent || hasRecentScrollIntent())
      const completedShortVideo = tracksVideo && completion >= 80 && measuredExposure > 0
      const meaningfulVideoSeen = kind === 'video' && measuredExposure >= MIN_VISIBLE_MS
      const neutralStaticIdle = staticIdleInvalidated || (
        tracksStaticAttention &&
        staticSegmentStartDwellMs < MIN_VISIBLE_MS &&
        !staticSegmentHadInput &&
        !hasRecentStaticInput() &&
        measuredExposure >= MIN_VISIBLE_MS
      )
      if (measuredDwell < MIN_VISIBLE_MS && !intentionalFastSkip && !completedShortVideo && !meaningfulVideoSeen && !neutralStaticIdle) return
      recorded = true
      const semanticDwell = tracksStaticAttention && neutralStaticIdle ? 300_000 : measuredDwell
      const semanticCompletion = tracksStaticAttention && neutralStaticIdle ? 0 : completion
      queueRecommendationImpression(targetId, sessionKey, semanticDwell, tracksVideo ? semanticCompletion : 0, kind)
    }

    const metricHandoff = (): TargetMetricHandoff => {
      snapshotTiming()
      if (tracksVideo && activeVideo && ownsTarget && intersecting && hasBaseAttention() &&
        videoIsRenderable(activeVideo) && !seekingVideos.has(activeVideo) && !bufferingVideos.has(activeVideo)) {
        recordVideoProgress(activeVideo)
      }
      const transferredVideoProgress = new Map<string, VideoProgressHandoff>()
      videoProgress.forEach((state, video) => {
        const source = videoProgressKey(video)
        if (!source) return
        const previous = transferredVideoProgress.get(source)
        if (!previous || state.playedContentMs > previous.playedContentMs) {
          transferredVideoProgress.set(source, {
            playedContentMs: state.playedContentMs,
            durationMs: state.durationMs,
          })
        }
      })
      inheritedVideoProgress.forEach((state, source) => {
        const previous = transferredVideoProgress.get(source)
        if (!previous || state.playedContentMs > previous.playedContentMs) transferredVideoProgress.set(source, { ...state })
      })
      return { exposureMs, dwellMs, videoProgress: transferredVideoProgress }
    }

    const acceptMetricHandoff = (handoff: TargetMetricHandoff) => {
      // Handoffs contain only deltas already observed during active playback;
      // the destination's currentTime is never interpreted as watched content.
      exposureMs = Math.max(exposureMs, handoff.exposureMs)
      dwellMs = Math.max(dwellMs, handoff.dwellMs)
      handoff.videoProgress.forEach((state, source) => {
        const previous = inheritedVideoProgress.get(source)
        if (!previous || state.playedContentMs > previous.playedContentMs) inheritedVideoProgress.set(source, { ...state })
        videoProgress.forEach((mountedState, video) => {
          if (videoProgressKey(video) !== source || mountedState.playedContentMs >= state.playedContentMs) return
          mountedState.playedContentMs = state.playedContentMs
          mountedState.durationMs = Math.max(mountedState.durationMs, state.durationMs)
        })
      })
    }

    const tryAcquire = () => {
      if (recorded || !intersecting || ownsTarget) return
      ownsTarget = tryOwnTarget(targetId, {
        token: owner,
        overlay,
        retry: tryAcquire,
        preempt: () => {
          const handoff = metricHandoff()
          if (tracksVideo) suspendActiveVideo()
          ownsTarget = false
          return handoff
        },
        acceptHandoff: acceptMetricHandoff,
      })
      if (ownsTarget) {
        if (tracksStaticAttention) {
          staticInputRevisionAtSegmentStart = attentionInputRevision
          staticSegmentStartDwellMs = dwellMs
          staticSegmentHadInput = false
        }
        startTiming()
      }
    }

    const hasMeaningfulVisibility = (entry: IntersectionObserverEntry | undefined) => {
      if (!entry?.isIntersecting) return false
      if (kind === 'video') return entry.intersectionRatio >= threshold
      const cardHeight = entry.boundingClientRect?.height ?? 0
      const visibleHeight = entry.intersectionRect?.height ?? 0
      const viewportHeight = entry.rootBounds?.height || window.innerHeight
      if (cardHeight <= 0 || visibleHeight <= 0 || viewportHeight <= 0) {
        return entry.intersectionRatio >= threshold
      }
      // A long text/photo post can be meaningfully read without 50% of the whole
      // card ever fitting on screen. Require a bounded visible pixel slice instead.
      const requiredHeight = Math.min(cardHeight * threshold, 320, viewportHeight * 0.5)
      return visibleHeight >= requiredHeight
    }

    const observer = new IntersectionObserver(([entry]) => {
      const nextIntersecting = hasMeaningfulVisibility(entry)
      snapshotTiming()
      if (!nextIntersecting) {
        intersecting = false
        if (tracksVideo) suspendActiveVideo()
        finalize(true)
        if (ownsTarget) {
          ownsTarget = false
          releaseTarget(targetId, owner, tryAcquire)
        } else removeTargetWaiter(targetId, tryAcquire)
        return
      }
      intersecting = true
      tryAcquire()
      startTiming()
    }, {
      threshold: kind === 'video'
        ? [threshold]
        : [...new Set([0, 0.05, 0.1, 0.15, 0.2, 0.25, threshold])].sort((left, right) => left - right),
    })

    const handleAttentionChange = () => {
      const now = monotonicNow()
      snapshotTiming(now)
      if (tracksVideo && !hasBaseAttention()) suspendActiveVideo()
      if (tracksStaticAttention && intersecting && ownsTarget) {
        if (attentionInputRevision !== staticInputRevisionAtSegmentStart) {
          staticSegmentHadInput = true
          if (staticIdleInvalidated) {
            // Discard the synthetic initial grace period and begin a fresh,
            // genuinely attended segment after the user returns.
            dwellMs = 0
            staticSegmentStartDwellMs = 0
            staticIdleInvalidated = false
          }
        }
        if (hasBaseAttention() && !hasRecentStaticInput() && !staticSegmentHadInput) {
          if (staticSegmentStartDwellMs >= MIN_VISIBLE_MS) {
            // Preserve an earlier completed visit, but drop this unattended tail.
            dwellMs = staticSegmentStartDwellMs
          } else {
            // Encode a neutral POST IDLE tier: it remains useful for seen
            // suppression without turning a card left open into a DEEP signal.
            staticIdleInvalidated = exposureMs >= MIN_VISIBLE_MS
          }
        }
      }
      startTiming(now)
    }
    const handleLifecycleFinalize = () => finalize(false)
    const handleVideoPlaying = (event: Event) => {
      if (!tracksVideo || !(event.target instanceof HTMLVideoElement) || !element.contains(event.target) || !videoIsRenderable(event.target)) return
      snapshotTiming()
      activeVideo = event.target
      seekingVideos.delete(event.target)
      bufferingVideos.delete(event.target)
      const state = progressStateFor(event.target)
      state.lastCurrentTime = Number.isFinite(event.target.currentTime) ? event.target.currentTime : null
      if (Number.isFinite(event.target.duration) && event.target.duration > 0) state.durationMs = event.target.duration * 1_000
      videoProgress.set(event.target, state)
      startTiming()
    }
    const handleVideoProgress = (event: Event) => {
      if (!tracksVideo || !(event.target instanceof HTMLVideoElement) || !element.contains(event.target)) return
      if (event.target !== activeVideo) {
        if (activeVideo && videoCanAccrue(activeVideo)) return
        snapshotTiming()
        activeVideo = null
        startTiming()
      }
      if (event.target !== activeVideo || !videoCanAccrue(event.target)) return
      if (!ownsTarget || !intersecting || !hasBaseAttention()) return
      recordVideoProgress(event.target)
      syncTiming()
    }
    const handleVideoPause = (event: Event) => {
      if (!tracksVideo || !(event.target instanceof HTMLVideoElement) || !element.contains(event.target)) return
      if (event.target === activeVideo) {
        if (ownsTarget && intersecting && hasBaseAttention() && videoIsRenderable(event.target) &&
          !seekingVideos.has(event.target) && !bufferingVideos.has(event.target)) {
          recordVideoProgress(event.target)
        }
        snapshotTiming()
        activeVideo = null
        startTiming()
      }
      seekingVideos.delete(event.target)
      bufferingVideos.delete(event.target)
    }
    const handleVideoWaiting = (event: Event) => {
      if (!tracksVideo || !(event.target instanceof HTMLVideoElement) || !element.contains(event.target)) return
      bufferingVideos.add(event.target)
      if (event.target === activeVideo) {
        snapshotTiming()
        activeVideo = null
        startTiming()
      }
    }
    const handleVideoRateChange = (event: Event) => {
      if (!tracksVideo || event.target !== activeVideo) return
      syncTiming()
    }
    const handleVideoSeeking = (event: Event) => {
      if (!tracksVideo || !(event.target instanceof HTMLVideoElement) || !element.contains(event.target)) return
      seekingVideos.add(event.target)
      if (event.target === activeVideo) {
        snapshotTiming()
        activeVideo = null
      }
      const state = videoProgress.get(event.target)
      if (state) state.lastCurrentTime = null
      startTiming()
    }
    const handleVideoSeeked = (event: Event) => {
      if (!tracksVideo || !(event.target instanceof HTMLVideoElement) || !element.contains(event.target)) return
      seekingVideos.delete(event.target)
      const state = videoProgress.get(event.target)
      if (state) state.lastCurrentTime = Number.isFinite(event.target.currentTime) ? event.target.currentTime : null
      if (!activeVideo || !videoCanAccrue(activeVideo)) {
        snapshotTiming()
        activeVideo = null
        startTiming()
      }
    }
    const handleVideoEnded = (event: Event) => {
      if (!tracksVideo || !(event.target instanceof HTMLVideoElement) || event.target !== activeVideo) return
      if (ownsTarget && intersecting && hasBaseAttention() && videoIsRenderable(event.target)) {
        recordVideoProgress(event.target)
      }
      snapshotTiming()
      finalize(false)
      if (recorded) {
        void flushRecommendationImpressions()
        return
      }
      // A short/secondary gallery clip ending must not strand an otherwise
      // visible target. Continue with another actively playing visible video.
      activeVideo = null
      seekingVideos.delete(event.target)
      bufferingVideos.delete(event.target)
      startTiming()
    }

    observer.observe(element)
    const unsubscribeAttention = subscribeAttention(handleAttentionChange)
    const unregisterLifecycle = registerLifecycleFinalizer(handleLifecycleFinalize)
    element.addEventListener('playing', handleVideoPlaying, true)
    element.addEventListener('timeupdate', handleVideoProgress, true)
    element.addEventListener('pause', handleVideoPause, true)
    element.addEventListener('waiting', handleVideoWaiting, true)
    element.addEventListener('stalled', handleVideoWaiting, true)
    element.addEventListener('ratechange', handleVideoRateChange, true)
    element.addEventListener('seeking', handleVideoSeeking, true)
    element.addEventListener('seeked', handleVideoSeeked, true)
    element.addEventListener('ended', handleVideoEnded, true)
    return () => {
      observer.disconnect()
      unsubscribeAttention()
      unregisterLifecycle()
      element.removeEventListener('playing', handleVideoPlaying, true)
      element.removeEventListener('timeupdate', handleVideoProgress, true)
      element.removeEventListener('pause', handleVideoPause, true)
      element.removeEventListener('waiting', handleVideoWaiting, true)
      element.removeEventListener('stalled', handleVideoWaiting, true)
      element.removeEventListener('ratechange', handleVideoRateChange, true)
      element.removeEventListener('seeking', handleVideoSeeking, true)
      element.removeEventListener('seeked', handleVideoSeeked, true)
      element.removeEventListener('ended', handleVideoEnded, true)
      finalize(intentionalDeactivationRef.current && !activeRef.current, intentionalDeactivationRef.current && !activeRef.current)
      if (ownsTarget) releaseTarget(targetId, owner, tryAcquire)
      else removeTargetWaiter(targetId, tryAcquire)
    }
  }, [active, kind, mountedViewerGeneration, overlay, sessionKey, targetId, targetRef, threshold])
}
