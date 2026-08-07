// @vitest-environment jsdom
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { groupMemberRoute, navigate, pathSegment, useAppLocation } from './router'

function LocationProbe() {
  const [location] = useAppLocation()
  return createElement('output', { 'data-testid': 'location-probe' }, JSON.stringify({
    pathname: location.pathname,
    search: location.search,
    state: location.state,
  }))
}

afterEach(cleanup)

describe('application router', () => {
  it('navigates with the History API while preserving query strings', () => {
    window.history.replaceState({}, '', '/')
    navigate('/search?q=hello%20world&tab=people')
    expect(window.location.pathname).toBe('/search')
    expect(new URLSearchParams(window.location.search).get('q')).toBe('hello world')
    expect(window.history.state).toEqual({})
  })

  it('pushes caller-provided state and exposes it through the location hook', () => {
    window.history.replaceState({ page: 'home' }, '', '/home')
    render(createElement(LocationProbe))

    act(() => {
      navigate('/content/post-42', {
        state: { fakebookOverlay: { backgroundHref: '/home' } },
      })
    })

    expect(window.history.state).toEqual({ fakebookOverlay: { backgroundHref: '/home' } })
    expect(JSON.parse(screen.getByTestId('location-probe').textContent || '{}')).toEqual({
      pathname: '/content/post-42',
      search: '',
      state: { fakebookOverlay: { backgroundHref: '/home' } },
    })
  })

  it('replaces state on the current URL without adding a history entry', () => {
    window.history.replaceState({ stage: 'post' }, '', '/content/post-42')
    const historyLength = window.history.length

    navigate('/content/post-42', { replace: true, state: { stage: 'media' } })

    expect(window.location.pathname).toBe('/content/post-42')
    expect(window.history.length).toBe(historyLength)
    expect(window.history.state).toEqual({ stage: 'media' })
  })

  it('refreshes pathname, search and state after a native popstate event', () => {
    window.history.replaceState({ page: 'home' }, '', '/home')
    render(createElement(LocationProbe))

    window.history.replaceState({ page: 'profile' }, '', '/profile/user-7?tab=reels')
    fireEvent.popState(window, { state: window.history.state })

    expect(JSON.parse(screen.getByTestId('location-probe').textContent || '{}')).toEqual({
      pathname: '/profile/user-7',
      search: '?tab=reels',
      state: { page: 'profile' },
    })
  })

  it('decodes dynamic path segments', () => {
    expect(pathSegment('/profile/user%201', 1)).toBe('user 1')
    expect(pathSegment('/home', 1)).toBeNull()
  })

  it('recognizes a group-scoped member profile without treating it as the group page', () => {
    expect(groupMemberRoute('/groups/9007199254740993123/members/9007199254740993999')).toEqual({
      groupId: '9007199254740993123',
      profileId: '9007199254740993999',
    })
    expect(groupMemberRoute('/groups/9007199254740993123')).toBeNull()
  })
})
