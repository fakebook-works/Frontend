// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { groupMemberRoute, navigate, pathSegment } from './router'

describe('application router', () => {
  it('navigates with the History API while preserving query strings', () => {
    window.history.replaceState({}, '', '/')
    navigate('/search?q=hello%20world&tab=people')
    expect(window.location.pathname).toBe('/search')
    expect(new URLSearchParams(window.location.search).get('q')).toBe('hello world')
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
