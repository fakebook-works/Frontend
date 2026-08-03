// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { MentionDraftOverlay } from './MentionDraftOverlay'

afterEach(cleanup)

function Subject({ text }: { text: string }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  return <div className="mention-compose-field">
    <MentionDraftOverlay text={text} entities={[]} textareaRef={textareaRef} />
    <textarea ref={textareaRef} value={text} readOnly />
  </div>
}

describe('MentionDraftOverlay', () => {
  it('highlights a typed hashtag without changing the textarea value', () => {
    const { container, rerender } = render(<Subject text="Nội dung" />)
    rerender(<Subject text="Nội dung #thước_phim" />)

    expect(container.querySelector('.hashtag-draft-name')).toHaveTextContent('#thước_phim')
    expect(container.querySelector('textarea')).toHaveClass('mention-draft-input')
    expect(container.querySelector('textarea')).toHaveValue('Nội dung #thước_phim')
  })

  it('does not activate for a URL fragment', () => {
    const { container } = render(<Subject text="https://example.com/post#section" />)

    expect(container.querySelector('.mention-draft-overlay')).not.toBeInTheDocument()
    expect(container.querySelector('textarea')).not.toHaveClass('mention-draft-input')
  })
})
