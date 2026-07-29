import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface AnchoredMenuPortalProps {
  anchor: HTMLElement | null
  children: ReactNode
  className: string
  onRequestClose: () => void
  align?: 'start' | 'end'
  gap?: number
  matchAnchorWidth?: boolean
}

interface MenuPlacement {
  left: number
  top: number
  maxHeight: number
}

const VIEWPORT_GUTTER = 8

export function AnchoredMenuPortal({
  anchor,
  children,
  className,
  onRequestClose,
  align = 'end',
  gap = 6,
  matchAnchorWidth = false,
}: AnchoredMenuPortalProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onRequestClose)
  const [placement, setPlacement] = useState<MenuPlacement | null>(null)
  closeRef.current = onRequestClose

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!anchor || !menu) return

    const updatePlacement = () => {
      const anchorBounds = anchor.getBoundingClientRect()
      const menuBounds = menu.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const availableBelow = Math.max(0, viewportHeight - anchorBounds.bottom - gap - VIEWPORT_GUTTER)
      const availableAbove = Math.max(0, anchorBounds.top - gap - VIEWPORT_GUTTER)
      const openAbove = menuBounds.height > availableBelow && availableAbove > availableBelow
      const maxHeight = Math.max(96, openAbove ? availableAbove : availableBelow)
      const unclampedTop = openAbove
        ? anchorBounds.top - gap - Math.min(menuBounds.height, maxHeight)
        : anchorBounds.bottom + gap
      const unclampedLeft = align === 'start'
        ? anchorBounds.left
        : anchorBounds.right - menuBounds.width
      const maxLeft = Math.max(VIEWPORT_GUTTER, viewportWidth - menuBounds.width - VIEWPORT_GUTTER)
      setPlacement({
        left: Math.max(VIEWPORT_GUTTER, Math.min(unclampedLeft, maxLeft)),
        top: Math.max(VIEWPORT_GUTTER, unclampedTop),
        maxHeight,
      })
    }

    updatePlacement()
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menu.contains(target) && !anchor.contains(target)) closeRef.current()
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
    }
    const closeOnViewportMove = (event: Event) => {
      if (event.target instanceof Node && menu.contains(event.target)) return
      closeRef.current()
    }
    document.addEventListener('pointerdown', closeOnPointerDown, true)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', closeOnViewportMove)
    window.addEventListener('scroll', closeOnViewportMove, true)
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown, true)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', closeOnViewportMove)
      window.removeEventListener('scroll', closeOnViewportMove, true)
    }
  }, [align, anchor, gap])

  if (!anchor) return null
  const style: CSSProperties = {
    left: placement?.left ?? 0,
    top: placement?.top ?? 0,
    maxHeight: placement?.maxHeight,
    minWidth: matchAnchorWidth ? anchor.getBoundingClientRect().width : undefined,
    visibility: placement ? 'visible' : 'hidden',
  }
  return createPortal(<div ref={menuRef} className={`anchored-menu-portal ${className}`} style={style} role="menu">{children}</div>, document.body)
}
