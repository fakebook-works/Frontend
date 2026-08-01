// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LinkPreview } from './LinkPreview'

const apiMocks = vi.hoisted(() => ({ postDetail: vi.fn() }))
const socialMocks = vi.hoisted(() => ({ getGroup: vi.fn() }))

vi.mock('../api/client', () => ({ api: apiMocks }))
vi.mock('../api/social', () => ({ socialApi: socialMocks }))
vi.mock('../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('LinkPreview privacy', () => {
  beforeEach(() => {
    apiMocks.postDetail.mockReset()
    socialMocks.getGroup.mockReset()
  })

  afterEach(cleanup)

  it('clears an old preview when the next internal target is not visible', async () => {
    apiMocks.postDetail
      .mockResolvedValueOnce({
        __typename: 'FeedPostDetail',
        id: '41',
        type: 2,
        content: 'visible',
        privacy: 0,
        create: '',
        author: { id: '2', name: 'Visible author', avatar: '', isVerified: false },
        media: [{ id: 'm1', type: 0, url: '/media/visible.jpg' }],
      })
      .mockResolvedValueOnce(null)
    const { container, rerender } = render(<LinkPreview content={`${window.location.origin}/content/41`} />)

    expect(await screen.findByText('Visible author')).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('src', '/media/visible.jpg')

    rerender(<LinkPreview content={`${window.location.origin}/content/42`} />)
    await waitFor(() => expect(screen.queryByText('Visible author')).not.toBeInTheDocument())
    expect(container.querySelector('img')).not.toBeInTheDocument()
  })

  it('does not hot-link an arbitrary external image into every viewer browser', async () => {
    const { container } = render(<LinkPreview content="https://tracking.example/pixel.png" />)

    expect(await screen.findByText('tracking.example')).toBeInTheDocument()
    expect(container.querySelector('img')).not.toBeInTheDocument()
  })
})
