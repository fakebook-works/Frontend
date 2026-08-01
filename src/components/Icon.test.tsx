// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icon } from './Icon'

describe('shared people icons', () => {
  it('renders the canonical Friends-page pair for every generic friends icon', () => {
    const { container } = render(<Icon name="friends" size={20} className="test-friends" />)
    const glyph = container.querySelector('.test-friends')
    expect(glyph).toHaveClass('friend-people-glyph', 'is-filled')
    expect(glyph).toHaveAttribute('width', '20')
    expect(glyph?.querySelectorAll(':scope > g')).toHaveLength(3)
    expect(glyph?.querySelector('.friend-people-front')).toHaveAttribute('transform', 'translate(8 14.4) scale(.9)')
  })

  it('keeps the full-size Friends-page person and embeds a proportionate action badge', () => {
    const { container } = render(<Icon name="userPlus" size={18} />)
    const glyph = container.querySelector('.friend-person-action-glyph.is-add')
    expect(glyph).toHaveAttribute('width', '18')
    expect(glyph?.querySelector('.friend-person-action-person')).toHaveAttribute('transform', 'translate(12 13)')
    expect(glyph?.querySelector('.friend-person-action-symbol > path')).toHaveAttribute('d', 'M15.8 16.1v6.2m-3.1-3.1h6.2')
  })

  it('renders a plain user with the same person geometry', () => {
    const { container } = render(<Icon name="user" size={16} />)
    expect(container.querySelector('.friend-person-glyph > g')).toHaveAttribute('transform', 'translate(12 13)')
  })
})
