import { useEffect, useLayoutEffect } from 'react'

interface BodyStyleSnapshot {
  overflow: string
  paddingRight: string
  htmlOverscrollBehavior: string
  lockClassWasPresent: boolean
}

interface ManagedClass {
  count: number
  wasPresent: boolean
}

let activeLockCount = 0
let bodyStyleSnapshot: BodyStyleSnapshot | null = null
const managedClasses = new Map<string, ManagedClass>()

export function acquireBodyInteractionLock(classes: readonly string[] = []) {
  if (typeof document === 'undefined') return () => undefined
  const body = document.body
  const root = document.documentElement

  if (activeLockCount === 0) {
    bodyStyleSnapshot = {
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
      htmlOverscrollBehavior: root.style.overscrollBehavior,
      lockClassWasPresent: body.classList.contains('modal-interaction-locked'),
    }
    const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth)
    const currentPadding = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0
    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) body.style.paddingRight = `${currentPadding + scrollbarWidth}px`
    root.style.overscrollBehavior = 'none'
    body.classList.add('modal-interaction-locked')
  }
  activeLockCount += 1

  const ownedClasses = [...new Set(classes.filter(Boolean))]
  ownedClasses.forEach((className) => {
    const managed = managedClasses.get(className)
    if (managed) managed.count += 1
    else managedClasses.set(className, { count: 1, wasPresent: body.classList.contains(className) })
    body.classList.add(className)
  })

  let released = false
  return () => {
    if (released) return
    released = true
    ownedClasses.forEach((className) => {
      const managed = managedClasses.get(className)
      if (!managed) return
      managed.count -= 1
      if (managed.count > 0) return
      if (!managed.wasPresent) body.classList.remove(className)
      managedClasses.delete(className)
    })

    activeLockCount = Math.max(0, activeLockCount - 1)
    if (activeLockCount > 0 || !bodyStyleSnapshot) return
    body.style.overflow = bodyStyleSnapshot.overflow
    body.style.paddingRight = bodyStyleSnapshot.paddingRight
    root.style.overscrollBehavior = bodyStyleSnapshot.htmlOverscrollBehavior
    if (!bodyStyleSnapshot.lockClassWasPresent) body.classList.remove('modal-interaction-locked')
    bodyStyleSnapshot = null
  }
}

export function useBodyInteractionLock(active: boolean, classes: readonly string[] = []) {
  const classKey = classes.join('\u0000')
  useLayoutEffect(() => {
    if (!active) return
    return acquireBodyInteractionLock(classKey ? classKey.split('\u0000') : [])
  }, [active, classKey])
}

function elementOrAncestorIsHidden(element: HTMLElement) {
  let current: HTMLElement | null = element
  while (current) {
    if (current.hidden || current.hasAttribute('inert')) return true
    const style = window.getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return true
    current = current.parentElement
  }
  return false
}

function visibleModalBackdrops() {
  return [...document.querySelectorAll<HTMLElement>('.modal-backdrop')]
    .filter((element) => {
      if (elementOrAncestorIsHidden(element)) return false
      const style = window.getComputedStyle(element)
      return style.pointerEvents !== 'none'
    })
    .sort((left, right) => {
      const leftZ = Number.parseInt(window.getComputedStyle(left).zIndex, 10) || 0
      const rightZ = Number.parseInt(window.getComputedStyle(right).zIndex, 10) || 0
      return leftZ - rightZ
    })
}

/** Locks every full-screen modal backdrop without changing small popover behavior. */
export function ModalInteractionGuard() {
  useEffect(() => {
    let releaseLock: (() => void) | null = null
    let topBackdrop: HTMLElement | null = null
    let syncQueued = false
    let disposed = false
    let scrollGuardsAttached = false

    const stopBackdropScroll = (event: WheelEvent | TouchEvent) => {
      if (!topBackdrop) return
      const target = event.target instanceof Element ? event.target : null
      const modal = target?.closest('.modal')
      if (modal && topBackdrop.contains(modal)) return
      if (target && topBackdrop.contains(target)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    const attachScrollGuards = () => {
      if (scrollGuardsAttached) return
      scrollGuardsAttached = true
      document.addEventListener('wheel', stopBackdropScroll, { capture: true, passive: false })
      document.addEventListener('touchmove', stopBackdropScroll, { capture: true, passive: false })
    }
    const detachScrollGuards = () => {
      if (!scrollGuardsAttached) return
      scrollGuardsAttached = false
      document.removeEventListener('wheel', stopBackdropScroll, true)
      document.removeEventListener('touchmove', stopBackdropScroll, true)
    }
    const syncLock = () => {
      const backdrops = visibleModalBackdrops()
      topBackdrop = backdrops[backdrops.length - 1] ?? null
      const hasBackdrop = topBackdrop !== null
      if (hasBackdrop) {
        if (!releaseLock) releaseLock = acquireBodyInteractionLock(['modal-layer-open'])
        attachScrollGuards()
      } else {
        detachScrollGuards()
        if (releaseLock) {
          releaseLock()
          releaseLock = null
        }
      }
    }
    const queueSyncLock = () => {
      if (syncQueued) return
      syncQueued = true
      queueMicrotask(() => {
        syncQueued = false
        if (disposed) return
        syncLock()
      })
    }
    const nodeContainsBackdrop = (node: Node) => node instanceof Element
      && (node.matches('.modal-backdrop') || node.querySelector('.modal-backdrop') !== null)
    const mutationAffectsBackdrop = (mutation: MutationRecord) => {
      return [...mutation.addedNodes, ...mutation.removedNodes].some(nodeContainsBackdrop)
    }
    // Activity keeps hidden destinations mounted. Their modal backdrops are
    // therefore not removed from document.body when the destination changes;
    // observe only each backdrop's ancestor chain so an Activity `hidden`,
    // class, or style update can release the cached lock without watching all
    // attribute mutations in the application shell.
    const visibilityObserver = new MutationObserver(() => queueSyncLock())
    const refreshVisibilityTargets = () => {
      visibilityObserver.disconnect()
      const targets = new Set<HTMLElement>()
      document.querySelectorAll<HTMLElement>('.modal-backdrop').forEach((backdrop) => {
        let current: HTMLElement | null = backdrop
        while (current && current !== document.body) {
          targets.add(current)
          current = current.parentElement
        }
      })
      targets.forEach((target) => visibilityObserver.observe(target, {
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'inert', 'aria-hidden'],
      }))
    }
    syncLock()
    const observer = new MutationObserver((mutations) => {
      if (!mutations.some(mutationAffectsBackdrop)) return
      refreshVisibilityTargets()
      queueSyncLock()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    refreshVisibilityTargets()
    const handleResize = () => queueSyncLock()
    window.addEventListener('resize', handleResize)

    return () => {
      disposed = true
      observer.disconnect()
      visibilityObserver.disconnect()
      window.removeEventListener('resize', handleResize)
      detachScrollGuards()
      releaseLock?.()
    }
  }, [])
  return null
}

export function resetBodyInteractionLocksForTests() {
  activeLockCount = 0
  bodyStyleSnapshot = null
  managedClasses.clear()
}
