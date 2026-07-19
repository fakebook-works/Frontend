// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MentionContent } from './MentionContent'

vi.mock('../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('MentionContent', () => {
  it('renders the current name without an at sign and navigates to the profile', () => {
    const onNavigate = vi.fn()
    render(<p><MentionContent content="Hello [[mention:12]]" mentions={[{ userId: '12', name: 'New Name', available: true }]} onNavigate={onNavigate} /></p>)
    const mention = screen.getByRole('button', { name: 'New Name' })
    expect(screen.queryByText('@New Name')).not.toBeInTheDocument()
    fireEvent.click(mention)
    expect(onNavigate).toHaveBeenCalledWith('/profile/12')
  })

  it('uses the unavailable-user fallback when the ID cannot be resolved', () => {
    render(<p><MentionContent content="Hello [[mention:12]]" /></p>)
    expect(screen.getByText('fakebookUser')).toHaveClass('mention-content-name', 'unavailable')
  })
})
