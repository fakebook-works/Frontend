import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

interface ProfileColumnScrollOptions {
  active: boolean
  pageRef: RefObject<HTMLElement | null>
  firstColumnRef: RefObject<HTMLElement | null>
  secondColumnRef: RefObject<HTMLElement | null>
  resetKey: string
}

/**
 * Uses the destination viewport as the only user-facing scrollbar, then maps
 * its progress onto both profile columns. The shorter column stays pinned at
 * its boundary while the longer column continues without trapping wheel/touch.
 */
export function useProfileColumnScroll({ active, pageRef, firstColumnRef, secondColumnRef, resetKey }: ProfileColumnScrollOptions) {
  const preservedLayoutRef = useRef<{
    page: HTMLElement | null
    resetKey: string | null
    gridStart: number
  }>({ page: null, resetKey: null, gridStart: 0 })

  useEffect(() => {
    if (!active) return
    const page = pageRef.current
    const firstColumn = firstColumnRef.current
    const secondColumn = secondColumnRef.current
    if (!page || !firstColumn || !secondColumn) return
    const grid = firstColumn.parentElement
    if (!grid || grid !== secondColumn.parentElement) return
    const columns = [firstColumn, secondColumn]
    const preservedLayout = preservedLayoutRef.current
    const resetLayout = preservedLayout.page !== page || preservedLayout.resetKey !== resetKey
    if (resetLayout) {
      preservedLayout.page = page
      preservedLayout.resetKey = resetKey
      preservedLayout.gridStart = 0
      page.style.removeProperty('--profile-column-scroll-span')
      columns.forEach((column) => { column.scrollTop = 0 })
    }

    const destinationViewport = page.closest<HTMLElement>('.authenticated-destination-scroll')
    if (!destinationViewport) return
    const columnLimit = (column: HTMLElement) => Math.max(0, column.scrollHeight - column.clientHeight)
    let columnLimits = [0, 0]
    let columnSpan = 0
    let renderedSpan = -1
    let gridStart = preservedLayout.gridStart
    let wasDesktop = window.innerWidth > 980
    let frame: number | null = null

    const gridStartFromLayout = () => {
      const viewportRect = destinationViewport.getBoundingClientRect()
      const gridRect = grid.getBoundingClientRect()
      return Math.max(0, destinationViewport.scrollTop + gridRect.top - viewportRect.top)
    }
    const syncColumns = () => {
      if (window.innerWidth <= 980) return
      const progress = Math.max(0, Math.min(columnSpan, destinationViewport.scrollTop - gridStart))
      columns.forEach((column, index) => {
        const next = Math.min(columnLimits[index] ?? 0, progress)
        if (Math.abs(column.scrollTop - next) > .5) column.scrollTop = next
      })
    }
    const observedChildren = new Set<Element>()
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => scheduleMeasure())
    const observeColumnChildren = () => {
      const currentChildren = new Set(columns.flatMap((column) => Array.from(column.children)))
      observedChildren.forEach((child) => {
        if (currentChildren.has(child)) return
        resizeObserver?.unobserve(child)
        observedChildren.delete(child)
      })
      currentChildren.forEach((child) => {
        if (observedChildren.has(child)) return
        observedChildren.add(child)
        resizeObserver?.observe(child)
      })
    }
    const measure = () => {
      frame = null
      if (window.innerWidth <= 980) {
        wasDesktop = false
        renderedSpan = -1
        columnSpan = 0
        columnLimits = [0, 0]
        page.style.removeProperty('--profile-column-scroll-span')
        columns.forEach((column) => { column.scrollTop = 0 })
        return
      }
      if (!wasDesktop) {
        gridStart = gridStartFromLayout()
        preservedLayout.gridStart = gridStart
        wasDesktop = true
      }
      columnLimits = columns.map(columnLimit)
      const nextSpan = Math.max(...columnLimits)
      columnSpan = nextSpan
      const nextRenderedSpan = Math.ceil(nextSpan)
      if (renderedSpan !== nextRenderedSpan) {
        renderedSpan = nextRenderedSpan
        page.style.setProperty('--profile-column-scroll-span', `${nextRenderedSpan}px`)
      }
      observeColumnChildren()
      syncColumns()
    }
    function scheduleMeasure() {
      if (frame != null) return
      frame = window.requestAnimationFrame(measure)
    }
    const handleResize = () => scheduleMeasure()
    const handleLoad = () => scheduleMeasure()
    const mutationObserver = new MutationObserver(() => scheduleMeasure())

    if (resetLayout) {
      gridStart = gridStartFromLayout()
      preservedLayout.gridStart = gridStart
    }
    resizeObserver?.observe(grid)
    observeColumnChildren()
    mutationObserver.observe(grid, { childList: true, subtree: true })
    destinationViewport.addEventListener('scroll', syncColumns, { passive: true })
    window.addEventListener('resize', handleResize)
    page.addEventListener('load', handleLoad, true)
    measure()
    return () => {
      if (frame != null) window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      mutationObserver.disconnect()
      destinationViewport.removeEventListener('scroll', syncColumns)
      window.removeEventListener('resize', handleResize)
      page.removeEventListener('load', handleLoad, true)
      // React Activity tears effects down while keeping the destination DOM and
      // hook state. Preserve the spacer, anchor and column offsets so the parent
      // can restore its saved outer scrollTop before this effect reconnects.
      // A different resetKey/page explicitly clears them at the next setup.
    }
  }, [active, firstColumnRef, pageRef, resetKey, secondColumnRef])
}

export function useProfileDesktopLayout() {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth > 980)

  useEffect(() => {
    const sync = () => setDesktop(window.innerWidth > 980)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  return desktop
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
