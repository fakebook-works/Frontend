import type { ReactNode } from 'react'
import { ActivityVisibilityContext } from './activityVisibilityContext'

export function ActivityVisibilityProvider({ active, children }: { active: boolean; children: ReactNode }) {
  return <ActivityVisibilityContext.Provider value={active}>{children}</ActivityVisibilityContext.Provider>
}
