// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GatewayPost } from '../api/gatewayTypes'
import { PostOptionsMenu } from './PostOptionsMenu'

const socialMocks = vi.hoisted(() => ({
  getContentEngagement: vi.fn(),
  getProfileRelationshipState: vi.fn(),
  getGroupMembershipState: vi.fn(),
  saveContent: vi.fn(),
  unsaveContent: vi.fn(),
  unfollowUser: vi.fn(),
  unfriend: vi.fn(),
  blockUser: vi.fn(),
  leaveGroup: vi.fn(),
  deleteContent: vi.fn(),
}))
const translate = vi.hoisted(() => (key: string) => key)

vi.mock('../api/social', () => ({ socialApi: socialMocks }))
vi.mock('../i18n', () => ({ useI18n: () => ({ t: translate }) }))

const feedPost: GatewayPost = {
  __typename: 'FeedPostDetail', id: '10', type: 1, content: 'post', privacy: 0, create: '', media: [],
  author: { id: '2', name: 'Author', avatar: '', isVerified: false, canFollow: false }, sharedSource: null,
}

const groupPost: GatewayPost = {
  __typename: 'GroupPostDetail', id: '11', type: 2, content: 'group post', privacy: 0, create: '', media: [],
  author: { id: '3', name: 'Member', avatar: '', isVerified: false, canFollow: false },
  group: { id: '8', name: 'Group', avatar: '', canJoin: false },
}

describe('PostOptionsMenu', () => {
  beforeEach(() => {
    socialMocks.getContentEngagement.mockReset().mockResolvedValue({ viewerHasSaved: false })
    socialMocks.getProfileRelationshipState.mockReset().mockResolvedValue({ friendship: 'friend', isFollowing: true, followsViewer: false, isBlocked: false, isBlockedBy: false })
    socialMocks.getGroupMembershipState.mockReset().mockResolvedValue({ isMember: true, isAdmin: false, joinRequestPending: false, canViewPosts: true })
    socialMocks.saveContent.mockReset().mockResolvedValue(true)
    socialMocks.unsaveContent.mockReset().mockResolvedValue(true)
    socialMocks.unfollowUser.mockReset().mockResolvedValue(true)
    socialMocks.unfriend.mockReset().mockResolvedValue(true)
    socialMocks.blockUser.mockReset().mockResolvedValue(true)
    socialMocks.leaveGroup.mockReset().mockResolvedValue(true)
    socialMocks.deleteContent.mockReset().mockResolvedValue(true)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows save, unfollow, unfriend and block for a related feed author', async () => {
    render(<PostOptionsMenu post={feedPost} viewerId="1" owned={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'postOptions' }))

    expect(await screen.findByRole('menuitem', { name: 'savePost' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'unfollow' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'removeFriend' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'block' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('menuitem', { name: 'savePost' }))
    await waitFor(() => expect(socialMocks.saveContent).toHaveBeenCalledWith('1', '10'))
    expect(await screen.findByRole('menuitem', { name: 'unsavePost' })).toBeInTheDocument()
  })

  it('offers leave-group only to a regular group member', async () => {
    render(<PostOptionsMenu post={groupPost} viewerId="1" owned={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'postOptions' }))

    expect(await screen.findByRole('menuitem', { name: 'savePost' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'leaveGroup' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'block' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('menuitem', { name: 'leaveGroup' }))
    await waitFor(() => expect(socialMocks.leaveGroup).toHaveBeenCalledWith('1', '8'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('limits an owned post menu to save and delete', async () => {
    const onDelete = vi.fn()
    render(<PostOptionsMenu post={feedPost} viewerId="2" owned onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: 'postOptions' }))

    expect(await screen.findByRole('menuitem', { name: 'savePost' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'deletePost' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'editPost' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('menuitem', { name: 'deletePost' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('can delete an owned post directly from the post-detail menu', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onPostHidden = vi.fn()
    render(<PostOptionsMenu post={feedPost} viewerId="2" owned onPostHidden={onPostHidden} />)
    fireEvent.click(screen.getByRole('button', { name: 'postOptions' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'deletePost' }))

    await waitFor(() => expect(socialMocks.deleteContent).toHaveBeenCalledWith('10'))
    expect(onPostHidden).toHaveBeenCalledTimes(1)
  })
})
