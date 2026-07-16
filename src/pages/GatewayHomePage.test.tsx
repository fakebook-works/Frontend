// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GatewayHomePage } from './GatewayHomePage'

const apiMocks = vi.hoisted(() => ({
  recommendedFeed: vi.fn(),
  homeStories: vi.fn(),
  myStories: vi.fn(),
  visitedGroups: vi.fn(),
  recordGroupVisit: vi.fn(),
  uploadMedia: vi.fn(),
  createFeedPost: vi.fn(),
  postDetail: vi.fn(),
  createNormalStory: vi.fn(),
  deleteStory: vi.fn(),
}))
const translate = vi.hoisted(() => (key: string) => key)

vi.mock('../api/client', () => ({
  api: apiMocks,
  visibleRecommendationPosts: (items: Array<{ post: unknown | null }>) => items.flatMap((item) => item.post ? [item.post] : []),
}))

vi.mock('../api/social', () => ({ socialApi: { getRelationProfiles: vi.fn().mockResolvedValue([]) } }))
vi.mock('../components/ContentActions', () => ({ ContentActions: () => <div data-testid="content-actions" /> }))

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    user: { userId: '9007199254740993123', email: 'owner@example.com', validDate: null, status: 1 },
  }),
}))

vi.mock('../i18n', () => ({
  useI18n: () => ({
    locale: 'en',
    t: translate,
  }),
}))

describe('GatewayHomePage', () => {
  beforeEach(() => {
    apiMocks.recommendedFeed.mockResolvedValue([])
    apiMocks.homeStories.mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    apiMocks.myStories.mockResolvedValue(null)
    apiMocks.visitedGroups.mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    apiMocks.recordGroupVisit.mockResolvedValue(true)
    apiMocks.uploadMedia.mockReset()
    apiMocks.createFeedPost.mockReset()
    apiMocks.postDetail.mockReset()
    apiMocks.createNormalStory.mockReset()
    apiMocks.deleteStory.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders honest empty states for all composed services', async () => {
    render(<GatewayHomePage />)

    expect(await screen.findByText('noRecommendedPosts')).toBeInTheDocument()
    expect(screen.getByText('noStories')).toBeInTheDocument()
    expect(screen.getByText('noVisitedGroups')).toBeInTheDocument()
    expect(apiMocks.recommendedFeed).toHaveBeenCalledWith('9007199254740993123', 0, 12)
  })

  it('renders retryable service errors', async () => {
    apiMocks.recommendedFeed.mockRejectedValueOnce(new Error('offline'))
    apiMocks.homeStories.mockRejectedValueOnce(new Error('offline'))
    render(<GatewayHomePage />)

    expect(await screen.findByText('feedLoadError')).toBeInTheDocument()
    expect(await screen.findByText('storiesLoadError')).toBeInTheDocument()
    expect(screen.getAllByText('tryAgain')).toHaveLength(1)
  })

  it('hydrates and inserts a newly created SocialGraph post', async () => {
    apiMocks.createFeedPost.mockResolvedValue({ id: '42' })
    apiMocks.postDetail.mockResolvedValue({
      __typename: 'FeedPostDetail',
      id: '42',
      type: 1,
      content: 'Hello Gateway',
      privacy: 0,
      create: '2026-07-15T12:00:00Z',
      author: { id: '9007199254740993123', name: 'Owner', avatar: '', isVerified: true, canFollow: false },
      media: [],
    })
    render(<GatewayHomePage />)

    fireEvent.change(screen.getByPlaceholderText('postComposerPlaceholder'), { target: { value: 'Hello Gateway' } })
    fireEvent.click(screen.getByRole('button', { name: 'post' }))

    expect(await screen.findByText('Hello Gateway')).toBeInTheDocument()
    expect(screen.getByLabelText('verifiedAccount')).toBeInTheDocument()
    expect(screen.getByText('publishPostSuccess')).toBeInTheDocument()
    await waitFor(() => expect(apiMocks.postDetail).toHaveBeenCalledWith('42'))
  })

  it('uploads media then saves returned URL through createFeedPost', async () => {
    apiMocks.uploadMedia.mockResolvedValue({
      url: 'https://uploads.example.com/media/files/photo.png',
      type: 'image',
      contentType: 'image/png',
      size: 4,
      name: 'photo.png',
    })
    apiMocks.createFeedPost.mockResolvedValue({ id: '43' })
    apiMocks.postDetail.mockResolvedValue(null)
    render(<GatewayHomePage />)

    const file = new File([new Uint8Array([137, 80, 78, 71])], 'photo.png', { type: 'image/png' })
    const fileInputs = screen.getAllByLabelText('photoVideo')
    fireEvent.change(fileInputs[fileInputs.length - 1], { target: { files: [file] } })
    fireEvent.change(screen.getByPlaceholderText('postComposerPlaceholder'), { target: { value: 'Photo post' } })
    fireEvent.click(screen.getByRole('button', { name: 'post' }))

    await waitFor(() => expect(apiMocks.createFeedPost).toHaveBeenCalledWith({
      authorId: '9007199254740993123',
      content: 'Photo post',
      privacy: 0,
      media: [{ type: 0, url: 'https://uploads.example.com/media/files/photo.png' }],
    }))
  })
})
