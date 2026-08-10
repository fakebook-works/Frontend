// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { createRef } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MentionSuggestions } from './MentionSuggestions'

vi.mock('../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../lib/textareaCaret', () => ({
  textareaCaretCoordinates: () => ({ left: 73, top: 28, lineHeight: 18 }),
}))
vi.mock('../lib/useFriendSearch', () => ({
  useFriendSearch: (people: unknown[]) => ({ people, loading: false }),
}))

afterEach(cleanup)

describe('MentionSuggestions UI', () => {
  it('keeps the compact list anchored immediately below the typed at sign', () => {
    const textareaRef = createRef<HTMLTextAreaElement>()
    const onSelected = vi.fn()
    const person = { id: '12', username: 'friend-one', displayName: 'Friend One', avatarUrl: null }

    render(<div className="mention-compose-field">
      <textarea ref={textareaRef} defaultValue="Hello @Fr" />
      <MentionSuggestions
        text="Hello @Fr"
        people={[person]}
        textareaRef={textareaRef}
        caretIndex={9}
        onSelected={onSelected}
      />
    </div>)

    const list = screen.getByRole('listbox', { name: 'mentionPeople' })
    expect(list.parentElement).toBe(document.body)
    expect(list).toHaveStyle({ left: '68px', top: '31px', width: '248px' })
    fireEvent.click(screen.getByRole('option', { name: /Friend One/ }))
    expect(onSelected).toHaveBeenCalledWith(person, { start: 6, end: 9, query: 'fr' })
  })

  it('supports a five-person comment list above the input without a scrolling class', () => {
    const textareaRef = createRef<HTMLTextAreaElement>()
    const people = Array.from({ length: 7 }, (_, index) => ({
      id: String(index + 1),
      username: `friend-${index + 1}`,
      displayName: `Friend ${index + 1}`,
      avatarUrl: null,
    }))

    render(<div className="mention-compose-field">
      <textarea ref={textareaRef} defaultValue="@" />
      <MentionSuggestions
        text="@"
        people={people}
        textareaRef={textareaRef}
        caretIndex={1}
        onSelected={vi.fn()}
        placement="above"
        limit={5}
        className="comment-mention-suggestions"
        fitToNames
      />
    </div>)

    const list = screen.getByRole('listbox', { name: 'mentionPeople' })
    expect(list).toHaveClass('above', 'comment-mention-suggestions')
    expect(screen.getAllByRole('option')).toHaveLength(5)
    expect(Number.parseFloat(list.style.top)).toBeLessThan(31)
    expect(list).toHaveStyle({ width: '150px' })
  })

  it('selects mentions with Arrow keys and Tab while retaining textarea focus', () => {
    const textareaRef = createRef<HTMLTextAreaElement>()
    const onSelected = vi.fn()
    const onDismiss = vi.fn()
    const people = [
      { id: '1', username: 'first', displayName: 'First Friend', avatarUrl: null },
      { id: '2', username: 'second', displayName: 'Second Friend', avatarUrl: null },
    ]

    render(<div className="mention-compose-field">
      <textarea ref={textareaRef} defaultValue="@" />
      <MentionSuggestions text="@" people={people} textareaRef={textareaRef} caretIndex={1} onSelected={onSelected} onDismiss={onDismiss} />
    </div>)

    const textarea = textareaRef.current
    expect(textarea).not.toBeNull()
    fireEvent.keyDown(textarea!, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: /Second Friend/ })).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(textarea!, { key: 'Tab' })
    expect(onSelected).toHaveBeenCalledWith(people[1], { start: 0, end: 1, query: '' })
    fireEvent.keyDown(textarea!, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
