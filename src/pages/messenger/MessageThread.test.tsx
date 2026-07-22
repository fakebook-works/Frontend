// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { useState } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MessengerConversationDto, MessengerMessageDto, UserSummary } from '../../api/types'
import { MessageThread } from './MessageThread'

vi.mock('../../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const me: UserSummary = { id: 'me', username: 'me', displayName: 'Me', avatarUrl: null }
const friend: UserSummary = { id: 'friend', username: 'friend', displayName: 'Friend', avatarUrl: null }
const conversation: MessengerConversationDto = {
  id: 'conversation-1',
  type: 'DIRECT',
  participants: [me, friend],
  title: null,
  avatarUrl: null,
  updatedAt: '2026-07-19T00:00:00.000Z',
  unreadCount: 0,
  lastMessage: null,
}

function makeMessage(id: string, sender: UserSummary, body: string, replyToMessageId?: string): MessengerMessageDto {
  return {
    id,
    conversationId: conversation.id,
    sequence: id === 'original' ? '1' : '2',
    sender,
    body,
    replyToMessageId,
    createdAt: '2026-07-19T00:00:00.000Z',
    status: 'read',
    attachments: [],
    reactions: [],
    deleted: false,
  }
}

function Harness({ messages }: { messages: MessengerMessageDto[] }) {
  const [replyTarget, setReplyTarget] = useState<MessengerMessageDto | null>(null)
  return <MessageThread
    me={me}
    conversation={conversation}
    messages={messages}
    draft=""
    pendingAttachments={[]}
    uploading={false}
    apiState="gateway"
    showDetail={false}
    typingUserId={null}
    replyTarget={replyTarget}
    onInteract={() => undefined}
    onDraftChange={() => undefined}
    onAttachFiles={() => undefined}
    onRemoveAttachment={() => undefined}
    onSubmit={(event) => event.preventDefault()}
    onSendLike={() => undefined}
    onReplyMessage={setReplyTarget}
    onCancelReply={() => setReplyTarget(null)}
    onReactMessage={() => undefined}
    onRecallMessage={() => undefined}
    onForwardMessage={() => undefined}
    onOpenProfile={() => undefined}
    onToggleDetail={() => undefined}
    onBack={() => undefined}
  />
}

function setScrollGeometry(element: HTMLElement, scrollHeight: number, clientHeight: number, scrollTop: number) {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: scrollHeight })
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: clientHeight })
  element.scrollTop = scrollTop
}

describe('MessageThread reply navigation', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  afterEach(cleanup)

  it('keeps the newest message visible when reply opens while the thread is at the bottom', () => {
    const messages = [makeMessage('original', friend, 'First'), makeMessage('latest', me, 'Latest')]
    const { container } = render(<Harness messages={messages} />)
    const list = container.querySelector<HTMLElement>('.messenger-messages')!
    setScrollGeometry(list, 1_000, 400, 600)

    const replyButtons = container.querySelectorAll<HTMLButtonElement>('.message-action-button.reply')
    fireEvent.click(replyButtons[replyButtons.length - 1])

    expect(container.querySelector('.messenger-replying-bar')).toBeInTheDocument()
    expect(list.scrollTop).toBe(1_000)
  })

  it('does not pull the user to the bottom when replying while reading older messages', () => {
    const messages = [makeMessage('original', friend, 'First'), makeMessage('latest', me, 'Latest')]
    const { container } = render(<Harness messages={messages} />)
    const list = container.querySelector<HTMLElement>('.messenger-messages')!
    setScrollGeometry(list, 1_000, 400, 300)

    fireEvent.click(container.querySelector<HTMLButtonElement>('.message-action-button.reply')!)

    expect(container.querySelector('.messenger-replying-bar')).toBeInTheDocument()
    expect(list.scrollTop).toBe(300)
  })

  it('scrolls to and highlights the original message from a sent reply preview', () => {
    const messages = [
      makeMessage('original', friend, 'Original message'),
      makeMessage('reply', me, 'Reply message', 'original'),
    ]
    const { container } = render(<Harness messages={messages} />)
    const original = container.querySelector<HTMLElement>('[data-message-id="original"]')!
    const scrollIntoView = vi.fn()
    Object.defineProperty(original, 'scrollIntoView', { configurable: true, value: scrollIntoView })

    fireEvent.click(container.querySelector<HTMLElement>('.message-reply-source[role="button"]')!)

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(original).toHaveClass('reply-navigation-target')
  })
})
