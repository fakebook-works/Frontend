import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useActivityVisibility } from '../lib/activityVisibilityContext'

export function BodyPortal({ children }: { children: ReactNode }) {
  const activityVisible = useActivityVisibility()
  if (!activityVisible) return null
  if (typeof document === 'undefined') return children
  return createPortal(children, document.body)
}
