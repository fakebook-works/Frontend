// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MentionContent, RichTextContent } from './MentionContent'

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

  it('renders safe URLs as blue navigable links without changing mention rendering', () => {
    const onNavigate = vi.fn()
    window.history.replaceState({}, '', '/home')
    render(<p><MentionContent content={`See ${window.location.origin}/content/42 and [[mention:12]]`} mentions={[{ userId: '12', name: 'Friend', available: true }]} onNavigate={onNavigate} /></p>)
    const link = screen.getByRole('link', { name: `${window.location.origin}/content/42` })
    expect(link).toHaveClass('inline-content-link')
    fireEvent.click(link)
    expect(onNavigate).toHaveBeenCalledWith('/content/42')
    expect(screen.getByRole('button', { name: 'Friend' })).toBeInTheDocument()
  })

  it('renders a Unicode hashtag like a mention and navigates to post search', () => {
    const onNavigate = vi.fn()
    render(<p><MentionContent content="Nội dung #thước_phim hôm nay" onNavigate={onNavigate} /></p>)

    const hashtag = screen.getByRole('link', { name: '#thước_phim' })
    expect(hashtag).toHaveClass('mention-content-link', 'hashtag-content-link')
    fireEvent.click(hashtag)
    expect(onNavigate).toHaveBeenCalledWith('/search?q=%23th%C6%B0%E1%BB%9Bc_phim&tab=posts')
  })

  it('does not let hashtag pointer events reopen an enclosing detail viewer', () => {
    const onNavigate = vi.fn()
    const openDetail = vi.fn()
    render(<div onPointerDown={openDetail} onClick={openDetail}><MentionContent content="#hashtag" onNavigate={onNavigate} /></div>)

    const hashtag = screen.getByRole('link', { name: '#hashtag' })
    fireEvent.pointerDown(hashtag)
    fireEvent.click(hashtag)

    expect(openDetail).not.toHaveBeenCalled()
    expect(onNavigate).toHaveBeenCalledWith('/search?q=%23hashtag&tab=posts')
  })

  it('does not mistake a URL fragment or a lone hash for a hashtag', () => {
    render(<p><RichTextContent content="https://example.com/post#section # và #hợp_lệ" /></p>)

    expect(screen.getByRole('link', { name: 'https://example.com/post#section' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '#section' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '#hợp_lệ' })).toBeInTheDocument()
  })
})
