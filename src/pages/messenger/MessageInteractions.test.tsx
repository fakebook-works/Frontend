// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MessengerMessageDto } from '../../api/types'
import { MessageActionRail, MessageHoverTimestamp, MessageReplyPreview } from './MessageInteractions'
import { formatMessageHoverTime } from './messageInteractionTime'

afterEach(cleanup)

function makeMessage(reaction?: string): MessengerMessageDto {
  return {
    id: 'message-1',
    conversationId: 'conversation-1',
    sender: { id: '1', username: 'me', displayName: 'Me', avatarUrl: null },
    body: 'Hello',
    createdAt: new Date().toISOString(),
    status: 'sent',
    attachments: [],
    reactions: reaction ? [{ userId: '1', emoji: reaction, updatedAt: new Date().toISOString() }] : [],
  }
}

describe('Messenger message interactions', () => {
  it('formats hover timestamps by local calendar boundaries', () => {
    const now = new Date(2026, 6, 18, 21, 0)
    expect(formatMessageHoverTime(new Date(2026, 6, 18, 20, 34).toISOString(), now)).toBe('20:34')
    expect(formatMessageHoverTime(new Date(2026, 6, 17, 20, 34).toISOString(), now)).toContain('Thứ Sáu, 20:34')
    expect(formatMessageHoverTime(new Date(2026, 6, 2, 20, 34).toISOString(), now)).toBe('Ngày 2, 20:34')
    expect(formatMessageHoverTime(new Date(2026, 5, 2, 20, 34).toISOString(), now)).toBe('2 tháng 6, 20:34')
    expect(formatMessageHoverTime(new Date(2025, 5, 2, 20, 34).toISOString(), now)).toBe('2/6/2025, 20:34')
  })

  it('opens the reaction strip from reactoption and sends the selected emoji', async () => {
    const onReact = vi.fn().mockResolvedValue(undefined)
    render(<MessageActionRail message={makeMessage()} viewerId="1" mine onReact={onReact} onReply={() => undefined} onRecall={() => undefined} onForward={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: 'Bày tỏ cảm xúc' }))

    expect(screen.getByRole('menu', { name: 'Chọn cảm xúc' })).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: '🌺' })).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: '👀' })).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: '😱' })).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: '😢' })).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: '🙀' })).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: '👌' })).toBeTruthy()

    fireEvent.click(screen.getByRole('menuitemradio', { name: '😢' }))
    await waitFor(() => expect(onReact).toHaveBeenCalledWith('😢'))
  })

  it('selecting the current reaction removes it', async () => {
    const onReact = vi.fn().mockResolvedValue(undefined)
    render(<MessageActionRail message={makeMessage('😢')} viewerId="1" mine onReact={onReact} onReply={() => undefined} onRecall={() => undefined} onForward={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: 'Bày tỏ cảm xúc' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: '😢' }))

    await waitFor(() => expect(onReact).toHaveBeenCalledWith(null))
  })

  it('shows recall and forward for an own message but never exposes unsupported pin', () => {
    render(<MessageActionRail message={makeMessage()} viewerId="1" mine onReact={() => undefined} onReply={() => undefined} onRecall={() => undefined} onForward={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: 'Tùy chọn khác' }))

    expect(screen.getByRole('menuitem', { name: 'Thu hồi' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Chuyển tiếp' })).toBeTruthy()
    expect(screen.queryByText('Ghim')).toBeNull()
  })

  it('shows the timestamp only while the message content itself is hovered', () => {
    const { container } = render(<div><MessageHoverTimestamp createdAt={new Date().toISOString()} mine /></div>)
    const content = container.firstElementChild as HTMLElement

    expect(screen.queryByRole('tooltip')).toBeNull()
    fireEvent.mouseEnter(content)
    expect(screen.getByRole('tooltip')).toBeTruthy()
    fireEvent.mouseLeave(content)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('renders the active reply composer like the Messenger reference', () => {
    const shiro = { id: '2', username: 'shiro', displayName: 'Shiro', avatarUrl: null }
    const target: MessengerMessageDto = { ...makeMessage(), id: 'target', sender: shiro, body: 'Nothing is impossible' }
    const onCancel = vi.fn()
    const { container } = render(<MessageReplyPreview message={target} viewerId="1" composer onCancel={onCancel} />)

    expect(screen.getByText('Đang trả lời Shiro')).toBeTruthy()
    expect(screen.getByText('Nothing is impossible')).toBeTruthy()
    expect(container.querySelector('.message-reply-preview.composer img')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Hủy trả lời' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('renders a Messenger like icon instead of its encoded value in reply previews', () => {
    const likeMessage: MessengerMessageDto = { ...makeMessage(), body: '[[fakebook:like:3]]' }
    const { container, rerender } = render(<MessageReplyPreview message={likeMessage} viewerId="2" composer />)

    expect(screen.queryByText('[[fakebook:like:3]]')).toBeNull()
    expect(container.querySelector('.message-reply-composer-like svg')).toBeTruthy()

    rerender(<MessageReplyPreview message={likeMessage} viewerId="2" replyingSender={makeMessage().sender} />)
    expect(screen.queryByText('[[fakebook:like:3]]')).toBeNull()
    expect(container.querySelector('.message-reply-preview.like .message-reply-like svg')).toBeTruthy()
  })

  it('renders who replied to whom and selects the text, picture and file reply styles', () => {
    const me = { id: '1', username: 'me', displayName: 'Me', avatarUrl: null }
    const shiro = { id: '2', username: 'shiro', displayName: 'Shiro', avatarUrl: null }
    const target: MessengerMessageDto = { ...makeMessage(), id: 'target', sender: shiro, body: 'Jdjdj' }
    const onNavigate = vi.fn()
    const { rerender, container } = render(<MessageReplyPreview message={target} viewerId="1" replyingSender={me} onNavigate={onNavigate} />)

    expect(screen.getByText('Bạn đã trả lời Shiro')).toBeTruthy()
    expect(screen.getByText('Jdjdj')).toBeTruthy()
    expect(container.querySelector('.message-reply-preview')).toHaveClass('text')
    fireEvent.click(screen.getByRole('button', { name: 'Đi tới tin nhắn được trả lời' }))
    expect(onNavigate).toHaveBeenCalledOnce()

    rerender(<MessageReplyPreview message={{ ...target, body: '', attachments: [{ url: '/photo.jpg', type: 'image', contentType: 'image/jpeg', size: 1, name: 'photo.jpg' }] }} viewerId="1" replyingSender={me} />)
    expect(container.querySelector('.message-reply-preview')).toHaveClass('picture')
    expect(container.querySelector('.message-reply-source img')).toBeTruthy()

    rerender(<MessageReplyPreview message={{ ...target, body: '', attachments: [{ url: '/file.pdf', type: 'file', contentType: 'application/pdf', size: 1, name: 'file.pdf' }] }} viewerId="1" replyingSender={me} />)
    expect(container.querySelector('.message-reply-preview')).toHaveClass('file')
    expect(screen.getByText('File đính kèm')).toBeTruthy()

    rerender(<MessageReplyPreview message={{ ...target, body: '', attachments: [{ url: '/voice.webm', type: 'audio', contentType: 'audio/webm', size: 1, name: 'voice.webm' }] }} viewerId="1" replyingSender={me} />)
    expect(container.querySelector('.message-reply-preview')).toHaveClass('voice')
    expect(screen.getByText('Tin nhắn thoại')).toBeTruthy()
  })
})
