// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Avatar, DEFAULT_AVATAR_URL } from './Avatar'

afterEach(cleanup)

describe('Avatar', () => {
  it('uses the shared frontend avatar when a user has no uploaded avatar', () => {
    const { container } = render(<Avatar name="Default User" src={null} />)

    expect(container.querySelector('img')).toHaveAttribute('src', DEFAULT_AVATAR_URL)
  })

  it('falls back to the shared avatar when the requested user image cannot load', () => {
    const { container } = render(<Avatar name="Broken Avatar" src="/missing-avatar.jpg" />)

    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toHaveAttribute('src', DEFAULT_AVATAR_URL)
  })

  it('keeps initials available for non-user entities', () => {
    render(<Avatar name="Fakebook Group" src={null} fallback="initials" />)

    expect(document.querySelector('img')).not.toBeInTheDocument()
    expect(screen.getByText('FG')).toBeInTheDocument()
  })

  it('does not reuse the user default avatar for non-user entities', () => {
    render(<Avatar name="Fakebook Group" src={DEFAULT_AVATAR_URL} fallback="initials" />)

    expect(document.querySelector('img')).not.toBeInTheDocument()
    expect(screen.getByText('FG')).toBeInTheDocument()
  })
})
