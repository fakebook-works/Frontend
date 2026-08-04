// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const gatewayGraphQl = vi.hoisted(() => vi.fn())
const getProfiles = vi.hoisted(() => vi.fn())
const subscribeGatewayGraphQl = vi.hoisted(() => vi.fn())

vi.mock('./client', () => ({
  gatewayGraphQl,
  graphQlLongLiteral: (value: string) => {
    if (!/^[1-9]\d*$/.test(value)) throw new Error('invalid id')
    return value
  },
}))
vi.mock('./realtime', () => ({ subscribeGatewayGraphQl }))
vi.mock('./social', () => ({ socialApi: { getProfiles } }))

import { conversationMedia, createGroupConversation, deleteGroupConversation, deleteMessage, directConversations, editMessage, heartbeatPresence, markDelivered, markRead, message, messages, presence, sendMessage, setConversationMemberRole, setMessageReaction, setTyping, subscribeConversations, subscribePresence, updateGroupConversation } from './messenger'

describe('messenger GraphQL adapter', () => {
  beforeEach(() => {
    gatewayGraphQl.mockReset()
    getProfiles.mockReset().mockResolvedValue([])
    subscribeGatewayGraphQl.mockReset().mockReturnValue(() => undefined)
  })

  it('creates a group with lossless Long literals and maps participant roles', async () => {
    gatewayGraphQl.mockResolvedValue({
      createGroupConversation: {
        id: 'conversation-1',
        type: 'GROUP',
        title: 'Weekend plans',
        avatarUrl: null,
        updatedAt: '2026-07-16T00:00:00Z',
        currentSequence: '0',
        participants: [
          { userId: '9007199254740993123', role: 'ADMIN', leftAt: null, lastDeliveredSequence: '0', lastReadSequence: '0', user: { id: '9007199254740993123', name: 'Me', avatar: '', isVerified: false } },
          { userId: '9007199254740993124', role: 'MEMBER', leftAt: null, lastDeliveredSequence: '0', lastReadSequence: '0', user: { id: '9007199254740993124', name: 'Friend A', avatar: '', isVerified: false } },
          { userId: '9007199254740993125', role: 'MEMBER', leftAt: null, lastDeliveredSequence: '0', lastReadSequence: '0', user: { id: '9007199254740993125', name: 'Friend B', avatar: '', isVerified: false } },
        ],
        lastMessage: null,
      },
    })

    const result = await createGroupConversation(
      'Weekend plans',
      ['9007199254740993124', '9007199254740993125'],
      '9007199254740993123',
    )

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('memberUserIds: [9007199254740993124, 9007199254740993125]')
    expect(result.type).toBe('GROUP')
    expect(result.participants[0]).toMatchObject({ id: '9007199254740993123', role: 'ADMIN' })
    expect(result.participants[1]).toMatchObject({ id: '9007199254740993124', role: 'MEMBER' })
  })

  it('rejects a group with fewer than two friends before network I/O', async () => {
    await expect(createGroupConversation('Too small', ['2'], '1')).rejects.toThrow()
    expect(gatewayGraphQl).not.toHaveBeenCalled()
  })

  it('omits unchanged optional group fields instead of accidentally clearing them', async () => {
    gatewayGraphQl.mockResolvedValue({
      updateGroupConversation: {
        id: 'group-1', type: 'GROUP', title: 'Renamed', avatarUrl: '/media/files/avatar.jpg',
        updatedAt: '2026-07-28T00:00:00Z', currentSequence: '0', lastMessage: null,
        participants: [{ userId: '1', role: 'ADMIN', leftAt: null, lastDeliveredSequence: '0', lastReadSequence: '0', user: { id: '1', name: 'Me', avatar: '', isVerified: false } }],
      },
    })

    await updateGroupConversation('group-1', '1', { title: 'Renamed' })

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('title: $title')
    expect(gatewayGraphQl.mock.calls[0][0]).not.toContain('avatarUrl: $avatarUrl')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ conversationId: 'group-1', title: 'Renamed' })
  })

  it('changes group roles with a lossless user id and deletes a group', async () => {
    gatewayGraphQl
      .mockResolvedValueOnce({
        setConversationMemberRole: {
          id: 'group-1', type: 'GROUP', title: 'Group', avatarUrl: null,
          updatedAt: '2026-07-28T00:00:00Z', currentSequence: '0', lastMessage: null,
          participants: [
            { userId: '1', role: 'ADMIN', leftAt: null, lastDeliveredSequence: '0', lastReadSequence: '0', user: { id: '1', name: 'Me', avatar: '', isVerified: false } },
            { userId: '9007199254740993124', role: 'ADMIN', leftAt: null, lastDeliveredSequence: '0', lastReadSequence: '0', user: { id: '9007199254740993124', name: 'Friend', avatar: '', isVerified: false } },
          ],
        },
      })
      .mockResolvedValueOnce({ deleteGroupConversation: true })

    const updated = await setConversationMemberRole('group-1', '9007199254740993124', 'ADMIN', '1')
    const deleted = await deleteGroupConversation('group-1')

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('userId: 9007199254740993124, role: ADMIN')
    expect(updated.participants[1].role).toBe('ADMIN')
    expect(gatewayGraphQl.mock.calls[1][0]).toContain('deleteGroupConversation')
    expect(deleted).toBe(true)
  })

  it('loads only the server-scoped direct conversation contact source', async () => {
    gatewayGraphQl.mockResolvedValue({
      myDirectConversations: {
        items: [{
          id: 'direct-1', type: 'DIRECT', title: null, avatarUrl: null,
          updatedAt: '2026-07-17T00:00:00Z', currentSequence: '0', lastMessage: null,
          participants: [
            { userId: '1', role: 'MEMBER', leftAt: null, lastDeliveredSequence: '0', lastReadSequence: '0', user: { id: '1', name: 'Me', avatar: '', isVerified: false } },
            { userId: '2', role: 'MEMBER', leftAt: null, lastDeliveredSequence: '0', lastReadSequence: '0', user: { id: '2', name: 'Direct Contact', avatar: '', isVerified: false } },
          ],
        }],
      },
    })

    const result = await directConversations('1', 40)

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('myDirectConversations')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ first: 40, after: null })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'direct-1', type: 'DIRECT' })
  })

  it('keeps a direct conversation readable when the federated target is hidden by a block', async () => {
    getProfiles.mockResolvedValue([{
      id: '1', username: 'me', displayName: 'Me', avatarUrl: null, isVerified: false,
    }])
    gatewayGraphQl.mockResolvedValue({
      myDirectConversations: {
        items: [{
          id: 'direct-blocked', type: 'DIRECT', title: null, avatarUrl: null,
          updatedAt: '2026-07-17T00:00:00Z', currentSequence: '2', lastMessage: null,
          viewerHasBlockedDirectUser: false, directUserHasBlockedViewer: true,
          participants: [
            { userId: '1', role: 'MEMBER', leftAt: null, lastDeliveredSequence: '0', lastReadSequence: '0' },
            { userId: '2', role: 'MEMBER', leftAt: null, lastDeliveredSequence: '0', lastReadSequence: '0' },
          ],
        }],
      },
    })

    const result = await directConversations('1', 40)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'direct-blocked', directUserHasBlockedViewer: true })
    expect(gatewayGraphQl.mock.calls[0][0]).not.toContain('user {')
    expect(gatewayGraphQl.mock.calls[0][0]).not.toContain('sender {')
    expect(gatewayGraphQl.mock.calls[0][0]).not.toContain('systemSubject {')
    expect(getProfiles).toHaveBeenCalledWith(['1', '2'])
    expect(result[0].participants).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: '2', displayName: 'Fakebook user' }),
    ]))
  })

  it('loads presence with lossless friend IDs and sends the current-user heartbeat', async () => {
    gatewayGraphQl
      .mockResolvedValueOnce({ userPresence: [{ userId: '9007199254740993124', isOnline: true, expiresAt: '2026-07-18T00:01:00Z', updatedAt: '2026-07-18T00:00:00Z' }] })
      .mockResolvedValueOnce({ heartbeatPresence: { userId: '9007199254740993123', isOnline: true, expiresAt: '2026-07-18T00:01:00Z', updatedAt: '2026-07-18T00:00:00Z' } })

    const statuses = await presence(['9007199254740993124'])
    const heartbeat = await heartbeatPresence()

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('userPresence(userIds: [9007199254740993124])')
    expect(statuses[0]).toMatchObject({ userId: '9007199254740993124', isOnline: true })
    expect(gatewayGraphQl.mock.calls[1][0]).toContain('heartbeatPresence')
    expect(heartbeat.userId).toBe('9007199254740993123')
  })

  it('returns a sent message without an extra SocialGraph profile round trip', async () => {
    gatewayGraphQl.mockResolvedValue({
      sendMessage: {
        id: 'message-1',
        conversationId: 'conversation-1',
        senderUserId: '1',
        sequence: '3',
        text: 'Hello',
        createdAt: '2026-07-18T00:00:00Z',
        deleted: false,
        attachments: [],
      },
    })
    const viewer = { id: '1', username: 'me', displayName: 'Me', avatarUrl: null }

    const result = await sendMessage('conversation-1', viewer, { body: 'Hello' })

    expect(result.sender).toEqual(viewer)
    expect(gatewayGraphQl.mock.calls[0][0]).not.toContain('sender {')
    expect(getProfiles).not.toHaveBeenCalled()
  })

  it('sends a real reply reference and maps reactions from the message service', async () => {
    gatewayGraphQl.mockResolvedValue({
      sendMessage: {
        id: 'message-reply', conversationId: 'conversation-1', senderUserId: '1', sequence: '6',
        text: 'Đồng ý', replyToMessageId: 'message-original', createdAt: '2026-07-18T00:00:00Z', deleted: false,
        reactions: [{ userId: '2', emoji: '😢', updatedAt: '2026-07-18T00:00:01Z' }], attachments: [],
      },
    })
    const viewer = { id: '1', username: 'me', displayName: 'Me', avatarUrl: null }

    const result = await sendMessage('conversation-1', viewer, { body: 'Đồng ý', replyToMessageId: 'message-original' })

    expect(gatewayGraphQl.mock.calls[0][1].input.replyToMessageId).toBe('message-original')
    expect(result).toMatchObject({ replyToMessageId: 'message-original', reactions: [{ userId: '2', emoji: '😢' }] })
  })

  it('uses the backend reaction and recall mutations and maps their returned message', async () => {
    gatewayGraphQl
      .mockResolvedValueOnce({
        setMessageReaction: {
          id: 'message-1', conversationId: 'conversation-1', senderUserId: '2', sequence: '7', text: 'Hi',
          replyToMessageId: null, createdAt: '2026-07-18T00:00:00Z', deleted: false,
          reactions: [{ userId: '1', emoji: '🌺', updatedAt: '2026-07-18T00:00:01Z' }], attachments: [],
          sender: { id: '2', name: 'Friend', avatar: '', isVerified: false },
        },
      })
      .mockResolvedValueOnce({
        deleteMessage: {
          id: 'message-1', conversationId: 'conversation-1', senderUserId: '1', sequence: '7', text: null,
          replyToMessageId: null, createdAt: '2026-07-18T00:00:00Z', deleted: true, reactions: [], attachments: [],
          sender: { id: '1', name: 'Me', avatar: '', isVerified: false },
        },
      })

    const reacted = await setMessageReaction('message-1', '🌺', '1')
    const recalled = await deleteMessage('message-1', '1')

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('setMessageReaction')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ input: { messageId: 'message-1', emoji: '🌺' } })
    expect(reacted.reactions).toEqual([expect.objectContaining({ userId: '1', emoji: '🌺' })])
    expect(gatewayGraphQl.mock.calls[1][0]).toContain('deleteMessage')
    expect(gatewayGraphQl.mock.calls[1][1]).toEqual({ input: { messageId: 'message-1' } })
    expect(recalled).toMatchObject({ id: 'message-1', deleted: true, body: '', attachments: [] })
  })

  it('edits a message through Gateway and preserves its id as an opaque UUID', async () => {
    gatewayGraphQl.mockResolvedValue({
      editMessage: {
        id: 'message-1', conversationId: 'conversation-1', senderUserId: '1', sequence: '7',
        kind: 'USER', systemEvent: null, systemSubjectUserId: null,
        text: 'Nội dung mới', replyToMessageId: null, createdAt: '2026-07-18T00:00:00Z',
        editedAt: '2026-07-18T00:01:00Z',
        editHistory: [
          { text: 'Nội dung cũ', versionAt: '2026-07-18T00:00:00Z' },
        ],
        deleted: false, reactions: [], attachments: [],
        sender: { id: '1', name: 'Me', avatar: '', isVerified: false }, systemSubject: null,
      },
    })

    const result = await editMessage('message-1', 'Nội dung mới', '1')

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('editMessage')
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('editHistory { text versionAt }')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ input: { messageId: 'message-1', text: 'Nội dung mới' } })
    expect(result).toMatchObject({
      id: 'message-1',
      body: 'Nội dung mới',
      editedAt: '2026-07-18T00:01:00Z',
      editHistory: [{ text: 'Nội dung cũ', versionAt: '2026-07-18T00:00:00Z' }],
    })
  })

  it('sends and restores attachment metadata instead of guessing only from the URL', async () => {
    gatewayGraphQl.mockResolvedValue({
      sendMessage: {
        id: 'message-media',
        conversationId: 'conversation-1',
        senderUserId: '1',
        sequence: '4',
        text: null,
        createdAt: '2026-07-18T00:00:00Z',
        deleted: false,
        attachments: [{
          ordinal: 0,
          url: '/media/files/stored-file.pdf',
          assetId: 'asset-1',
          mediaType: 'file',
          contentType: 'application/pdf',
          originalName: 'project-plan.pdf',
          sizeBytes: '4096',
          width: null,
          height: null,
          durationMs: null,
          thumbnailUrl: null,
        }],
      },
    })
    const viewer = { id: '1', username: 'me', displayName: 'Me', avatarUrl: null }

    const result = await sendMessage('conversation-1', viewer, {
      body: '',
      attachments: [{
        url: '/media/files/stored-file.pdf',
        type: 'file',
        contentType: 'application/pdf',
        size: 4096,
        name: 'project-plan.pdf',
        assetId: 'asset-1',
        state: 'pending',
      }],
    })

    expect(gatewayGraphQl.mock.calls[0][1].input.attachments).toEqual([expect.objectContaining({
      assetId: 'asset-1',
      mediaType: 'file',
      originalName: 'project-plan.pdf',
      sizeBytes: 4096,
    })])
    expect(result.attachments[0]).toMatchObject({
      assetId: 'asset-1',
      type: 'file',
      contentType: 'application/pdf',
      name: 'project-plan.pdf',
      size: 4096,
    })
  })

  it('fetches one realtime message by id without reloading conversation history', async () => {
    getProfiles.mockResolvedValue([{
      id: '2', username: 'friend', displayName: 'Friend', avatarUrl: null, isVerified: false,
    }])
    gatewayGraphQl.mockResolvedValue({
      message: {
        id: 'message-realtime',
        conversationId: 'conversation-1',
        senderUserId: '2',
        sequence: '5',
        text: 'New message',
        createdAt: '2026-07-18T00:00:00Z',
        deleted: false,
        attachments: [],
      },
    })

    const result = await message('message-realtime', '1')

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('query Message($id: UUID!)')
    expect(gatewayGraphQl.mock.calls[0][0]).not.toContain('sender {')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ id: 'message-realtime' })
    expect(result).toMatchObject({ id: 'message-realtime', body: 'New message', sender: { id: '2', displayName: 'Friend' } })
  })

  it('maps sent, delivered and read receipts and advances the read cursor', async () => {
    const ownMessage = (id: string, sequence: string) => ({
      id, conversationId: 'conversation-1', senderUserId: '1', sequence, text: id,
      replyToMessageId: null, createdAt: '2026-07-18T00:00:00Z', deleted: false, reactions: [], attachments: [],
      sender: { id: '1', name: 'Me', avatar: '', isVerified: false },
    })
    gatewayGraphQl
      .mockResolvedValueOnce({ conversationMessages: { items: [ownMessage('read-message', '1'), ownMessage('delivered-message', '2'), ownMessage('sent-message', '3')] } })
      .mockResolvedValueOnce({
        conversation: {
          id: 'conversation-1', type: 'DIRECT', title: null, avatarUrl: null, updatedAt: '2026-07-18T00:00:00Z', currentSequence: '3', lastMessage: null,
          participants: [
            { userId: '1', role: 'MEMBER', leftAt: null, lastDeliveredSequence: '3', lastReadSequence: '3', user: { id: '1', name: 'Me', avatar: '', isVerified: false } },
            { userId: '2', role: 'MEMBER', leftAt: null, lastDeliveredSequence: '2', lastReadSequence: '1', user: { id: '2', name: 'Friend', avatar: '', isVerified: false } },
          ],
        },
      })
      .mockResolvedValueOnce({ markConversationRead: { conversationId: 'conversation-1' } })

    const result = await messages('conversation-1', '1')
    await markRead('conversation-1', '3')

    expect(result.map((item) => ({ id: item.id, sequence: item.sequence, status: item.status }))).toEqual([
      { id: 'read-message', sequence: '1', status: 'read' },
      { id: 'delivered-message', sequence: '2', status: 'delivered' },
      { id: 'sent-message', sequence: '3', status: 'sent' },
    ])
    expect(gatewayGraphQl.mock.calls[2][0]).toContain('markConversationRead')
    expect(gatewayGraphQl.mock.calls[2][0]).toContain('sequence: 3')
  })

  it('marks an incoming sequence delivered without rounding a Long value', async () => {
    gatewayGraphQl.mockResolvedValue({ markConversationDelivered: { conversationId: 'conversation-1', lastDeliveredSequence: '9007199254740993124' } })

    await markDelivered('conversation-1', '9007199254740993124')

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('markConversationDelivered')
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('sequence: 9007199254740993124')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ conversationId: 'conversation-1' })
  })

  it('loads every conversation image and video across backward message pages in chronological and ordinal order', async () => {
    gatewayGraphQl
      .mockResolvedValueOnce({
        conversationMessages: {
          items: [
            {
              id: 'message-3', conversationId: 'conversation-1', senderUserId: '2', sequence: '3', text: null,
              createdAt: '2026-07-18T00:03:00Z', deleted: false,
              attachments: [
                { ordinal: 2, url: '/media/third-b.jpg', mediaType: 'image', contentType: 'image/jpeg' },
                { ordinal: 0, url: '/media/third-a.jpg', mediaType: 'image', contentType: 'image/jpeg' },
                { ordinal: 1, url: '/media/third-video.mp4', mediaType: 'video', contentType: 'video/mp4' },
              ],
            },
            {
              id: 'message-deleted', conversationId: 'conversation-1', senderUserId: '2', sequence: '4', text: null,
              createdAt: '2026-07-18T00:04:00Z', deleted: true,
              attachments: [{ ordinal: 0, url: '/media/deleted.jpg', mediaType: 'image', contentType: 'image/jpeg' }],
            },
          ],
          pageInfo: { startCursor: 'cursor-message-3', hasPreviousPage: true },
        },
      })
      .mockResolvedValueOnce({
        conversationMessages: {
          items: [{
            id: 'message-1', conversationId: 'conversation-1', senderUserId: '1', sequence: '1', text: null,
            createdAt: '2026-07-18T00:01:00Z', deleted: false,
            attachments: [
              { ordinal: 1, url: '/media/first-b.webp', mediaType: null, contentType: 'image/webp' },
              { ordinal: 0, url: '/media/first-a.png', mediaType: null, contentType: null },
            ],
          }],
          pageInfo: { startCursor: 'cursor-message-1', hasPreviousPage: false },
        },
      })

    const result = await conversationMedia('conversation-1')

    expect(gatewayGraphQl).toHaveBeenCalledTimes(2)
    expect(gatewayGraphQl.mock.calls[0][0]).toContain('pageInfo { startCursor hasPreviousPage }')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ id: 'conversation-1', last: 100, before: null })
    expect(gatewayGraphQl.mock.calls[1][1]).toEqual({ id: 'conversation-1', last: 100, before: 'cursor-message-3' })
    expect(result.map((image) => ({ key: image.galleryKey, url: image.url }))).toEqual([
      { key: 'message-1:0', url: '/media/first-a.png' },
      { key: 'message-1:1', url: '/media/first-b.webp' },
      { key: 'message-3:0', url: '/media/third-a.jpg' },
      { key: 'message-3:1', url: '/media/third-video.mp4' },
      { key: 'message-3:2', url: '/media/third-b.jpg' },
    ])
    expect(result[0]).toMatchObject({
      messageId: 'message-1', ordinal: 0, createdAt: '2026-07-18T00:01:00Z', type: 'image',
    })
  })

  it('stops gallery pagination safely when the server repeats a cursor', async () => {
    gatewayGraphQl
      .mockResolvedValueOnce({
        conversationMessages: {
          items: [{
            id: 'message-2', conversationId: 'conversation-1', senderUserId: '1', sequence: '2', text: null,
            createdAt: '2026-07-18T00:02:00Z', deleted: false,
            attachments: [{ ordinal: 0, url: '/media/shared.jpg', mediaType: 'image', contentType: 'image/jpeg' }],
          }],
          pageInfo: { startCursor: 'repeated-cursor', hasPreviousPage: true },
        },
      })
      .mockResolvedValueOnce({
        conversationMessages: {
          items: [{
            id: 'message-2', conversationId: 'conversation-1', senderUserId: '1', sequence: '2', text: null,
            createdAt: '2026-07-18T00:02:00Z', deleted: false,
            attachments: [{ ordinal: 0, url: '/media/shared.jpg', mediaType: 'image', contentType: 'image/jpeg' }],
          }],
          pageInfo: { startCursor: 'repeated-cursor', hasPreviousPage: true },
        },
      })

    const result = await conversationMedia('conversation-1')

    expect(gatewayGraphQl).toHaveBeenCalledTimes(2)
    expect(result.map((image) => image.galleryKey)).toEqual(['message-2:0'])
  })

  it('publishes typing state and subscribes to precise presence events', async () => {
    gatewayGraphQl.mockResolvedValue({ setTyping: { conversationId: 'conversation-1' } })

    await setTyping('conversation-1', true)
    subscribePresence(['9007199254740993124'], () => undefined)

    expect(gatewayGraphQl.mock.calls[0][0]).toContain('setTyping')
    expect(gatewayGraphQl.mock.calls[0][1]).toEqual({ conversationId: 'conversation-1', isTyping: true })
    expect(subscribeGatewayGraphQl.mock.calls[0][0].query).toContain('presenceEvents(userIds: [9007199254740993124])')
    expect(subscribeGatewayGraphQl.mock.calls[0][0].query).toContain('occurredAt expiresAt')
  })

  it('watches every open conversation over a single stream', () => {
    // One connection instead of one per chat: browsers cap concurrent connections per
    // origin, and each stream holds one open for as long as the chat is on screen.
    subscribeConversations(['conversation-1', 'conversation-2', 'conversation-1'], () => undefined)

    expect(subscribeGatewayGraphQl).toHaveBeenCalledTimes(1)
    const request = subscribeGatewayGraphQl.mock.calls[0][0]
    expect(request.query).toContain('conversationEvents(conversationIds: $ids)')
    expect(request.query).toContain('$ids: [UUID!]!')
    // Ids are deduplicated, and passed as a variable rather than inlined.
    expect(request.variables).toEqual({ ids: ['conversation-1', 'conversation-2'] })
    expect(request.query).toContain('conversationId')
  })

  it('does not open a stream when nothing is being watched', () => {
    const unsubscribe = subscribeConversations([], () => undefined)

    expect(subscribeGatewayGraphQl).not.toHaveBeenCalled()
    expect(() => unsubscribe()).not.toThrow()
  })
})
