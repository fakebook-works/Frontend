import { useEffect, useMemo, useRef, useState } from 'react'
import { searchApi } from '../api/search'
import type { UserSummary } from '../api/types'

function matches(person: UserSummary, query: string) {
  const haystack = `${person.displayName} ${person.username}`.toLocaleLowerCase()
  return haystack.includes(query.toLocaleLowerCase())
}

export function useFriendSearch(initialPeople: UserSummary[], query: string, enabled = true) {
  const [remotePeople, setRemotePeople] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const requestSequence = useRef(0)
  const normalized = query.trim()

  const localPeople = useMemo(() => normalized
    ? initialPeople.filter((person) => matches(person, normalized))
    : initialPeople, [initialPeople, normalized])

  useEffect(() => {
    const requestId = ++requestSequence.current
    if (!enabled || normalized.length < 1) {
      setRemotePeople([])
      setLoading(false)
      setFailed(false)
      return
    }

    setRemotePeople([])
    setLoading(true)
    setFailed(false)
    const timeoutId = window.setTimeout(() => {
      void searchApi.searchFriends(normalized, 1, 30)
        .then((people) => {
          if (requestSequence.current === requestId) setRemotePeople(people)
        })
        .catch(() => {
          if (requestSequence.current === requestId) {
            setRemotePeople([])
            setFailed(true)
          }
        })
        .finally(() => {
          if (requestSequence.current === requestId) setLoading(false)
        })
    }, 200)

    return () => window.clearTimeout(timeoutId)
  }, [enabled, normalized])

  const people = useMemo(() => {
    if (!normalized) return initialPeople
    const deduplicated = new Map<string, UserSummary>()
    for (const person of [...localPeople, ...remotePeople]) deduplicated.set(person.id, person)
    return [...deduplicated.values()]
  }, [initialPeople, localPeople, normalized, remotePeople])

  return { people, loading, failed }
}
