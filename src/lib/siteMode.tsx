import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { gatewayGraphQl, isSiteReadOnly, subscribeApiEvents } from '../api/client'

const SiteModeContext = createContext(false)

export function SiteModeProvider({ children }: { children: ReactNode }) {
  const [readOnly, setReadOnly] = useState(isSiteReadOnly)

  useEffect(() => {
    const unsubscribe = subscribeApiEvents((event) => {
      if (event.type === 'site-mode') setReadOnly(event.readOnly)
    })
    const check = () => {
      void gatewayGraphQl<{ __typename: string }>(
        'query SiteMode { __typename }', {}, 'public', false, { background: true },
      ).catch(() => undefined)
    }
    check()
    const interval = window.setInterval(check, 30_000)
    return () => {
      unsubscribe()
      window.clearInterval(interval)
    }
  }, [])

  return <SiteModeContext.Provider value={readOnly}>{children}</SiteModeContext.Provider>
}

export function useSiteReadOnly(): boolean {
  return useContext(SiteModeContext)
}
