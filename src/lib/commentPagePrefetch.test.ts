import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearAllPrefetchedCommentPagesForTests, loadCommentPage, prefetchCommentPage, readCachedCommentPage, type CommentPage } from './commentPagePrefetch'

const socialMocks = vi.hoisted(() => ({ getComments: vi.fn() }))
vi.mock('../api/social', () => ({ socialApi: socialMocks }))

describe('comment page look-ahead cache', () => {
  afterEach(() => {
    clearAllPrefetchedCommentPagesForTests()
    socialMocks.getComments.mockReset()
  })

  it('reuses a prefetched first page throughout its short cache lifetime', async () => {
    const page = { items: [], endCursor: null, hasNextPage: false }
    socialMocks.getComments.mockResolvedValue(page)

    prefetchCommentPage('viewer-1', '42')
    prefetchCommentPage('viewer-1', '42')
    expect(socialMocks.getComments).toHaveBeenCalledTimes(1)

    await expect(loadCommentPage('viewer-1', '42')).resolves.toBe(page)
    expect(socialMocks.getComments).toHaveBeenCalledTimes(1)
    expect(readCachedCommentPage('viewer-1', '42')).toBe(page)

    await loadCommentPage('viewer-1', '42')
    expect(socialMocks.getComments).toHaveBeenCalledTimes(1)
  })

  it('does not use the first-page cache for a pagination cursor', async () => {
    socialMocks.getComments.mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    prefetchCommentPage('viewer-1', '42')

    await loadCommentPage('viewer-1', '42', 30, 'next-page')

    expect(socialMocks.getComments).toHaveBeenLastCalledWith('42', 30, 'next-page')
  })

  it('never shares a prefetched page between signed-in viewers', async () => {
    socialMocks.getComments.mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })

    prefetchCommentPage('viewer-1', '42')
    await loadCommentPage('viewer-1', '42')
    await loadCommentPage('viewer-2', '42')

    expect(socialMocks.getComments).toHaveBeenCalledTimes(2)
  })

  it('shares an in-flight preload with the foreground reader', async () => {
    let resolvePage!: (page: CommentPage) => void
    socialMocks.getComments.mockReturnValue(new Promise((resolve) => { resolvePage = resolve }))

    prefetchCommentPage('viewer-1', '42')
    const foreground = loadCommentPage('viewer-1', '42')
    expect(socialMocks.getComments).toHaveBeenCalledTimes(1)

    const page = { items: [], endCursor: null, hasNextPage: false }
    resolvePage(page)
    await expect(foreground).resolves.toEqual(page)
  })
})
