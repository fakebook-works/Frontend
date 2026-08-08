import { createContext, useContext } from 'react'

export const ActivityVisibilityContext = createContext(true)

export function useActivityVisibility() {
  return useContext(ActivityVisibilityContext)
}
