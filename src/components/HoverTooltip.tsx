import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface HoverTooltipProps {
  label: string
  children: ReactNode
  className?: string
}

export function HoverTooltip({ label, children, className }: HoverTooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' })
  const tooltipId = useId()

  useLayoutEffect(() => {
    if (!visible) return

    function placeTooltip() {
      const anchor = anchorRef.current
      const tooltip = tooltipRef.current
      if (!anchor || !tooltip) return

      const anchorBox = anchor.getBoundingClientRect()
      const tooltipBox = tooltip.getBoundingClientRect()
      const viewportPadding = 6
      const wantedLeft = anchorBox.left + (anchorBox.width - tooltipBox.width) / 2
      const left = Math.min(
        Math.max(viewportPadding, wantedLeft),
        Math.max(viewportPadding, window.innerWidth - tooltipBox.width - viewportPadding),
      )
      const top = Math.min(
        Math.max(viewportPadding, anchorBox.bottom + 6),
        Math.max(viewportPadding, window.innerHeight - tooltipBox.height - viewportPadding),
      )
      setPosition({ left, top, visibility: 'visible' })
    }

    placeTooltip()
    window.addEventListener('resize', placeTooltip)
    window.addEventListener('scroll', placeTooltip, true)
    return () => {
      window.removeEventListener('resize', placeTooltip)
      window.removeEventListener('scroll', placeTooltip, true)
    }
  }, [label, visible])

  return <>
    <span
      ref={anchorRef}
      className={className}
      tabIndex={0}
      aria-describedby={visible ? tooltipId : undefined}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
    </span>
    {visible && createPortal(
      <span ref={tooltipRef} id={tooltipId} role="tooltip" className="post-meta-tooltip" style={position}>{label}</span>,
      document.body,
    )}
  </>
}
