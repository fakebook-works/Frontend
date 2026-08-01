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
      }}
    />)

    expect(screen.getByLabelText('privateGroup')).toBeInTheDocument()
    expect(container.querySelector('.group-private-privacy-icon .group-private-privacy-glyph')).toBeInTheDocument()
  })
})
