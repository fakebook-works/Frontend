// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MentionSuggestions } from './MentionSuggestions'

vi.mock('../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../lib/textareaCaret', () => ({
  textareaCaretCoordinates: () => ({ left: 73, top: 28, lineHeight: 18 }),
}))
vi.mock('../lib/useFriendSearch', () => ({
  useFriendSearch: (people: unknown[]) => ({ people, loading: false }),
}))

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
})
