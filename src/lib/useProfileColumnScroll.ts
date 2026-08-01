import { useEffect } from 'react'
import type { RefObject } from 'react'

interface ProfileColumnScrollOptions {
  active: boolean
  pageRef: RefObject<HTMLElement | null>
  firstColumnRef: RefObject<HTMLElement | null>
  secondColumnRef: RefObject<HTMLElement | null>
  resetKey: string
}

/**
 * Mirrors the profile page's wheel routing: the document reaches the content
 * rail first, then both columns advance until each reaches its own boundary.
 * The shorter column stays pinned while the longer column continues.
 */
export function useProfileColumnScroll({ active, pageRef, firstColumnRef, secondColumnRef, resetKey }: ProfileColumnScrollOptions) {
  useEffect(() => {
    if (!active) return
    const page = pageRef.current
    const firstColumn = firstColumnRef.current
    const secondColumn = secondColumnRef.current
    if (!page || !firstColumn || !secondColumn) return
    const columns = [firstColumn, secondColumn]
    columns.forEach((column) => { column.scrollTop = 0 })

    const pageScrollTop = () => window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
    const pageScrollLimit = () => Math.max(0, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight)
    const scrollPageTo = (top: number) => window.scrollTo({ top: Math.max(0, top), left: window.scrollX, behavior: 'auto' })
    const columnLimit = (column: HTMLElement) => Math.max(0, column.scrollHeight - column.clientHeight)
    const scrollColumnsBy = (delta: number) => {
      columns.forEach((column) => {
        column.scrollTop = Math.min(columnLimit(column), Math.max(0, column.scrollTop + delta))
      })
    }
    const nestedScrollableCanMove = (target: EventTarget | null, delta: number) => {
      let node = target instanceof HTMLElement ? target : null
      while (node && node !== page && !columns.includes(node)) {
        const overflowY = window.getComputedStyle(node).overflowY
        const maxScroll = Math.max(0, node.scrollHeight - node.clientHeight)
        if ((overflowY === 'auto' || overflowY === 'scroll') && maxScroll > 0) {
          if ((delta > 0 && node.scrollTop < maxScroll) || (delta < 0 && node.scrollTop > 0)) return true
        }
        node = node.parentElement
      }
      return false
    }
    const clampColumns = () => columns.forEach((column) => {
      column.scrollTop = Math.min(columnLimit(column), Math.max(0, column.scrollTop))
    })

    let pendingDelta = 0
    let animationFrame: number | null = null
    let lastFrameTime = 0
    const routeAnimatedStep = (delta: number) => {
      if (delta > 0) {
        let remaining = delta
        let consumed = 0
        const pageTop = pageScrollTop()
        const pageStep = Math.min(remaining, Math.max(0, pageScrollLimit() - pageTop))
        if (pageStep > 0) {
          scrollPageTo(pageTop + pageStep)
          remaining -= pageStep
          consumed += pageStep
        }
        const columnStep = Math.min(remaining, Math.max(...columns.map((column) => columnLimit(column) - column.scrollTop)))
        if (columnStep > 0) {
          scrollColumnsBy(columnStep)
          consumed += columnStep
        }
        return consumed
      }

      let remaining = -delta
      let consumed = 0
      const columnStep = Math.min(remaining, Math.max(...columns.map((column) => column.scrollTop)))
      if (columnStep > 0) {
        scrollColumnsBy(-columnStep)
        remaining -= columnStep
        consumed += columnStep
      }
      const pageTop = pageScrollTop()
      const pageStep = Math.min(remaining, pageTop)
      if (pageStep > 0) {
        scrollPageTo(pageTop - pageStep)
        consumed += pageStep
      }
      return -consumed
    }
    const stopAnimation = () => {
      pendingDelta = 0
      if (animationFrame != null) window.cancelAnimationFrame(animationFrame)
      animationFrame = null
      lastFrameTime = 0
    }
    const animateColumns = (timestamp: number) => {
      animationFrame = null
      const magnitude = Math.abs(pendingDelta)
      if (magnitude < .35) {
        if (magnitude > .01) routeAnimatedStep(pendingDelta)
        pendingDelta = 0
        lastFrameTime = 0
        return
      }
      const elapsed = lastFrameTime === 0 ? 16.67 : Math.min(32, Math.max(1, timestamp - lastFrameTime))
      lastFrameTime = timestamp
      const easing = 1 - Math.exp(-elapsed / 22)
      const frameLimit = 96 * elapsed / 16.67
      const stepMagnitude = Math.min(frameLimit, Math.max(.35, magnitude * easing))
      const step = Math.sign(pendingDelta) * stepMagnitude
      const consumed = routeAnimatedStep(step)
      if (Math.abs(consumed) < .01 || Math.abs(consumed) + .01 < Math.abs(step)) {
        pendingDelta = 0
        lastFrameTime = 0
        return
      }
      pendingDelta -= consumed
      animationFrame = window.requestAnimationFrame(animateColumns)
    }
    const queueColumnDelta = (delta: number) => {
      if (pendingDelta !== 0 && Math.sign(pendingDelta) !== Math.sign(delta)) pendingDelta = 0
      pendingDelta = Math.max(-720, Math.min(720, pendingDelta + delta))
      if (animationFrame == null) animationFrame = window.requestAnimationFrame(animateColumns)
    }

    const routeWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? event.deltaY * 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? event.deltaY * window.innerHeight
          : event.deltaY
      if (Math.abs(delta) < .01) return
      if (nestedScrollableCanMove(event.target, delta)) {
        stopAnimation()
        return
      }

      event.preventDefault()
      queueColumnDelta(delta)
    }

    page.addEventListener('wheel', routeWheel, { passive: false })
    const handleResize = () => {
      stopAnimation()
      clampColumns()
    }
    window.addEventListener('resize', handleResize)
    return () => {
      stopAnimation()
      page.removeEventListener('wheel', routeWheel)
      window.removeEventListener('resize', handleResize)
    }
  }, [active, firstColumnRef, pageRef, resetKey, secondColumnRef])
}

export function useProfilePageScrollMode() {
  useEffect(() => {
    document.documentElement.classList.add('profile-page-scroll')
    document.body.classList.add('profile-page-scroll')
    return () => {
      document.documentElement.classList.remove('profile-page-scroll')
      document.body.classList.remove('profile-page-scroll')
    }
  }, [])
}
