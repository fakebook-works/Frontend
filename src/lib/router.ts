import { useCallback, useEffect, useState } from 'react'

export interface AppLocation {
  pathname: string
  search: string
  params: URLSearchParams
}

function readLocation(): AppLocation {
  return {
    pathname: window.location.pathname.replace(/\/+$/, '') || '/',
    search: window.location.search,
    params: new URLSearchParams(window.location.search),
  }
}

export function navigate(to: string, options: { replace?: boolean } = {}) {
  const next = new URL(to, window.location.origin)
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const target = `${next.pathname}${next.search}${next.hash}`
  if (current === target) return
  window.history[options.replace ? 'replaceState' : 'pushState']({}, '', target)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function useAppLocation(): [AppLocation, (to: string, options?: { replace?: boolean }) => void] {
  const [location, setLocation] = useState(readLocation)

  useEffect(() => {
    const update = () => setLocation(readLocation())
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])

  const go = useCallback((to: string, options?: { replace?: boolean }) => navigate(to, options), [])
  return [location, go]
}

export function pathSegment(pathname: string, index: number): string | null {
  const segment = pathname.split('/').filter(Boolean)[index]
  return segment ? decodeURIComponent(segment) : null
}

export function groupMemberRoute(pathname: string): { groupId: string; profileId: string } | null {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length !== 4 || segments[0] !== 'groups' || segments[2] !== 'members') return null
  return { groupId: decodeURIComponent(segments[1]), profileId: decodeURIComponent(segments[3]) }
}
