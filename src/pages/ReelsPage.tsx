import {
  lazy,
  Suspense,
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { api } from '../api/client'
import {
  socialApi,
  type ProfileRelationshipState,
  type SocialContent,
  type SocialProfile,
} from '../api/social'
import type { GatewayPost } from '../api/gatewayTypes'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { MentionContent } from '../components/MentionContent'
import { PostPrivacyIcon, type PostPrivacy } from '../components/PostPrivacyIcon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { useBodyInteractionLock } from '../lib/bodyInteractionLock'
import { detectVideoHasAudio } from '../lib/videoAudio'
import { prefetchCommentPage } from '../lib/commentPagePrefetch'
import { parseMentionContent, type MentionDisplayUser } from '../lib/mentions'
import { gatewayReelToSocialContent } from '../lib/reelEntry'

type ReelMode = 'for-you' | 'following' | 'mine' | 'saved' | 'liked' | 'shared' | 'watched'
type ReelSidebarItem = 'for-you' | 'following' | 'profile'
type ReelEntrySource = 'for-you' | 'profile'

const MIN_REEL_RATIO = 9 / 16
const MAX_REEL_RATIO = 16 / 9
const REEL_ACTION_RAIL_WIDTH = 88
const REEL_VERTICAL_GAP = 26
const REEL_COMMENTS_WIDTH_FALLBACK = 320
const REEL_PRELOAD_BEHIND = 1
const REEL_PRELOAD_AHEAD = 2
const REEL_COMMENT_PREFETCH_AHEAD = 2
const REEL_WHEEL_TRIGGER_PX = 28
const REEL_WHEEL_GESTURE_IDLE_MS = 140
const REEL_SCROLL_SETTLE_FALLBACK_MS = 440
const EMPTY_REEL_MENTIONS: readonly MentionDisplayUser[] = []
const ContentActions = lazy(() => import('../components/ContentActions').then((module) => ({ default: module.ContentActions })))
const CreateReelModal = lazy(() => import('../components/CreateReelModal'))

const REEL_LIBRARY_MODES: readonly ReelMode[] = ['mine', 'saved', 'liked', 'shared', 'watched']

function isReelLibraryMode(mode: ReelMode) {
  return REEL_LIBRARY_MODES.includes(mode)
}

async function loadProfileReelQueue(ownerId: string, anchorReelId: string) {
  const reels: SocialContent[] = []
  let cursor: string | null = null
  for (let pageIndex = 0; pageIndex < 8; pageIndex += 1) {
    const page = await socialApi.getProfileReels(ownerId, 25, cursor)
    reels.push(...page.items)
    const anchorIndex = reels.findIndex((reel) => reel.id === anchorReelId)
    if (anchorIndex >= 0 && (reels.length - anchorIndex >= 3 || !page.hasNextPage || !page.endCursor)) break
    if (!page.hasNextPage || !page.endCursor) break
    cursor = page.endCursor
  }
  return [...new Map(reels.map((reel) => [reel.id, reel])).values()]
}

function compactCount(value: number) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Math.max(0, value))
}

function clampReelRatio(value: number) {
  if (!Number.isFinite(value)) return MIN_REEL_RATIO
  return Math.min(MAX_REEL_RATIO, Math.max(MIN_REEL_RATIO, value))
}

/**
 * JSDOM (and a few embedded webviews) do not implement HTMLElement.scrollTo.
 * Keeping the guard here lets the viewer render in those environments while
 * retaining smooth, single-card navigation in a real browser.
 */
function scrollReelStage(stage: HTMLElement | null, top: number, behavior: ScrollBehavior = 'auto') {
  if (!stage) return
  if (typeof stage.scrollTo === 'function') {
    try {
      stage.scrollTo({ top, behavior })
      return
    } catch {
      // Fall back to the direct property for older DOM implementations.
    }
  }
  try {
    stage.scrollTop = top
  } catch {
    // A non-scrollable embedded surface can safely ignore the navigation hint.
  }
}

// Exported for the ratio-boundary unit tests.
// eslint-disable-next-line react-refresh/only-export-components
export function fitReelFrame(viewportWidth: number, viewportHeight: number, ratio: number, verticalGap = REEL_VERTICAL_GAP) {
  const safeRatio = clampReelRatio(ratio)
  const availableWidth = Math.max(1, viewportWidth - REEL_ACTION_RAIL_WIDTH)
  const availableHeight = Math.max(1, viewportHeight - Math.max(0, verticalGap))
  // The portrait Reel defines the canonical vertical stage.  Keep that stage
  // height for every ratio so the top/bottom inset never jumps between cards;
  // wide media is enlarged and center-cropped when the action rail or the
  // comments sidebar constrains its width. This avoids padding the video with
  // artificial black bands while preserving the same top/bottom inset.
  const height = availableHeight
  return {
    width: Math.max(1, Math.floor(Math.min(availableWidth, height * safeRatio))),
    height: Math.max(1, Math.floor(height)),
  }
}

// Exported so the dedicated-viewer spacing rule cannot silently regress.
// eslint-disable-next-line react-refresh/only-export-components
export function reelViewerVerticalGap(ratio: number, detailViewer: boolean) {
  if (!detailViewer || ratio <= MIN_REEL_RATIO + .002) return REEL_VERTICAL_GAP
  const topbarHeight = typeof window === 'undefined'
    ? 52
    : Number.parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 52
  return topbarHeight * 2
}

/** Shrinks an already laid-out Reel as a unit when the comments sidebar takes space. */
// eslint-disable-next-line react-refresh/only-export-components
export function shrinkReelFrameToViewport(frame: { width: number; height: number }, viewportWidth: number) {
  const availableWidth = Math.max(1, viewportWidth - REEL_ACTION_RAIL_WIDTH)
  const scale = Math.min(1, availableWidth / Math.max(1, frame.width))
  return {
    width: Math.max(1, Math.floor(frame.width * scale)),
    height: Math.max(1, Math.floor(frame.height * scale)),
  }
}

function captionBoundaries(content: string, mentions: readonly MentionDisplayUser[], unavailableLabel: string) {
  const users = new Map(mentions.map((mention) => [mention.userId, mention]))
  const boundaries: Array<{ raw: string; display: string }> = [{ raw: '', display: '' }]
  let raw = ''
  let display = ''
  parseMentionContent(content).forEach((segment) => {
    if (segment.type === 'mention') {
      const mention = users.get(segment.userId)
      raw += `[[mention:${segment.userId}]]`
      display += mention?.available && mention.name ? mention.name : unavailableLabel
      boundaries.push({ raw, display })
      return
    }
    Array.from(segment.value).forEach((character) => {
      raw += character
      display += character
      boundaries.push({ raw, display })
    })
  })
  return boundaries
}

function ReelCaption({ content, mentions, onNavigate }: {
  content: string
  mentions: readonly MentionDisplayUser[]
  onNavigate: (path: string) => void
}) {
  const { t } = useI18n()
  const rootRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [collapsible, setCollapsible] = useState(false)
  const [collapsedContent, setCollapsedContent] = useState(content)

  useEffect(() => {
    setExpanded(false)
    setCollapsedContent(content)
  }, [content])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const measure = () => {
      const width = root.getBoundingClientRect().width || root.clientWidth
      if (width <= 0) {
        const fallbackOverflow = content.length > 120 || content.split(/\r?\n/).length > 2
        setCollapsible(fallbackOverflow)
        setCollapsedContent(fallbackOverflow ? `${content.slice(0, 112).trimEnd()}` : content)
        return
      }
      const computed = window.getComputedStyle(root)
      const lineHeight = Number.parseFloat(computed.lineHeight) || (Number.parseFloat(computed.fontSize) || 14) * 1.4
      const probe = document.createElement('div')
      Object.assign(probe.style, {
        position: 'fixed',
        visibility: 'hidden',
        pointerEvents: 'none',
        inset: '0 auto auto -100000px',
        width: `${width}px`,
        font: computed.font,
        fontSize: computed.fontSize,
        fontWeight: computed.fontWeight,
        letterSpacing: computed.letterSpacing,
        lineHeight: computed.lineHeight,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
      })
      document.body.appendChild(probe)
      const boundaries = captionBoundaries(content, mentions, t('fakebookUser'))
      const fullDisplay = boundaries[boundaries.length - 1]?.display ?? ''
      probe.textContent = fullDisplay
      const maxHeight = (lineHeight * 2) + .5
      const overflowing = probe.scrollHeight > maxHeight
      if (!overflowing) {
        setCollapsible(false)
        setCollapsedContent(content)
        probe.remove()
        return
      }

      const suffix = `… ${t('reelSeeMore')}`
      let low = 0
      let high = Math.max(0, boundaries.length - 1)
      while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        probe.textContent = `${boundaries[middle].display.trimEnd()}${suffix}`
        if (probe.scrollHeight <= maxHeight) low = middle
        else high = middle - 1
      }
      setCollapsible(true)
      setCollapsedContent(boundaries[low]?.raw.trimEnd() ?? '')
      probe.remove()
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(root)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [content, mentions, t])

  const visibleContent = expanded ? content : collapsedContent
  return <div ref={rootRef} className={`reel-caption${expanded ? ' expanded' : ''}`}>
    <span className="reel-caption-copy"><MentionContent content={visibleContent} mentions={mentions} onNavigate={onNavigate} /></span>
    {collapsible && <button type="button" onClick={() => setExpanded((current) => !current)}>{expanded ? t('reelSeeLess') : `… ${t('reelSeeMore')}`}</button>}
  </div>
}

// Module-level caches — survive component remounts so tab positions are preserved session-wide
const _reelsCache = new Map<string, SocialContent[]>()
const _viewCountsCache = new Map<string, Record<string, number>>()
const _relationshipsCache = new Map<string, Record<string, ProfileRelationshipState>>()
const _reelPositionCache = new Map<string, { reelId: string | null; index: number }>()
const _tabIndexCache: Record<string, number> = {}

// Test utility: clear all module-level caches between tests
// eslint-disable-next-line react-refresh/only-export-components
export function __clearReelsCacheForTesting(): void {
  _reelsCache.clear()
  _viewCountsCache.clear()
  _relationshipsCache.clear()
  _reelPositionCache.clear()
  for (const key in _tabIndexCache) delete _tabIndexCache[key]
}

export function ReelsPage({ userId, mode, active = true, entrySource = null, entryReelId = null, entryOwnerId = null, entryReel = null, onEntryClose, onNavigate }: {
  userId: string
  mode: ReelMode
  active?: boolean
  entrySource?: ReelEntrySource | null
  entryReelId?: string | null
  entryOwnerId?: string | null
  entryReel?: SocialContent | null
  onEntryClose?: () => void
  onNavigate: (path: string) => void
}) {
  const { t } = useI18n()
  const entryViewer = Boolean(entrySource && entryReelId)
  const entrySeed = entryReel?.id === entryReelId ? entryReel : null
  const [reels, setReels] = useState<SocialContent[]>(() => entrySeed ? [entrySeed] : [])
  const [loading, setLoading] = useState(() => !entrySeed)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [creatorProfile, setCreatorProfile] = useState<SocialProfile | null>(null)
  const [commentReelId, setCommentReelId] = useState<string | null>(null)
  const commentsSidebarOpen = commentReelId !== null
  const [activeIndex, setActiveIndex] = useState(0)
  const [libraryViewerOpen, setLibraryViewerOpen] = useState(entryViewer)
  useBodyInteractionLock(active && libraryViewerOpen, ['content-detail-open', 'reels-library-viewer-open'])
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({})
  const [relationships, setRelationships] = useState<Record<string, ProfileRelationshipState>>({})
  const loadedRequestRef = useRef<string | null>(null)
  const requestSequenceRef = useRef(0)
  const reelsCacheRef = useRef(_reelsCache)
  const viewCountsCacheRef = useRef(_viewCountsCache)
  const relationshipsCacheRef = useRef(_relationshipsCache)
  const reelPositionCacheRef = useRef(_reelPositionCache)
  const tabIndexMap = useRef<Record<string, number>>(_tabIndexCache)
  const deletedReelIdsRef = useRef(new Set<string>())
  const creatorProfileUserRef = useRef<string | null>(null)
  const pageRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLElement>(null)
  const libraryContentRef = useRef<HTMLElement>(null)
  const libraryScrollTopRef = useRef(0)
  const libraryViewerWasOpenRef = useRef(false)
  const scrollFrameRef = useRef<number | null>(null)
  const wheelDeltaRef = useRef(0)
  const wheelDirectionRef = useRef<-1 | 0 | 1>(0)
  const wheelMovedRef = useRef(false)
  const wheelLastEventAtRef = useRef(0)
  const wheelResetTimerRef = useRef<number | null>(null)
  const programmaticTargetIndexRef = useRef<number | null>(null)
  const programmaticSettleTimerRef = useRef<number | null>(null)
  const reelsRef = useRef(reels)
  const activeIndexRef = useRef(activeIndex)
  reelsRef.current = reels
  activeIndexRef.current = activeIndex

  const cancelProgrammaticScroll = useCallback(() => {
    if (programmaticSettleTimerRef.current != null) window.clearTimeout(programmaticSettleTimerRef.current)
    programmaticSettleTimerRef.current = null
    programmaticTargetIndexRef.current = null
  }, [])

  const settleProgrammaticScroll = useCallback(() => {
    const targetIndex = programmaticTargetIndexRef.current
    const stage = stageRef.current
    if (targetIndex != null && stage && stage.clientHeight > 0) {
      const targetTop = targetIndex * stage.clientHeight
      if (Math.abs(stage.scrollTop - targetTop) > 1) scrollReelStage(stage, targetTop)
    }
    // Always release the lifecycle guard, including when Activity has hidden
    // the stage or a viewer was closed before smooth scrolling completed.
    cancelProgrammaticScroll()
  }, [cancelProgrammaticScroll])

  const load = useCallback(async () => {
    const requestKey = `${userId}:${mode}:${entrySource ?? ''}:${entryOwnerId ?? ''}:${entryReelId ?? ''}`
    const requestSequence = ++requestSequenceRef.current
    setLoading(!entrySeed)
    setError(null)
    setCommentReelId(null)
    setLibraryViewerOpen(entryViewer)
    setViewCounts({})
    cancelProgrammaticScroll()
    if (scrollFrameRef.current != null && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(scrollFrameRef.current)
    scrollFrameRef.current = null
    const applyQueue = (nextReels: SocialContent[]) => {
      const savedPosition = entryReelId ? null : reelPositionCacheRef.current.get(requestKey)
      const savedReelIndex = savedPosition?.reelId ? nextReels.findIndex((reel) => reel.id === savedPosition.reelId) : -1
      const selectedIndex = entryReelId
        ? nextReels.findIndex((reel) => reel.id === entryReelId)
        : savedReelIndex >= 0
          ? savedReelIndex
          : Math.min(tabIndexMap.current[mode] ?? savedPosition?.index ?? 0, Math.max(0, nextReels.length - 1))
      const nextIndex = Math.max(0, selectedIndex)
      setReels(nextReels)
      activeIndexRef.current = nextIndex
      setActiveIndex(nextIndex)
      reelPositionCacheRef.current.set(requestKey, { reelId: nextReels[nextIndex]?.id ?? null, index: nextIndex })
      setLibraryViewerOpen(entryViewer)
      // Reset the stage scroll to 0 instantly before the rAF scroll so that
      // handleStageScroll cannot misread the stale position from the previous
      // tab against the new (shorter or differently-ordered) reel list and flip
      // activeIndex to an unintended value mid-transition.
      const stageEl = stageRef.current
      if (stageEl) scrollReelStage(stageEl, 0)
      window.requestAnimationFrame?.(() => {
        const stage = stageRef.current
        if (!stage || stage.clientHeight <= 0) return
        scrollReelStage(stage, activeIndexRef.current * stage.clientHeight)
      })
    }
    // Paint the selected Reel immediately from the projection already present
    // on Home/Profile. The longer queue request below is only enrichment.
    if (entrySeed) applyQueue([entrySeed])
    try {
      const cachedReels = reelsCacheRef.current.get(requestKey)
      if (cachedReels) {
        applyQueue(cachedReels)
        setViewCounts(viewCountsCacheRef.current.get(requestKey) ?? {})
        setRelationships(relationshipsCacheRef.current.get(requestKey) ?? {})
        return
      }
      let nextReels: SocialContent[]
      if (entrySource === 'profile' && entryReelId && entryOwnerId) {
        nextReels = await loadProfileReelQueue(entryOwnerId, entryReelId)
        if (!nextReels.some((reel) => reel.id === entryReelId)) {
          if (!entrySeed) throw new Error('Profile Reel is unavailable')
          nextReels = [entrySeed, ...nextReels]
        }
      } else if (entrySource === 'for-you' && entryReelId) {
        const recommended = await socialApi.getRecommendedReels(userId, 'FOR_YOU', 0, 24)
        const recommendedAnchor = recommended.find((reel) => reel.id === entryReelId) ?? null
        const detail = entrySeed || recommendedAnchor ? null : await api.postDetail(entryReelId)
        const anchor = recommendedAnchor ?? entrySeed ?? (detail?.__typename === 'ReelDetail' ? gatewayReelToSocialContent(detail) : null)
        if (!anchor) throw new Error('Reel is unavailable')
        nextReels = [anchor, ...recommended.filter((reel) => reel.id !== anchor.id)]
      } else {
        nextReels = mode === 'mine'
          ? (await socialApi.getProfileReels(userId, 24)).items
          : mode === 'saved'
            ? (await socialApi.getSavedContent(50)).items.flatMap((item) => item.kind === 'reel' ? [item.reel] : [])
            : mode === 'liked' || mode === 'shared' || mode === 'watched'
              ? await socialApi.getReelCollection(mode, 50)
              : await socialApi.getRecommendedReels(userId, mode === 'following' ? 'FOLLOWING' : 'FOR_YOU', 0, 24)
      }

      if (requestSequence !== requestSequenceRef.current) return
      nextReels = nextReels.filter((reel) => !deletedReelIdsRef.current.has(reel.id))
      applyQueue(nextReels)
      reelsCacheRef.current.set(requestKey, nextReels)
      setRelationships({})

      if (nextReels.length > 0 && typeof socialApi.getContentViewCounts === 'function') {
        void socialApi.getContentViewCounts(nextReels.map((reel) => reel.id))
          .then((counts) => {
            viewCountsCacheRef.current.set(requestKey, counts)
            if (requestSequence === requestSequenceRef.current && loadedRequestRef.current === requestKey) {
              setViewCounts(counts)
            }
          })
          .catch(() => undefined)
      }

      const authorIds = [...new Set(nextReels.map((reel) => reel.authorId).filter((id) => id !== userId))]
      if (authorIds.length > 0 && typeof socialApi.getProfileRelationshipStates === 'function') {
        void socialApi.getProfileRelationshipStates(userId, authorIds)
          .then((value) => {
            relationshipsCacheRef.current.set(requestKey, value)
            if (requestSequence === requestSequenceRef.current && loadedRequestRef.current === requestKey) {
              setRelationships(value)
            }
          })
          .catch(() => undefined)
      }
    } catch {
      if (requestSequence === requestSequenceRef.current && !entrySeed) setError(t('reelsLoadError'))
    } finally {
      if (requestSequence === requestSequenceRef.current) setLoading(false)
    }
  }, [cancelProgrammaticScroll, entryOwnerId, entryReelId, entrySeed, entrySource, entryViewer, mode, t, userId])

  useEffect(() => {
    if (!active) return
    const requestKey = `${userId}:${mode}:${entrySource ?? ''}:${entryOwnerId ?? ''}:${entryReelId ?? ''}`
    if (loadedRequestRef.current === requestKey) return
    const previousRequestKey = loadedRequestRef.current
    if (previousRequestKey) {
      const oldMode = previousRequestKey.split(':')[1]
      if (oldMode) tabIndexMap.current[oldMode] = activeIndexRef.current
      const previousIndex = activeIndexRef.current
      reelPositionCacheRef.current.set(previousRequestKey, {
        reelId: reelsRef.current[previousIndex]?.id ?? null,
        index: previousIndex,
      })
    }
    loadedRequestRef.current = requestKey
    void load()
  }, [active, entryOwnerId, entryReelId, entrySource, load, mode, userId])

  // The destination is preserved with React Activity. Re-entering the exact
  // same deep link therefore reuses the loaded request key, but the previous
  // close/navigation may have left the local viewer flag off. Route intent
  // must reopen the viewer independently from whether data needs refetching.
  useLayoutEffect(() => {
    if (active && entryViewer) setLibraryViewerOpen(true)
  }, [active, entryReelId, entrySource, entryViewer])

  useEffect(() => {
    // The full Reels destination owns its own viewport scroll, so it locks the
    // document. An entry viewer is a fixed overlay above Home/Profile; applying
    // the same `height: 100%; overflow: hidden` class there collapses the
    // underlying document to one viewport and Chromium clamps its scroll to 0.
    // Hidden React Activity destinations must not keep that global class either.
    if (!active || entryViewer) return
    const root = document.documentElement
    root.classList.add('reels-page-scroll')
    document.body.classList.add('reels-page-scroll')
    return () => {
      root.classList.remove('reels-page-scroll')
      document.body.classList.remove('reels-page-scroll')
    }
  }, [active, entryViewer])

  useEffect(() => {
    document.body.classList.toggle('reels-comments-open', commentsSidebarOpen)
    return () => document.body.classList.remove('reels-comments-open')
  }, [commentsSidebarOpen])

  useEffect(() => {
    if (active) return
    cancelProgrammaticScroll()
    setCommentReelId(null)
    setLibraryViewerOpen(false)
  }, [active, cancelProgrammaticScroll])

  useEffect(() => {
    if (commentReelId && !loading && !reels.some((reel) => reel.id === commentReelId)) setCommentReelId(null)
  }, [commentReelId, loading, reels])

  useEffect(() => {
    if (!commentsSidebarOpen || reels.length === 0) return
    const nextReel = reels[activeIndex + 1]
    if (nextReel) prefetchCommentPage(userId, nextReel.id)

    const idleReels = reels.slice(activeIndex + 2, activeIndex + 1 + REEL_COMMENT_PREFETCH_AHEAD)
    if (idleReels.length === 0) return
    const warmIdleReels = () => idleReels.forEach((reel) => prefetchCommentPage(userId, reel.id))
    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(warmIdleReels, { timeout: 650 })
      return () => window.cancelIdleCallback(idleId)
    }
    const timeoutId = window.setTimeout(warmIdleReels, 140)
    return () => window.clearTimeout(timeoutId)
  }, [activeIndex, commentsSidebarOpen, reels, userId])

  useEffect(() => {
    if (!commentReelId) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCommentReelId(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [commentReelId])

  useEffect(() => {
    if (!libraryViewerOpen) return
    const closeViewerOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || commentReelId) return
      setLibraryViewerOpen(false)
      if (entryViewer) onEntryClose?.()
    }
    window.addEventListener('keydown', closeViewerOnEscape)
    return () => window.removeEventListener('keydown', closeViewerOnEscape)
  }, [commentReelId, entryViewer, libraryViewerOpen, onEntryClose])

  useEffect(() => {
    if (creatorProfileUserRef.current === userId) return
    let active = true
    void socialApi.getProfile(userId).then((value) => {
      if (!active) return
      creatorProfileUserRef.current = userId
      setCreatorProfile(value)
    }).catch(() => { if (active) creatorProfileUserRef.current = userId })
    return () => { active = false }
  }, [userId])

  useEffect(() => () => {
    if (scrollFrameRef.current != null && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(scrollFrameRef.current)
    if (wheelResetTimerRef.current != null) window.clearTimeout(wheelResetTimerRef.current)
    cancelProgrammaticScroll()
  }, [cancelProgrammaticScroll])

  useLayoutEffect(() => {
    const wasOpen = libraryViewerWasOpenRef.current
    libraryViewerWasOpenRef.current = libraryViewerOpen
    if (libraryViewerOpen && !wasOpen) {
      const stage = stageRef.current
      if (stage) scrollReelStage(stage, activeIndex * stage.clientHeight)
      return
    }
    if (!libraryViewerOpen && wasOpen) {
      const library = libraryContentRef.current
      if (library) library.scrollTop = libraryScrollTopRef.current
    }
  }, [activeIndex, libraryViewerOpen])

  const moveToReel = useCallback((nextIndex: number) => {
    const stage = stageRef.current
    if (!stage || reels.length === 0) return
    const boundedIndex = Math.max(0, Math.min(reels.length - 1, nextIndex))
    const currentIndex = activeIndexRef.current
    activeIndexRef.current = boundedIndex
    setActiveIndex(boundedIndex)
    const requestKey = loadedRequestRef.current
    if (requestKey) reelPositionCacheRef.current.set(requestKey, { reelId: reels[boundedIndex]?.id ?? null, index: boundedIndex })
    if (boundedIndex !== currentIndex) {
      setCommentReelId((current) => current ? reels[boundedIndex]?.id ?? null : null)
    }
    programmaticTargetIndexRef.current = boundedIndex
    if (programmaticSettleTimerRef.current != null) window.clearTimeout(programmaticSettleTimerRef.current)
    programmaticSettleTimerRef.current = window.setTimeout(settleProgrammaticScroll, REEL_SCROLL_SETTLE_FALLBACK_MS)
    scrollReelStage(stage, boundedIndex * stage.clientHeight, 'smooth')
  }, [reels, settleProgrammaticScroll])

  function handleStageScroll() {
    if (scrollFrameRef.current != null) return
    const update = () => {
      scrollFrameRef.current = null
      const stage = stageRef.current
      if (!stage || stage.clientHeight <= 0) return
      // Smooth programmatic navigation crosses the old card before reaching
      // its target. Do not flip playback/comments back at that midpoint.
      if (programmaticTargetIndexRef.current != null) return
      const nextIndex = Math.max(0, Math.min(reels.length - 1, Math.round(stage.scrollTop / stage.clientHeight)))
      const currentIndex = activeIndexRef.current
      if (nextIndex !== currentIndex) {
        setCommentReelId((current) => current ? reels[nextIndex]?.id ?? null : null)
      }
      activeIndexRef.current = nextIndex
      const requestKey = loadedRequestRef.current
      if (requestKey) reelPositionCacheRef.current.set(requestKey, { reelId: reels[nextIndex]?.id ?? null, index: nextIndex })
      setActiveIndex(nextIndex)
    }
    if (typeof window.requestAnimationFrame !== 'function') {
      update()
      return
    }
    scrollFrameRef.current = window.requestAnimationFrame(update)
  }

  function markAuthorFollowed(authorId: string) {
    setRelationships((current) => {
      const previous = current[authorId]
      if (!previous) return current
      const next = { ...current, [authorId]: { ...previous, isFollowing: true } }
      relationshipsCacheRef.current.set(`${userId}:${mode}`, next)
      return next
    })
  }

  const sidebarItems: Array<{ id: ReelSidebarItem; mode: ReelMode; path: string; label: string }> = [
    { id: 'for-you', mode: 'for-you', path: '/reels/for-you', label: t('forYou') },
    { id: 'following', mode: 'following', path: '/reels/following', label: t('following') },
    { id: 'profile', mode: 'mine', path: '/reels/mine', label: t('profile') },
  ]

  const libraryMode = isReelLibraryMode(mode) || entryViewer
  const showReelViewer = !libraryMode || libraryViewerOpen
  const commentReel = commentReelId ? reels.find((reel) => reel.id === commentReelId) ?? null : null
  const commentRelationship = commentReel ? relationships[commentReel.authorId] : undefined
  const commentAuthorCanFollow = Boolean(commentReel
    && commentReel.authorId !== userId
    && commentReel.authorPrivacy === 1
    && commentRelationship
    && commentRelationship.friendship !== 'friend'
    && !commentRelationship.isFollowing
    && !commentRelationship.isBlocked
    && !commentRelationship.isBlockedBy)
  const commentPost: GatewayPost | null = commentReel
    ? reelAsGatewayPost(commentReel, t('fakebookUser'), commentAuthorCanFollow)
    : null

  useLayoutEffect(() => {
    if (!active || !showReelViewer) return
    const stage = stageRef.current
    if (!stage) return
    const align = () => {
      if (stage.clientHeight <= 0) return false
      scrollReelStage(stage, activeIndexRef.current * stage.clientHeight)
      return true
    }
    if (align() || typeof window.requestAnimationFrame !== 'function') return
    const frame = window.requestAnimationFrame(align)
    return () => window.cancelAnimationFrame(frame)
  }, [active, showReelViewer])

  useLayoutEffect(() => {
    const root = pageRef.current
    const stage = stageRef.current
    if (!active || !showReelViewer || !root || !stage || reels.length < 2) return

    const resetGesture = () => {
      wheelDeltaRef.current = 0
      wheelDirectionRef.current = 0
      wheelMovedRef.current = false
      wheelLastEventAtRef.current = 0
      if (wheelResetTimerRef.current != null) window.clearTimeout(wheelResetTimerRef.current)
      wheelResetTimerRef.current = null
    }
    const scheduleGestureReset = (delay: number) => {
      if (wheelResetTimerRef.current != null) window.clearTimeout(wheelResetTimerRef.current)
      wheelResetTimerRef.current = window.setTimeout(resetGesture, delay)
    }
    const nestedScrollableCanMove = (target: Element | null, delta: number) => {
      let node = target instanceof HTMLElement ? target : null
      while (node && node !== root && node !== stage) {
        const style = window.getComputedStyle(node)
        const maxScroll = Math.max(0, node.scrollHeight - node.clientHeight)
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && maxScroll > 0) {
          if ((delta > 0 && node.scrollTop < maxScroll) || (delta < 0 && node.scrollTop > 0)) return true
        }
        node = node.parentElement
      }
      return false
    }
    const handleWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      const target = event.target instanceof Element ? event.target : null
      const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? Math.max(1, stage.clientHeight) : 1
      const delta = event.deltaY * multiplier
      if (Math.abs(delta) < .01) return
      // Comments, dialogs, menus and editable/range controls own their scroll.
      if (target?.closest('.reels-comments-sidebar, .modal-backdrop, .modal, [role="dialog"], [role="menu"], input[type="range"], textarea, select, [contenteditable="true"]')) return
      if (nestedScrollableCanMove(target, delta)) return

      event.preventDefault()
      const now = typeof performance === 'undefined' ? Date.now() : performance.now()
      if (wheelLastEventAtRef.current > 0 && now - wheelLastEventAtRef.current > REEL_WHEEL_GESTURE_IDLE_MS) resetGesture()
      wheelLastEventAtRef.current = now
      // A touchpad flick can keep emitting momentum for hundreds of
      // milliseconds. Keep one-card-per-gesture latched until there has been a
      // real quiet gap; otherwise a late momentum packet can skip another Reel.
      if (wheelMovedRef.current) {
        scheduleGestureReset(REEL_WHEEL_GESTURE_IDLE_MS)
        return
      }

      const direction = Math.sign(delta) as -1 | 1
      if (wheelDirectionRef.current !== 0 && wheelDirectionRef.current !== direction) wheelDeltaRef.current = 0
      wheelDirectionRef.current = direction
      wheelDeltaRef.current += delta
      if (Math.abs(wheelDeltaRef.current) < REEL_WHEEL_TRIGGER_PX) {
        scheduleGestureReset(REEL_WHEEL_GESTURE_IDLE_MS)
        return
      }

      wheelMovedRef.current = true
      scheduleGestureReset(REEL_WHEEL_GESTURE_IDLE_MS)
      moveToReel(activeIndexRef.current + direction)
    }

    root.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      root.removeEventListener('wheel', handleWheel)
      resetGesture()
    }
  }, [active, moveToReel, reels.length, showReelViewer])

  useEffect(() => {
    const stage = stageRef.current
    if (!active || !showReelViewer || !stage) return
    const settle = () => settleProgrammaticScroll()
    stage.addEventListener('scrollend', settle)
    return () => stage.removeEventListener('scrollend', settle)
  }, [active, settleProgrammaticScroll, showReelViewer])

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!active || !showReelViewer || !stage || typeof ResizeObserver === 'undefined') return
    let previousHeight = stage.clientHeight
    let touchActive = false
    let resizePending = false
    let realignTimer: number | null = null
    const clearRealignTimer = () => {
      if (realignTimer != null) window.clearTimeout(realignTimer)
      realignTimer = null
    }
    const realign = () => {
      realignTimer = null
      if (!resizePending || touchActive) return
      const nextHeight = stage.clientHeight
      if (nextHeight <= 0) return
      resizePending = false
      const targetIndex = programmaticTargetIndexRef.current ?? activeIndexRef.current
      scrollReelStage(stage, targetIndex * nextHeight)
    }
    const scheduleRealign = () => {
      clearRealignTimer()
      // Dynamic mobile browser chrome changes `100dvh` while a finger/momentum
      // scroll is in flight. Wait until both resize and scrolling settle so the
      // correction cannot pull the viewer back to the previous Reel.
      if (!touchActive) realignTimer = window.setTimeout(realign, 140)
    }
    const observer = new ResizeObserver(() => {
      const nextHeight = stage.clientHeight
      if (nextHeight <= 0 || nextHeight === previousHeight) return
      previousHeight = nextHeight
      resizePending = true
      scheduleRealign()
    })
    const handleScroll = () => {
      if (resizePending) scheduleRealign()
    }
    const handleTouchStart = () => {
      touchActive = true
      clearRealignTimer()
    }
    const handleTouchEnd = () => {
      touchActive = false
      if (resizePending) scheduleRealign()
    }
    observer.observe(stage)
    stage.addEventListener('scroll', handleScroll, { passive: true })
    stage.addEventListener('touchstart', handleTouchStart, { passive: true })
    stage.addEventListener('touchend', handleTouchEnd, { passive: true })
    stage.addEventListener('touchcancel', handleTouchEnd, { passive: true })
    return () => {
      observer.disconnect()
      clearRealignTimer()
      stage.removeEventListener('scroll', handleScroll)
      stage.removeEventListener('touchstart', handleTouchStart)
      stage.removeEventListener('touchend', handleTouchEnd)
      stage.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [active, showReelViewer])

  function openLibraryReel(index: number) {
    libraryScrollTopRef.current = libraryContentRef.current?.scrollTop ?? 0
    cancelProgrammaticScroll()
    activeIndexRef.current = index
    setActiveIndex(index)
    setCommentReelId(null)
    setLibraryViewerOpen(true)
  }

  function closeLibraryViewer() {
    cancelProgrammaticScroll()
    setCommentReelId(null)
    setLibraryViewerOpen(false)
    if (entryViewer) onEntryClose?.()
  }

  const navigateFromReel = useCallback((path: string) => {
    setCommentReelId(null)
    setLibraryViewerOpen(false)
    onNavigate(path)
  }, [onNavigate])

  const removeDeletedReel = useCallback((reelId: string) => {
    const previous = reelsRef.current
    const removedIndex = previous.findIndex((reel) => reel.id === reelId)
    if (removedIndex < 0) return

    deletedReelIdsRef.current.add(reelId)
    cancelProgrammaticScroll()
    const next = previous.filter((reel) => reel.id !== reelId)
    const nextIndex = Math.min(removedIndex, Math.max(0, next.length - 1))
    reelsRef.current = next
    activeIndexRef.current = nextIndex
    setReels(next)
    setActiveIndex(nextIndex)
    setCommentReelId((current) => current === reelId ? null : current)
    setViewCounts((current) => {
      if (!(reelId in current)) return current
      const copy = { ...current }
      delete copy[reelId]
      return copy
    })

    for (const [key, cached] of reelsCacheRef.current) {
      const filtered = cached.filter((reel) => reel.id !== reelId)
      reelsCacheRef.current.set(key, filtered)
      const saved = reelPositionCacheRef.current.get(key)
      if (saved?.reelId === reelId) {
        const index = Math.min(saved.index, Math.max(0, filtered.length - 1))
        reelPositionCacheRef.current.set(key, { reelId: filtered[index]?.id ?? null, index })
      }
    }
    for (const [key, counts] of viewCountsCacheRef.current) {
      if (!(reelId in counts)) continue
      const copy = { ...counts }
      delete copy[reelId]
      viewCountsCacheRef.current.set(key, copy)
    }

    if (next.length === 0 && entryViewer) {
      setLibraryViewerOpen(false)
      onEntryClose?.()
      return
    }
    window.requestAnimationFrame?.(() => {
      const stage = stageRef.current
      if (stage && stage.clientHeight > 0) scrollReelStage(stage, nextIndex * stage.clientHeight)
    })
  }, [cancelProgrammaticScroll, entryViewer, onEntryClose])

  return <><main ref={pageRef} className={`reels-page${libraryMode && !libraryViewerOpen ? ' is-library' : ''}${libraryViewerOpen ? ' is-library-viewer' : ''}${commentsSidebarOpen ? ' has-comments-sidebar' : ''}`}>
    {!libraryViewerOpen && <aside className="reels-sidebar">
      <header><h1>{t('reels')}</h1></header>
      <nav aria-label={t('reels')}>
        {sidebarItems.map((item) => {
          const active = item.id === 'profile' ? libraryMode : mode === item.mode
          return <button type="button" key={item.id} className={active ? 'active' : ''} onClick={() => onNavigate(item.path)}>
          <ReelSidebarIcon name={item.id} active={active} />
          <strong>{item.label}</strong>
        </button>})}
      </nav>
    </aside>}

    {libraryMode && !libraryViewerOpen && <ReelLibrary
      contentRef={libraryContentRef}
      mode={mode}
      reels={reels}
      viewCounts={viewCounts}
      loading={loading}
      error={error}
      creatorProfile={creatorProfile}
      onRetry={() => void load()}
      onNavigate={onNavigate}
      onCreate={() => setCreating(true)}
      onOpenReel={openLibraryReel}
    />}

    {showReelViewer && <section
      ref={stageRef}
      className="reels-stage"
      aria-label={t('reels')}
      tabIndex={0}
      onScroll={handleStageScroll}
      onKeyDown={(event) => {
        const target = event.target instanceof Element ? event.target : null
        if (target?.closest('input, textarea, select, button, a, [contenteditable="true"], [role="menu"]')) return
        if (event.key === 'ArrowDown' || event.key === 'PageDown') {
          event.preventDefault()
          moveToReel(activeIndexRef.current + 1)
        } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
          event.preventDefault()
          moveToReel(activeIndexRef.current - 1)
        }
      }}
    >
      {loading
        ? <ReelViewerSkeleton label={t('loading')} />
        : error
          ? <div className="card state-card reels-stage-state"><h2>{t('unableToLoad')}</h2><p>{error}</p><button className="btn-primary" onClick={() => void load()}>{t('tryAgain')}</button></div>
          : reels.length === 0
            ? <div className="card state-card reels-stage-state"><h2>{t('noReels')}</h2><p>{t('noReelsDesc')}</p>{mode === 'mine' && <button className="btn-primary" onClick={() => setCreating(true)}>{t('createReel')}</button>}</div>
            : reels.map((reel, index) => <ReelCard
                key={reel.id}
                reel={reel}
                viewerId={userId}
                active={active && index === activeIndex}
                warm={index >= activeIndex - REEL_PRELOAD_BEHIND && index <= activeIndex + REEL_PRELOAD_AHEAD}
                relationship={relationships[reel.authorId]}
                detailViewer={libraryViewerOpen}
                commentsOpen={commentReelId === reel.id}
                commentsLayoutOpen={commentsSidebarOpen}
                onCommentsOpenChange={(open) => setCommentReelId(open ? reel.id : null)}
                 onFollowed={markAuthorFollowed}
                 onNavigate={navigateFromReel}
                 onDeleted={removeDeletedReel}
               />)}
    </section>}

    {commentReel && commentPost && <Suspense fallback={<aside className="reels-comments-sidebar" aria-busy="true" />}>
      <ContentActions
        viewerId={userId}
        contentId={commentReel.id}
        post={commentPost}
        variant="reel"
        commentsPresentation="sidebar"
        commentsOpen
        renderActions={false}
        onCommentsOpenChange={(open) => { if (!open) setCommentReelId(null) }}
        onNavigate={onNavigate}
      />
    </Suspense>}

    {showReelViewer && !loading && !error && reels.length > 0 && <nav className="reel-step-controls" aria-label={t('reels')}>
      <button type="button" aria-label={t('previousReel')} disabled={activeIndex === 0} onClick={() => moveToReel(activeIndex - 1)}>
        <ReelDirectionIcon direction="up" />
      </button>
      <button type="button" aria-label={t('nextReel')} disabled={activeIndex === reels.length - 1} onClick={() => moveToReel(activeIndex + 1)}>
        <ReelDirectionIcon direction="down" />
      </button>
    </nav>}

    {creating && <Suspense fallback={<div className="modal-backdrop reel-composer-backdrop"><span className="spinner" /></div>}>
      <CreateReelModal
        userId={userId}
        displayName={creatorProfile?.displayName ?? t('fakebookUser')}
        avatarUrl={creatorProfile?.avatarUrl ?? null}
        isVerified={creatorProfile?.isVerified}
        onClose={() => setCreating(false)}
        onCreated={(post) => {
          const createdReel: SocialContent = {
            id: post.id,
            type: post.type,
            content: post.content,
            privacy: post.privacy,
            createdAt: post.create,
            authorId: post.author.id,
            media: post.media,
            aspectRatio: post.__typename === 'ReelDetail' ? post.aspectRatio : null,
            focalPointX: post.__typename === 'ReelDetail' ? post.focalPointX : null,
            focalPointY: post.__typename === 'ReelDetail' ? post.focalPointY : null,
            authorPrivacy: creatorProfile?.privacy ?? null,
            author: {
              id: post.author.id,
              username: post.author.name,
              displayName: post.author.name,
              avatarUrl: post.author.avatar || null,
              isVerified: post.author.isVerified,
            },
          }
          setReels((current) => [createdReel, ...current.filter((reel) => reel.id !== post.id)])
          reelsCacheRef.current.set(`${userId}:mine`, [createdReel, ...(reelsCacheRef.current.get(`${userId}:mine`) ?? []).filter((reel) => reel.id !== post.id)])
          setActiveIndex(0)
          setViewCounts((current) => ({ ...current, [post.id]: 0 }))
          viewCountsCacheRef.current.set(`${userId}:mine`, { ...(viewCountsCacheRef.current.get(`${userId}:mine`) ?? {}), [post.id]: 0 })
          if (mode !== 'mine') onNavigate('/reels/mine')
          else scrollReelStage(stageRef.current, 0)
          setCreating(false)
        }}
      />
    </Suspense>}
  </main>
  {active && libraryViewerOpen && <button type="button" className="content-detail-shell-close reels-library-viewer-close" aria-label={t('close')} onClick={closeLibraryViewer}><Icon name="close" size={24} /></button>}
  </>
}

function ReelLibrary({
  contentRef,
  mode,
  reels,
  viewCounts,
  loading,
  error,
  creatorProfile,
  onRetry,
  onNavigate,
  onCreate,
  onOpenReel,
}: {
  contentRef: RefObject<HTMLElement | null>
  mode: ReelMode
  reels: SocialContent[]
  viewCounts: Record<string, number>
  loading: boolean
  error: string | null
  creatorProfile: SocialProfile | null
  onRetry: () => void
  onNavigate: (path: string) => void
  onCreate: () => void
  onOpenReel: (index: number) => void
}) {
  const { t } = useI18n()
  const filters: Array<{ mode: ReelMode; path: string; label: string; icon: 'bookmark' | 'likeOutline' | 'shareOutline' | 'clock' | 'video' }> = [
    { mode: 'mine', path: '/reels/mine', label: t('yourReels'), icon: 'video' },
    { mode: 'saved', path: '/reels/saved', label: t('savedReels'), icon: 'bookmark' },
    { mode: 'liked', path: '/reels/liked', label: t('likedReels'), icon: 'likeOutline' },
    { mode: 'shared', path: '/reels/shared', label: t('sharedReels'), icon: 'shareOutline' },
    { mode: 'watched', path: '/reels/watched', label: t('watchedReels'), icon: 'clock' },
  ]

  return <section ref={contentRef} className="reels-library-content" aria-label={t('reelsLibrary')}>
    <div className="reels-library-card">
      <header className="reels-library-header">
        <h2>{t('reelsLibrary')}</h2>
        <nav aria-label={t('reelsLibrary')}>
          {filters.map((filter) => <button
            type="button"
            key={filter.mode}
            className={mode === filter.mode ? 'active' : ''}
            aria-current={mode === filter.mode ? 'page' : undefined}
            onClick={() => onNavigate(filter.path)}
          >
            <Icon name={filter.icon} size={18} />
            <span>{filter.label}</span>
          </button>)}
        </nav>
      </header>

      {loading
        ? <ReelLibrarySkeleton />
        : error
          ? <div className="reels-library-state"><Icon name="video" size={30} /><strong>{t('unableToLoad')}</strong><span>{error}</span><button type="button" onClick={onRetry}>{t('tryAgain')}</button></div>
          : <div className="reels-library-grid">
              <button type="button" className="reels-library-create-tile" onClick={onCreate} aria-label={t('createReel')}>
                <div className="reels-library-create-visual">
                  <Avatar name={creatorProfile?.displayName ?? t('fakebookUser')} src={creatorProfile?.avatarUrl} size={72} />
                  <span><Icon name="plus" size={22} /></span>
                </div>
                <strong>{t('yourReels')}</strong>
                <small>{t('createReel')}</small>
              </button>
              {reels.map((reel, index) => {
                const media = reel.media[0]
                const authorName = reel.author?.displayName ?? t('fakebookUser')
                return <button
                  type="button"
                  className="reels-library-tile"
                  key={reel.id}
                  onClick={() => onOpenReel(index)}
                  onMouseEnter={(event) => {
                    const preview = event.currentTarget.querySelector('video')
                    if (preview) void preview.play().catch(() => undefined)
                  }}
                  onMouseLeave={(event) => {
                    const preview = event.currentTarget.querySelector('video')
                    if (!preview) return
                    preview.pause()
                    preview.currentTime = 0
                  }}
                  aria-label={authorName}
                >
                  <span className="reels-library-media">
                    {media?.type === 1
                      ? <video src={media.url} muted loop playsInline preload="metadata" />
                      : media
                        ? <img src={media.url} alt="" loading="lazy" />
                        : <span className="reels-library-media-missing"><Icon name="video" size={34} /></span>}
                    <span className="reels-library-tile-gradient" />
                    <span className="reels-library-tile-copy">
                      <strong>{authorName}</strong>
                      <small><Icon name="play" size={13} /> {compactCount(viewCounts[reel.id] ?? 0)} {t('views')}</small>
                    </span>
                  </span>
                </button>
              })}
            </div>}
    </div>
  </section>
}

function ReelLibrarySkeleton() {
  return <div className="reels-library-grid reels-library-grid-skeleton" aria-busy="true">
    {Array.from({ length: 11 }, (_, index) => <span className={index === 0 ? 'reels-library-create-tile skeleton' : 'reels-library-tile skeleton'} key={index}>
      <span />
      <i />
      <i />
    </span>)}
  </div>
}

function ReelViewerSkeleton({ label }: { label: string }) {
  return <div className="reel-feed-skeleton" aria-busy="true" aria-label={label}>
    <div className="reel-feed-skeleton-canvas">
      <span className="reel-feed-skeleton-top" />
      <div className="reel-feed-skeleton-copy"><i /><i /><i /></div>
    </div>
    <div className="reel-feed-skeleton-actions"><i /><i /><i /><i /></div>
  </div>
}

function ReelCard({
  reel,
  viewerId,
  active,
  warm,
  relationship,
  detailViewer,
  commentsOpen,
  commentsLayoutOpen,
  onCommentsOpenChange,
  onFollowed,
  onNavigate,
  onDeleted,
}: {
  reel: SocialContent
  viewerId: string
  active: boolean
  warm: boolean
  relationship?: ProfileRelationshipState
  detailViewer: boolean
  commentsOpen: boolean
  commentsLayoutOpen: boolean
  onCommentsOpenChange: (open: boolean) => void
  onFollowed: (authorId: string) => void
  onNavigate: (path: string) => void
  onDeleted: (reelId: string) => void
}) {
  const { t } = useI18n()
  const media = reel.media[0]
  const viewportRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const watchRecordedRef = useRef(false)
  const playbackFeedbackSequenceRef = useRef(0)
  const playbackFeedbackTimerRef = useRef<number | null>(null)
  const mediaStateKeyRef = useRef<string | null>(null)
  const uncompressedFrameRef = useRef<{ width: number; height: number; ratio: number } | null>(null)
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null)
  const [frameSize, setFrameSize] = useState<{ width: number; height: number } | null>(null)
  const [muted, setMuted] = useState(true)
  const [volume, setVolume] = useState(.8)
  const [hasAudio, setHasAudio] = useState<boolean | null>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [playbackFeedback, setPlaybackFeedback] = useState<{ key: number; state: 'play' | 'pause' } | null>(null)
  const [followBusy, setFollowBusy] = useState(false)
  const [followError, setFollowError] = useState(false)

  const selectedRatio = typeof reel.aspectRatio === 'number' && Number.isFinite(reel.aspectRatio)
    ? clampReelRatio(reel.aspectRatio)
    : null
  const displayRatio = selectedRatio ?? naturalRatio ?? MIN_REEL_RATIO
  const focalPointX = typeof reel.focalPointX === 'number' && reel.focalPointX >= 0 && reel.focalPointX <= 1 ? reel.focalPointX : .5
  const focalPointY = typeof reel.focalPointY === 'number' && reel.focalPointY >= 0 && reel.focalPointY <= 1 ? reel.focalPointY : .5
  const objectPosition = `${focalPointX * 100}% ${focalPointY * 100}%`
  const privacy = (reel.privacy === 1 || reel.privacy === 2 || reel.privacy === 3 ? reel.privacy : 0) as PostPrivacy
  const privacyLabel = privacy === 0 ? t('privacyPublic') : privacy === 1 ? t('privacyFriendsFollowers') : privacy === 2 ? t('privacyFriends') : t('privacyOnlyMe')
  const canFollow = reel.authorId !== viewerId
    && reel.authorPrivacy === 1
    && Boolean(relationship)
    && relationship?.friendship !== 'friend'
    && !relationship?.isFollowing
    && !relationship?.isBlocked
    && !relationship?.isBlockedBy
  const post = reelAsGatewayPost(reel, t('fakebookUser'), canFollow)
  const mediaStateKey = `${reel.id}:${media?.type ?? 'none'}:${media?.url ?? ''}`
  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0
  const progressStyle = { '--reel-progress': `${progress * 100}%` } as CSSProperties
  const volumeStyle = { '--reel-volume-fill': `${(muted ? 0 : volume) * 100}%` } as CSSProperties
  const frameStyle: CSSProperties = frameSize
    ? { width: `${frameSize.width}px`, height: `${frameSize.height}px`, aspectRatio: String(displayRatio) }
    : { aspectRatio: String(displayRatio) }

  useEffect(() => {
    watchRecordedRef.current = false
  }, [reel.id, viewerId])

  useEffect(() => {
    if (mediaStateKeyRef.current === mediaStateKey) {
      const video = videoRef.current
      if (video) {
        setDuration(Number.isFinite(video.duration) ? video.duration : 0)
        setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0)
      }
      return
    }
    mediaStateKeyRef.current = mediaStateKey
    setNaturalRatio(null)
    setFrameSize(null)
    uncompressedFrameRef.current = null
    setHasAudio(media?.type === 1 ? null : false)
    setDuration(0)
    setCurrentTime(0)
    setPlaybackRate(1)
    setPlaybackFeedback(null)
  }, [media?.type, media?.url, mediaStateKey])

  useEffect(() => () => {
    if (playbackFeedbackTimerRef.current != null) window.clearTimeout(playbackFeedbackTimerRef.current)
  }, [])

  useLayoutEffect(() => {
    if (!warm) return
    const viewport = viewportRef.current
    if (!viewport) return
    const measure = () => {
      const bounds = viewport.getBoundingClientRect()
      if (bounds.width <= 0 || bounds.height <= 0) return
      const verticalGap = reelViewerVerticalGap(displayRatio, detailViewer)
      const uncompressed = fitReelFrame(bounds.width, bounds.height, displayRatio, verticalGap)
      if (!commentsLayoutOpen) {
        uncompressedFrameRef.current = { ...uncompressed, ratio: displayRatio }
      }
      const baseline = uncompressedFrameRef.current && Math.abs(uncompressedFrameRef.current.ratio - displayRatio) < .0005
        ? uncompressedFrameRef.current
        : {
            ...fitReelFrame(bounds.width + (commentsLayoutOpen ? REEL_COMMENTS_WIDTH_FALLBACK : 0), bounds.height, displayRatio, verticalGap),
            ratio: displayRatio,
          }
      const next = commentsLayoutOpen ? shrinkReelFrameToViewport(baseline, bounds.width) : uncompressed
      setFrameSize((current) => current?.width === next.width && current.height === next.height ? current : next)
    }
    measure()
    window.addEventListener('resize', measure)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(viewport)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [commentsLayoutOpen, detailViewer, displayRatio, warm])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (active) {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0)
      setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0)
      const playback = video.play()
      if (playback) void playback.catch(() => undefined)
    } else if (!video.paused) video.pause()
  }, [active, media?.type, media?.url])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = muted
    video.volume = volume
    video.playbackRate = playbackRate
  }, [muted, playbackRate, volume])

  useLayoutEffect(() => {
    const video = videoRef.current
    return () => { if (video && !video.paused) video.pause() }
  }, [media?.type, media?.url])

  function updateMediaRatio(width: number, height: number) {
    if (selectedRatio == null && width > 0 && height > 0) setNaturalRatio(clampReelRatio(width / height))
  }

  function handleVideoReady(video: HTMLVideoElement) {
    updateMediaRatio(video.videoWidth, video.videoHeight)
    setDuration(Number.isFinite(video.duration) ? video.duration : 0)
    const detectedAudio = detectVideoHasAudio(video)
    if (detectedAudio != null) setHasAudio(detectedAudio)
    video.volume = volume
    video.muted = muted
    video.playbackRate = playbackRate
    if (active) {
      const playback = video.play()
      if (playback) void playback.catch(() => undefined)
    }
  }

  function togglePlayback() {
    const video = videoRef.current
    if (!video) return
    const nextState = video.paused ? 'play' : 'pause'
    if (video.paused) {
      const playback = video.play()
      if (playback) void playback.catch(() => undefined)
    } else video.pause()
    const key = ++playbackFeedbackSequenceRef.current
    setPlaybackFeedback({ key, state: nextState })
    if (playbackFeedbackTimerRef.current != null) window.clearTimeout(playbackFeedbackTimerRef.current)
    playbackFeedbackTimerRef.current = window.setTimeout(() => {
      setPlaybackFeedback((current) => current?.key === key ? null : current)
      playbackFeedbackTimerRef.current = null
    }, 420)
  }

  function changePlaybackRate(nextRate: number) {
    const safeRate = Math.min(2, Math.max(.5, nextRate))
    setPlaybackRate(safeRate)
    if (videoRef.current) videoRef.current.playbackRate = safeRate
  }

  function toggleMute() {
    const video = videoRef.current
    if (!video || hasAudio === false) return
    const nextMuted = !muted
    if (!nextMuted && volume === 0) setVolume(.8)
    video.muted = nextMuted
    setMuted(nextMuted)
  }

  function changeVolume(nextValue: number) {
    const video = videoRef.current
    if (!video || hasAudio === false) return
    const nextVolume = Math.min(1, Math.max(0, nextValue))
    video.volume = nextVolume
    video.muted = nextVolume === 0
    setVolume(nextVolume)
    setMuted(nextVolume === 0)
  }

  async function followAuthor() {
    if (!canFollow || followBusy) return
    setFollowBusy(true)
    setFollowError(false)
    try {
      const followed = await socialApi.followUser(viewerId, reel.authorId)
      if (!followed) throw new Error('Follow rejected')
      onFollowed(reel.authorId)
    } catch {
      setFollowError(true)
    } finally {
      setFollowBusy(false)
    }
  }

  function recordWatch() {
    if (watchRecordedRef.current || typeof socialApi.watchContent !== 'function') return
    watchRecordedRef.current = true
    void socialApi.watchContent(viewerId, reel.id).then((watched) => {
      if (!watched) watchRecordedRef.current = false
    }).catch(() => { watchRecordedRef.current = false })
  }

  return <article ref={viewportRef} className={`reel-card${active ? ' active' : ''}`} aria-current={active ? 'true' : undefined}>
    <div className="reel-card-shell">
      <div className="reel-canvas" style={frameStyle}>
        {media
          ? media.type === 1
            ? <video
                ref={videoRef}
                src={media.url}
                muted={muted}
                loop
                playsInline
                preload={warm ? 'auto' : 'none'}
                style={{ objectPosition }}
                onClick={togglePlayback}
                onPlay={recordWatch}
                onLoadedMetadata={(event) => handleVideoReady(event.currentTarget)}
                onCanPlay={(event) => {
                  if (hasAudio == null) {
                    const detectedAudio = detectVideoHasAudio(event.currentTarget)
                    if (detectedAudio != null) setHasAudio(detectedAudio)
                  }
                }}
                onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
                onTimeUpdate={(event) => {
                  setCurrentTime(event.currentTarget.currentTime)
                  if (hasAudio == null) {
                    const detected = detectVideoHasAudio(event.currentTarget)
                    if (detected != null) setHasAudio(detected)
                  }
                }}
              />
            : <img src={media.url} alt="" loading={warm ? 'eager' : 'lazy'} style={{ objectPosition }} onLoad={(event) => updateMediaRatio(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} />
          : <div className="reel-missing"><Icon name="video" size={64} /><span>{t('mediaUnavailable')}</span></div>}

        <div className="reel-top-controls" onClick={(event) => event.stopPropagation()}>
          <div className={`reel-volume-control${hasAudio === false ? ' no-audio' : ''}`} style={volumeStyle}>
            <button type="button" aria-label={hasAudio === false ? t('videoNoAudio') : t(muted || volume === 0 ? 'videoUnmute' : 'videoMute')} aria-disabled={hasAudio === false} onClick={(event) => { toggleMute(); event.currentTarget.blur() }}>
              <ReelVolumeGlyph muted={hasAudio === false || muted || volume === 0} />
            </button>
            {hasAudio !== false && <input type="range" min={0} max={1} step={.02} value={muted ? 0 : volume} aria-label={t('videoVolume')} onWheel={(event) => event.stopPropagation()} onChange={(event) => changeVolume(Number(event.target.value))} />}
          </div>
          <button type="button" className="reel-search-button" aria-label={t('search')}>
            <ReelSearchGlyph />
          </button>
        </div>

        {playbackFeedback && <span key={playbackFeedback.key} className={`reel-playback-feedback ${playbackFeedback.state}`} aria-hidden="true"><Icon name={playbackFeedback.state} size={27} /></span>}

        <div className="reel-overlay" onClick={(event) => event.stopPropagation()}>
          <div className="reel-author-row">
            <button type="button" className="reel-author-avatar" onClick={(event) => {
              event.stopPropagation()
              if (reel.author) onNavigate(`/profile/${reel.author.id}?tab=reels`)
            }}>
              <Avatar name={reel.author?.displayName ?? t('fakebookUser')} src={reel.author?.avatarUrl} size={36} />
            </button>
            <button type="button" className="reel-author-name" onClick={(event) => {
              event.stopPropagation()
              if (reel.author) onNavigate(`/profile/${reel.author.id}?tab=reels`)
            }}>
              <strong>{reel.author?.displayName ?? t('fakebookUser')}<VerifiedBadge verified={reel.author?.isVerified} size={13} /></strong>
            </button>
            <span className="reel-author-privacy" title={privacyLabel} aria-label={privacyLabel}><PostPrivacyIcon privacy={privacy} size={13} /></span>
            {canFollow && <><span className="reel-author-separator" aria-hidden="true">·</span><button type="button" className="reel-follow-button" disabled={followBusy} onClick={() => void followAuthor()}>{t('follow')}</button></>}
          </div>
          {reel.content.trim() && <ReelCaption content={reel.content} mentions={reel.mentions ?? EMPTY_REEL_MENTIONS} onNavigate={onNavigate} />}
          {followError && <span className="reel-follow-error" role="status">{t('followActionError')}</span>}
        </div>

        {media?.type === 1 && <input
          className="reel-progress"
          type="range"
          min={0}
          max={duration > 0 ? duration : 1}
          step={.01}
          value={duration > 0 ? Math.min(duration, currentTime) : 0}
          aria-label={t('reelProgress')}
          style={progressStyle}
          disabled={duration <= 0}
          onClick={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
          onChange={(event) => {
            const video = videoRef.current
            if (!video || duration <= 0) return
            const nextTime = Number(event.target.value)
            video.currentTime = nextTime
            setCurrentTime(nextTime)
          }}
        />}
      </div>

      <Suspense fallback={<div className="content-actions-skeleton" />}>
        <ContentActions
          viewerId={viewerId}
          contentId={reel.id}
          post={post}
          variant="reel"
          commentsPresentation="sidebar"
          commentsOpen={commentsOpen}
          renderComments={false}
          engagementEnabled={warm}
          reelPlaybackRate={playbackRate}
          onReelPlaybackRateChange={changePlaybackRate}
           onCommentsOpenChange={onCommentsOpenChange}
           onNavigate={onNavigate}
           onContentDeleted={onDeleted}
         />
      </Suspense>
    </div>
  </article>
}

function reelAsGatewayPost(reel: SocialContent, fallbackName: string, canFollow: boolean): GatewayPost {
  return {
    __typename: 'ReelDetail',
    id: reel.id,
    type: reel.type,
    content: reel.content,
    privacy: reel.privacy,
    create: reel.createdAt,
    author: {
      id: reel.author?.id ?? reel.authorId,
      name: reel.author?.displayName ?? fallbackName,
      avatar: reel.author?.avatarUrl ?? '',
      isVerified: reel.author?.isVerified ?? false,
      canFollow,
    },
    media: reel.media,
    mentions: reel.mentions,
    taggedUsers: [],
    aspectRatio: reel.aspectRatio,
    focalPointX: reel.focalPointX,
    focalPointY: reel.focalPointY,
  }
}

function ReelVolumeGlyph({ muted }: { muted: boolean }) {
  return <svg className="reel-control-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M3.5 9.5v5h3.2l4.8 4V5.5l-4.8 4H3.5Z" />
    {muted
      ? <path d="m15 9 5 6m0-6-5 6" />
      : <><path d="M14.6 9.2a4 4 0 0 1 0 5.6" /><path d="M16.9 6.8a7.2 7.2 0 0 1 0 10.4" /></>}
  </svg>
}

function ReelSearchGlyph() {
  return <svg className="reel-control-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <circle cx="10.5" cy="10.5" r="5.9" />
    <path d="m15 15 4.25 4.25" />
  </svg>
}

function ReelSidebarIcon({ name, active }: { name: ReelSidebarItem; active: boolean }) {
  const profileClipId = `reel-profile-clip-${useId().replace(/:/g, '')}`
  if (name === 'for-you') return <svg className="reels-sidebar-glyph" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 2.75 2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 16.78l-5.5 2.89 1.05-6.12L3.1 9.22l6.15-.9L12 2.75Z" /></svg>
  if (name === 'following') return <svg className="reels-sidebar-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7.15 5.7v-.95A1.7 1.7 0 0 1 8.85 3.05h6.3a1.7 1.7 0 0 1 1.7 1.7v.95" /><path d="M4.95 8.4v-.95A1.75 1.75 0 0 1 6.7 5.7h10.6a1.75 1.75 0 0 1 1.75 1.75v.95" /><rect x="3" y="8.15" width="18" height="12.1" rx="2.35" fill={active ? 'currentColor' : 'none'} /><path d="M10.15 14.2h3.7M12 12.35v3.7" stroke={active ? 'var(--reel-sidebar-surface)' : 'currentColor'} strokeWidth="1.22" /></svg>
  return <svg className="reels-sidebar-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><defs><clipPath id={profileClipId}><circle cx="12" cy="12" r="9.15" /></clipPath></defs>{active && <path d="M6.55 21.5V19.7c0-3.15 2.1-5.25 5.45-5.25s5.45 2.1 5.45 5.25v1.8Z" fill="currentColor" stroke="none" clipPath={`url(#${profileClipId})`} />}<circle cx="12" cy="9.15" r="2.65" fill={active ? 'currentColor' : 'none'} />{!active && <path d="M6.72 19.2c.52-3.13 2.49-4.88 5.28-4.88s4.76 1.75 5.28 4.88" />}<circle cx="12" cy="12" r="9.15" /></svg>
}

function ReelDirectionIcon({ direction }: { direction: 'up' | 'down' }) {
  const path = direction === 'up' ? 'M5.5 14.5 12 8l6.5 6.5' : 'M5.5 9.5 12 16l6.5-6.5'
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}
