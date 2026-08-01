// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
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
        content: 'Bài viết nhóm',
        privacy: 1,
        create: '2026-07-31T12:00:00Z',
        author: { id: '11', name: 'Lan', avatar: '', isVerified: false },
        media: [],
        group: { id: '8', name: 'Nhóm', avatar: '', background: '', privacy: 1, memberCount: 12, viewerIsMember: true, joinRequestPending: false },
      }}
    />)

    expect(screen.getByLabelText('privateGroup')).toBeInTheDocument()
    expect(container.querySelector('.group-private-privacy-icon .group-private-privacy-glyph')).toBeInTheDocument()
  })

  it('never renders protected fields and keeps a square group avatar for an unavailable private group post', () => {
    const { container } = render(<SharedPostSourceCard locale="vi-VN" source={{
      id: '92', isAvailable: false, type: 3, content: null, privacy: 1, create: null, author: null, media: [],
      requiresGroupMembership: true,
      group: { id: '8', name: 'Nhóm kín', avatar: '', background: '/cover.jpg', privacy: 1, memberCount: 42, viewerIsMember: false, joinRequestPending: false },
    }} />)

    expect(screen.getByText('privateGroupPostUnavailable')).toBeInTheDocument()
    expect(screen.getByText('Nhóm kín')).toBeInTheDocument()
    expect(screen.queryByText('Bài viết bí mật')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'joinGroupLong' })).toBeInTheDocument()
    expect(container.querySelector('.private-group-source .shared-group-card-avatar')).toBeInTheDocument()
  })

  it('renders a shared Group as a cover/avatar/member card instead of a fake post author', () => {
    const { container } = render(<SharedPostSourceCard locale="vi-VN" source={{
      id: '8', isAvailable: true, type: 1, content: null, privacy: 0, create: '', author: null, media: [],
      group: { id: '8', name: 'Nhóm công nghệ', avatar: '/avatar.jpg', background: '/cover.jpg', privacy: 0, memberCount: 99, viewerIsMember: false, joinRequestPending: false },
    }} />)

    expect(screen.getByText('Nhóm công nghệ')).toBeInTheDocument()
    expect(document.querySelector('.shared-group-source .shared-group-cover')).toBeInTheDocument()
    expect(container.querySelector('.shared-group-source .shared-group-card-avatar')).toBeInTheDocument()
    expect(screen.queryByText('fakebookUser')).not.toBeInTheDocument()
  })
})
