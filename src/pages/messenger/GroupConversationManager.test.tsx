// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MessengerConversationDto, UserSummary } from '../../api/types'
import { PROFILE_IMAGE_ACCEPT } from '../../lib/mediaValidation'

const updateGroupConversation = vi.hoisted(() => vi.fn())
const addConversationMembers = vi.hoisted(() => vi.fn())
const removeConversationMember = vi.hoisted(() => vi.fn())
const setConversationMemberRole = vi.hoisted(() => vi.fn())
const leaveConversation = vi.hoisted(() => vi.fn())
const deleteGroupConversation = vi.hoisted(() => vi.fn())
const uploadMediaFiles = vi.hoisted(() => vi.fn())

vi.mock('../../api/messenger', () => ({
  messengerApi: {
    updateGroupConversation,
    addConversationMembers,
    removeConversationMember,
    setConversationMemberRole,
    leaveConversation,
    deleteGroupConversation,
  },
}))
vi.mock('../../api/client', () => ({
  api: {
    uploadMediaFiles,
    cancelPendingMedia: vi.fn(),
    finalizePendingMedia: vi.fn(),
  },
}))
vi.mock('../../lib/useFriendSearch', () => ({
  useFriendSearch: (people: UserSummary[]) => ({ people, loading: false, failed: false }),
}))
vi.mock('../../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

import { GroupConversationManager } from './GroupConversationManager'

const me: UserSummary = { id: '1', username: 'me', displayName: 'Tôi', avatarUrl: null }
const member: UserSummary = { id: '2', username: 'friend', displayName: 'Bạn A', avatarUrl: null }
const addable: UserSummary = { id: '3', username: 'new-friend', displayName: 'Bạn B', avatarUrl: null }

function group(myRole: 'ADMIN' | 'MEMBER' = 'ADMIN'): MessengerConversationDto {
  return {
    id: 'group-1',
    type: 'GROUP',
    title: 'Nhóm thử nghiệm',
    avatarUrl: null,
    updatedAt: '2026-07-28T00:00:00Z',
    unreadCount: 0,
    lastMessage: null,
    participants: [
      { ...me, role: myRole, leftAt: null },
      { ...member, role: 'MEMBER', leftAt: null },
    ],
  }
}

function renderManager(conversation = group()) {
  return render(<GroupConversationManager
    me={me}
    friends={[member, addable]}
    conversation={conversation}
    onClose={vi.fn()}
    onUpdated={vi.fn()}
    onRemoved={vi.fn()}
    onOpenProfile={vi.fn()}
  />)
}

describe('GroupConversationManager', () => {
  afterEach(() => cleanup())
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects a non-image group avatar before opening the cropper or uploading', async () => {
    const { container } = renderManager()
    fireEvent.click(container.querySelector<HTMLButtonElement>('.group-manager-menu button')!)
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!

    expect(input.accept).toBe(PROFILE_IMAGE_ACCEPT)
    fireEvent.change(input, {
      target: { files: [new File(['%PDF-'], 'avatar.pdf', { type: 'application/pdf' })] },
    })

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(container.querySelector('.group-manager-crop')).toBeNull()
    expect(uploadMediaFiles).not.toHaveBeenCalled()
  })

  it('shows administrator actions and marks administrators with a crown', () => {
    renderManager()

    expect(screen.getByText('Chỉnh sửa nhóm')).toBeTruthy()
    expect(screen.getByText('Thêm thành viên')).toBeTruthy()
    expect(screen.getByText('Xoá nhóm')).toBeTruthy()
    fireEvent.click(screen.getByText('Quản lý thành viên'))

    expect(screen.getByRole('img', { name: 'Quản trị viên' })).toBeTruthy()
    expect(screen.getByText('Bạn A')).toBeTruthy()
  })

  it('promotes a member through the server role mutation', async () => {
    setConversationMemberRole.mockResolvedValue({
      ...group(),
      participants: [
        { ...me, role: 'ADMIN', leftAt: null },
        { ...member, role: 'ADMIN', leftAt: null },
      ],
    })
    renderManager()
    fireEvent.click(screen.getByText('Quản lý thành viên'))
    fireEvent.click(screen.getByRole('button', { name: 'Tuỳ chọn của Bạn A' }))
    expect(screen.getByRole('menu').parentElement).toBe(document.body)
    fireEvent.click(screen.getByText('Đặt làm quản trị viên'))

    await waitFor(() => expect(setConversationMemberRole).toHaveBeenCalledWith('group-1', '2', 'ADMIN', '1'))
  })

  it('searches/selects friends and adds only selected IDs', async () => {
    addConversationMembers.mockResolvedValue({
      ...group(),
      participants: [...group().participants, { ...addable, role: 'MEMBER', leftAt: null }],
    })
    renderManager()
    fireEvent.click(screen.getByText('Thêm thành viên'))
    fireEvent.click(screen.getByText('Bạn B'))
    fireEvent.click(screen.getByRole('button', { name: 'Thêm (1)' }))

    await waitFor(() => expect(addConversationMembers).toHaveBeenCalledWith('group-1', ['3'], '1'))
  })

  it('does not expose administration or deletion to a regular member', () => {
    renderManager(group('MEMBER'))

    expect(screen.queryByText('Chỉnh sửa nhóm')).toBeNull()
    expect(screen.queryByText('Thêm thành viên')).toBeNull()
    expect(screen.queryByText('Xoá nhóm')).toBeNull()
    expect(screen.getByText('Xem thành viên')).toBeTruthy()
    expect(screen.getByText('Rời nhóm')).toBeTruthy()
  })
})
