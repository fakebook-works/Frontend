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

function visibleModalBackdrops() {
  return [...document.querySelectorAll<HTMLElement>('.modal-backdrop')]
    .filter((element) => {
      const style = window.getComputedStyle(element)
      return style.display !== 'none' && style.visibility !== 'hidden' && style.pointerEvents !== 'none'
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
    const syncLock = () => {
      const hasBackdrop = visibleModalBackdrops().length > 0
      if (hasBackdrop && !releaseLock) releaseLock = acquireBodyInteractionLock(['modal-layer-open'])
      else if (!hasBackdrop && releaseLock) {
        releaseLock()
        releaseLock = null
      }
    }
    syncLock()
    const observer = new MutationObserver(syncLock)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] })

    const stopBackdropScroll = (event: WheelEvent | TouchEvent) => {
      const backdrops = visibleModalBackdrops()
      const topBackdrop = backdrops[backdrops.length - 1]
      if (!topBackdrop) return
      const target = event.target instanceof Element ? event.target : null
      const modal = target?.closest('.modal')
      if (modal && topBackdrop.contains(modal)) return
      if (target && topBackdrop.contains(target)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    document.addEventListener('wheel', stopBackdropScroll, { capture: true, passive: false })
    document.addEventListener('touchmove', stopBackdropScroll, { capture: true, passive: false })
    return () => {
      observer.disconnect()
      document.removeEventListener('wheel', stopBackdropScroll, true)
      document.removeEventListener('touchmove', stopBackdropScroll, true)
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
