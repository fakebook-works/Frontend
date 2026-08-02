// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SharedPostSourceCard } from './SharedPostSourceCard'

vi.mock('../i18n', () => ({ useI18n: () => ({ locale: 'vi-VN', t: (key: string) => key }) }))

describe('SharedPostSourceCard', () => {
  afterEach(cleanup)

  it('uses the shared group-members glyph for a private shared group post', () => {
    const { container } = render(<SharedPostSourceCard
      locale="vi-VN"
      source={{
        id: '91',
        isAvailable: true,
        type: 3,
        content: 'Group post',
        privacy: 1,
        create: '2026-07-31T12:00:00Z',
        author: { id: '11', name: 'Lan', avatar: '', isVerified: false },
        media: [],
        group: { id: '8', name: 'Group', avatar: '', background: '', privacy: 1, memberCount: 12, viewerIsMember: true, joinRequestPending: false },
      }}
    />)

    expect(screen.getByLabelText('privateGroup')).toBeInTheDocument()
    expect(container.querySelector('.group-private-privacy-icon .group-private-privacy-glyph')).toBeInTheDocument()
  })

  it('never renders protected fields and keeps a square group avatar for an unavailable private group post', () => {
    const { container } = render(<SharedPostSourceCard locale="vi-VN" source={{
      id: '92', isAvailable: false, type: 3, content: null, privacy: 1, create: null, author: null, media: [],
      requiresGroupMembership: true,
      group: { id: '8', name: 'Private group', avatar: '', background: '/cover.jpg', privacy: 1, memberCount: 42, viewerIsMember: false, joinRequestPending: false },
    }} />)

    expect(screen.getByText('privateGroupPostUnavailable')).toBeInTheDocument()
    expect(screen.getByText('Private group')).toBeInTheDocument()
    expect(screen.queryByText('Protected post')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'joinGroupLong' })).toBeInTheDocument()
    expect(container.querySelector('.private-group-source .shared-group-card-avatar')).toBeInTheDocument()
  })

  it('renders a shared Group as a cover/avatar/member card instead of a fake post author', () => {
    const { container } = render(<SharedPostSourceCard locale="vi-VN" source={{
      id: '8', isAvailable: true, type: 1, content: null, privacy: 0, create: '', author: null, media: [],
      group: { id: '8', name: 'Technology group', avatar: '/avatar.jpg', background: '/cover.jpg', privacy: 0, memberCount: 99, viewerIsMember: false, joinRequestPending: false },
    }} />)

    expect(screen.getByText('Technology group')).toBeInTheDocument()
    expect(document.querySelector('.shared-group-source .shared-group-cover')).toBeInTheDocument()
    expect(container.querySelector('.shared-group-source .shared-group-card-avatar')).toBeInTheDocument()
    expect(screen.queryByText('fakebookUser')).not.toBeInTheDocument()
  })

  it('renders a shared Reel with the original crop and opens the Reel viewer', () => {
    const onOpenReel = vi.fn()
    const source = {
      id: '93',
      isAvailable: true,
      type: 4,
      content: 'cropped Reel',
      privacy: 0,
      create: '2026-08-03T10:00:00Z',
      aspectRatio: 9 / 16,
      focalPointX: 0.25,
      focalPointY: 0.75,
      author: { id: '12', name: 'Minh', avatar: '', isVerified: false },
      media: [{ id: '901', type: 1, url: '/media/reel.mp4' }],
    }

    const { container } = render(<SharedPostSourceCard locale="vi-VN" source={source} onOpenReel={onOpenReel} />)

    expect(container.querySelector('.post-video-crop-frame')).toHaveStyle({ aspectRatio: String(9 / 16) })
    expect(container.querySelector('video')).toHaveStyle({ objectPosition: '25% 75%' })
    fireEvent.click(container.querySelector('video')!)
    expect(onOpenReel).toHaveBeenCalledWith(source)
  })
})
