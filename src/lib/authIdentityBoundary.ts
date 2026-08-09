type AuthIdentityListener = (viewerKey: string | null) => void

let currentAuthIdentity: string | null = null
const listeners = new Set<AuthIdentityListener>()

/** Initialize from persisted auth without publishing a transition. */
export function initializeAuthIdentity(viewerKey: string | null) {
  currentAuthIdentity = viewerKey?.trim() || null
}

/** Called synchronously before the auth client exposes a replacement token. */
export function transitionAuthIdentity(viewerKey: string | null) {
  const normalized = viewerKey?.trim() || null
  if (normalized === currentAuthIdentity) return
  currentAuthIdentity = normalized
  listeners.forEach((listener) => listener(normalized))
}

export function getCurrentAuthIdentity(): string | null {
  return currentAuthIdentity
}

export function subscribeAuthIdentityTransition(listener: AuthIdentityListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
