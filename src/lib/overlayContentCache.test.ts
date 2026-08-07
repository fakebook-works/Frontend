import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GatewayPost } from '../api/gatewayTypes'
import { clearOverlayContentForViewer, stageOverlayContent, takeOverlayContent } from './overlayContentCache'

const post = {
  __typename: 'FeedPostDetail',
  id: 'post-1',
  type: 0,
  content: 'cached post',
  privacy: 0,
  create: '2026-08-07T00:00:00.000Z',
  author: { id: 'author-1', name: 'Author', avatar: '', isVerified: false },
  media: [],
  mentions: [],
  taggedUsers: [],
  sharedSource: null,
} satisfies GatewayPost

afterEach(() => {
  clearOverlayContentForViewer('viewer-a')
  clearOverlayContentForViewer('viewer-b')
  vi.useRealTimers()
})

describe('overlay content snapshots', () => {
  it('consumes an authorized projection once for the viewer that initiated navigation', () => {
    stageOverlayContent('viewer-a', post)

    expect(takeOverlayContent('viewer-b', post.id)).toBeNull()
    expect(takeOverlayContent('viewer-a', post.id)).toBe(post)
    expect(takeOverlayContent('viewer-a', post.id)).toBeNull()
  })

  it('expires snapshots instead of retaining stale content indefinitely', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-07T00:00:00.000Z'))
    stageOverlayContent('viewer-a', post)

    vi.advanceTimersByTime(15_001)

    expect(takeOverlayContent('viewer-a', post.id)).toBeNull()
  })
})
