// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const socialMocks = vi.hoisted(() => ({
  getGroup: vi.fn(),
  getGroupMembershipState: vi.fn(),
  getProfile: vi.fn(),
  recordGroupVisit: vi.fn(),
  getGroupPosts: vi.fn(),
  getGroupMembers: vi.fn(),
  getGroupAdmins: vi.fn(),
  getRelationProfiles: vi.fn(),
  getProfileRelationshipStates: vi.fn(),
  getGroupJoinRequests: vi.fn(),
  getGroupMedia: vi.fn(),
  getGroupPhotos: vi.fn(),
  getGroupPhotoCandidates: vi.fn(),
  getGroupSuggestions: vi.fn(),
  getGroupFriendMembers: vi.fn(),
  updateGroup: vi.fn(),
  inviteGroupUser: vi.fn(),
  requestJoinGroup: vi.fn(),
  cancelJoinGroupRequest: vi.fn(),
  leaveGroup: vi.fn(),
  deleteGroup: vi.fn(),
  removeGroupAdmin: vi.fn(),
  approveGroupJoinRequest: vi.fn(),
  rejectGroupJoinRequest: vi.fn(),
}))
const translate = vi.hoisted(() => (key: string) => key)

vi.mock('../api/client', () => ({ api: { uploadMediaFiles: vi.fn(), cancelPendingMedia: vi.fn() } }))
vi.mock('../api/social', () => ({ socialApi: socialMocks }))
vi.mock('../i18n', () => ({ useI18n: () => ({ locale: 'vi-VN', t: translate }) }))
vi.mock('./GatewayHomePage', () => ({
  PostComposer: ({ friends, triggerOnly, externalOpenRequest, variant, groupId }: { friends: Array<{ id: string }>; triggerOnly?: boolean; externalOpenRequest?: number; variant?: string; groupId?: string }) => <div data-testid="group-composer" data-friend-ids={friends.map((friend) => friend.id).join(',')} data-trigger-only={String(Boolean(triggerOnly))} data-open-request={externalOpenRequest ?? 0} data-variant={variant} data-group-id={groupId} />,
  GatewayPostCard: ({ post, groupContextId, viewerCanModerateGroupPosts }: { post: { id: string }; groupContextId?: string; viewerCanModerateGroupPosts?: boolean }) => <article data-testid={`group-profile-post-${post.id}`} data-group-context={groupContextId} data-can-moderate={String(viewerCanModerateGroupPosts)} />,
}))

import { GroupProfilePage } from './GroupProfilePage'

const group = {
  id: '61', avatarUrl: '/group.jpg', backgroundUrl: '/cover.jpg', name: 'Nhóm thiết kế', bio: 'Nơi chia sẻ thiết kế', privacy: 1,
  createdAt: '2026-07-01T00:00:00Z', memberCount: 3, adminCount: 1,
}
const viewer = { id: '71', username: 'viewer', email: 'viewer@example.com', displayName: 'Viewer', avatarUrl: '/viewer.jpg', isVerified: false, backgroundUrl: null, bio: '', gender: 1, birthDate: '2000-01-01', location: '', createdAt: '', friendCount: 2, privacy: 1, followerCount: 0, followingCount: 0 }
const admin = { id: '71', username: 'viewer', displayName: 'Viewer', avatarUrl: '/viewer.jpg' }
const friendMember = { id: '72', username: 'friend', displayName: 'Friend member', avatarUrl: '/friend.jpg' }
const otherMember = { id: '73', username: 'member', displayName: 'Other member', avatarUrl: '/member.jpg' }
const requester = { ...viewer, id: '75', username: 'requester', displayName: 'Pending member', avatarUrl: '/pending.jpg' }
const outsiderFriend = { ...viewer, id: '74', displayName: 'Outsider friend' }
const post = { __typename: 'GroupPostDetail', id: '81', type: 3, content: 'post', privacy: 1, create: 'now', author: { id: '72', name: 'Friend member', avatar: '/friend.jpg', isVerified: false }, group: { id: '61', name: group.name, avatar: group.avatarUrl, canJoin: false }, media: [] }
const photo = { media: { id: '91', type: 0, url: '/group-photo.jpg' }, contentId: '81', contentType: 3, createdAt: '2026-07-20T00:00:00Z', authorId: '72', groupId: '61' }

describe('GroupProfilePage', () => {
  beforeEach(() => {
    socialMocks.getGroup.mockReset().mockResolvedValue(group)
    socialMocks.getGroupMembershipState.mockReset().mockResolvedValue({ isMember: false, isAdmin: true, joinRequestPending: false, canViewPosts: true })
    socialMocks.getProfile.mockReset().mockResolvedValue(viewer)
    socialMocks.recordGroupVisit.mockReset().mockResolvedValue(true)
    socialMocks.getGroupPosts.mockReset().mockResolvedValue({ items: [post], endCursor: null, hasNextPage: false })
    socialMocks.getGroupMembers.mockReset().mockResolvedValue({ items: [friendMember, otherMember], endCursor: null, hasNextPage: false })
    socialMocks.getGroupAdmins.mockReset().mockResolvedValue({ items: [admin], endCursor: null, hasNextPage: false })
    socialMocks.getRelationProfiles.mockReset().mockResolvedValue([friendMember, outsiderFriend])
    socialMocks.getProfileRelationshipStates.mockReset().mockResolvedValue({ '72': { friendship: 'friend', isFollowing: false, followsViewer: false, isBlocked: false, isBlockedBy: false } })
    socialMocks.getGroupJoinRequests.mockReset().mockResolvedValue([])
    socialMocks.getGroupMedia.mockReset().mockResolvedValue({ items: [photo], endCursor: null, hasNextPage: false })
    socialMocks.getGroupPhotos.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getGroupPhotoCandidates.mockReset().mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getGroupSuggestions.mockReset().mockResolvedValue([])
    socialMocks.getGroupFriendMembers.mockReset().mockResolvedValue([])
    socialMocks.updateGroup.mockReset().mockImplementation(async (_groupId: string, input: { name: string; bio: string; privacy: number }) => ({ ...group, name: input.name, bio: input.bio, privacy: input.privacy }))
    socialMocks.inviteGroupUser.mockReset().mockResolvedValue(true)
    socialMocks.requestJoinGroup.mockReset().mockResolvedValue(true)
    socialMocks.cancelJoinGroupRequest.mockReset().mockResolvedValue(true)
    socialMocks.leaveGroup.mockReset().mockResolvedValue(true)
    socialMocks.deleteGroup.mockReset().mockResolvedValue(true)
    socialMocks.removeGroupAdmin.mockReset().mockResolvedValue(true)
    socialMocks.approveGroupJoinRequest.mockReset().mockResolvedValue(true)
    socialMocks.rejectGroupJoinRequest.mockReset().mockResolvedValue(true)
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:group-image-preview') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('renders the redesigned group identity and scopes group posts to the owning group', async () => {
    const { container } = render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={vi.fn()} />)

    expect(await screen.findByRole('heading', { name: group.name })).toBeInTheDocument()
    expect(container.querySelector('.group-profile-page')).toHaveClass('profile-destination', 'self-profile-page')
    expect(container.querySelector('.group-profile-hero')).toHaveClass('profile-cover-card', 'self-profile-cover-card')
    expect(container.querySelector('.group-profile-cover')).toHaveClass('profile-cover')
    expect(container.querySelector('.group-profile-identity-row')).toHaveClass('profile-destination-header')
    expect(container.querySelector('.group-profile-avatar-shell')).toHaveClass('self-profile-avatar-wrap', 'no-story')
    expect(container.querySelector('.group-profile-avatar-shell')).not.toHaveClass('has-unseen-story', 'has-seen-story')
    expect(container.querySelector('.group-profile-avatar-shell > .avatar img')).toHaveAttribute('src', '/group.jpg')
    expect(container.querySelector('.group-profile-square-avatar')).not.toBeInTheDocument()
    expect(container.querySelector<HTMLElement>('.self-profile-cover-ambient')?.style.getPropertyValue('--profile-cover-ambient-color')).toBeTruthy()
    expect(container.querySelector('.group-profile-header-actions .self-profile-header-chevron')).toBeInTheDocument()
    expect(container.querySelector('.group-profile-tabs')).toHaveClass('profile-tabs', 'self-profile-tabs')
    expect(container.querySelectorAll('.group-profile-tabs > .self-profile-tab-option')).toHaveLength(4)
    expect(within(container.querySelector('.group-profile-tabs') as HTMLElement).getByRole('button', { name: 'mediaFiles' })).toBeInTheDocument()
    expect(container.querySelector('.group-profile-tabs > .self-profile-tab-more')).toBeInTheDocument()
    const stackedAvatars = Array.from(container.querySelectorAll<HTMLElement>('.group-profile-member-stack > .group-profile-member-avatar'))
    expect(stackedAvatars.map((item) => item.style.zIndex)).toEqual(['3', '2', '1'])
    const contentGrid = container.querySelector('.group-profile-content-grid')!
    expect(contentGrid).toHaveClass('profile-destination-grid', 'self-profile-destination-grid', 'tab-posts')
    expect(contentGrid.firstElementChild).toHaveClass('profile-post-list', 'group-profile-post-column')
    expect(contentGrid.lastElementChild).toHaveClass('self-profile-left-column', 'group-profile-info-column')
    const renderedPost = await screen.findByTestId('group-profile-post-81')
    expect(renderedPost).toHaveAttribute('data-group-context', '61')
    expect(renderedPost).toHaveAttribute('data-can-moderate', 'true')
    expect(screen.getByTestId('group-composer')).toHaveAttribute('data-friend-ids', '72')

    expect(container.querySelector('.group-profile-info-column .group-profile-about-card > header > button')).not.toBeInTheDocument()
    expect(container.querySelector('.group-profile-info-column .group-profile-about-row .group-private-privacy-icon')).toBeInTheDocument()
    await waitFor(() => expect(container.querySelector('.group-profile-info-column .self-profile-friends-card .self-profile-friend-preview')).toBeInTheDocument())
    const membersCard = container.querySelector('.group-profile-info-column .self-profile-friends-card')!
    expect(membersCard.querySelector('header > div > h2')).toHaveTextContent('people')
    expect(membersCard.querySelector('header > div > small')).toHaveTextContent('membersCount')
    expect(membersCard.querySelector('header > button')).toHaveTextContent('viewAllGroupMembers')
    expect(membersCard.querySelector('.self-profile-friend-preview .avatar img')).toHaveAttribute('src', '/viewer.jpg')

    await waitFor(() => expect(container.querySelector('.group-profile-info-column .self-profile-photo-preview img')).toHaveAttribute('src', '/group-photo.jpg'))
    const photosCard = container.querySelector('.group-profile-info-column .self-profile-photos-card')!
    expect(photosCard.querySelector('header > div > h2')).toHaveTextContent('mediaFiles')
    expect(photosCard.querySelector('header > div > small')).toHaveTextContent('profilePhotoStat')
    expect(photosCard.querySelector('header > button')).toHaveTextContent('profileSeeAllPhotos')
    expect(photosCard.querySelector('.self-profile-photo-preview button')).toHaveClass('round-top-left', 'round-top-right', 'round-bottom-left', 'round-bottom-right')
  })

  it('loads the next group-post page automatically when the feed sentinel approaches', async () => {
    let intersect: (() => void) | null = null
    class IntersectionObserverMock {
      constructor(callback: IntersectionObserverCallback) {
        intersect = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords(): IntersectionObserverEntry[] { return [] }
      root = null
      rootMargin = '0px'
      thresholds = [0]
    }
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
    socialMocks.getGroupPosts
      .mockResolvedValueOnce({ items: [post], endCursor: 'next-page', hasNextPage: true })
      .mockResolvedValueOnce({ items: [{ ...post, id: '82', content: 'second group page' }], endCursor: null, hasNextPage: false })

    render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={vi.fn()} />)
    await screen.findByTestId(`group-profile-post-${post.id}`)
    await waitFor(() => expect(intersect).not.toBeNull())

    act(() => intersect?.())

    await screen.findByTestId('group-profile-post-82')
    expect(socialMocks.getGroupPosts).toHaveBeenNthCalledWith(2, '61', 20, 'next-page')
    expect(screen.queryByRole('button', { name: 'seeMore' })).not.toBeInTheDocument()
  })

  it('uses the same month-grouped browse cards as the user profile', async () => {
    const { container } = render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={vi.fn()} />)
    await screen.findByRole('heading', { name: group.name })

    fireEvent.click(screen.getByRole('button', { name: 'profileGridView' }))

    await waitFor(() => expect(container.querySelector('.self-profile-post-months .self-profile-post-month')).toBeInTheDocument())
    expect(container.querySelector('.self-profile-post-grid .profile-post-grid-card')).toHaveAttribute('data-post-id', '81')
    expect(container.querySelector('.profile-post-grid-footer .profile-post-grid-meta .group-private-privacy-icon')).toBeInTheDocument()
    expect(container.querySelector('.group-profile-post-grid')).not.toBeInTheDocument()
  })

  it('shows filtering and post management to a regular member without granting moderation rights', async () => {
    socialMocks.getGroupMembershipState.mockResolvedValue({ isMember: true, isAdmin: false, joinRequestPending: false, canViewPosts: true })
    const mediaPost = { ...post, id: '82', content: 'media post', media: [{ id: '92', type: 0, url: '/media-post.jpg' }] }
    socialMocks.getGroupPosts.mockResolvedValue({ items: [post, mediaPost], endCursor: null, hasNextPage: false })
    const { container } = render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={vi.fn()} />)

    await screen.findByRole('heading', { name: group.name })
    const tools = container.querySelector('.group-profile-post-tools') as HTMLElement
    expect(within(tools).getByText('profilePostFilters')).toBeInTheDocument()
    const manageButton = within(tools).getByRole('button', { name: 'profileManagePosts' })
    expect(manageButton).toBeInTheDocument()
    expect(await screen.findByTestId('group-profile-post-81')).toHaveAttribute('data-can-moderate', 'false')

    fireEvent.click(manageButton)
    expect(within(tools).getByRole('button', { name: 'done' })).toHaveClass('active')
    expect(tools).toHaveTextContent('profileManagePostsHint')
    expect(screen.getByTestId('group-profile-post-81')).toHaveAttribute('data-can-moderate', 'false')

    fireEvent.click(within(tools).getByText('profilePostFilters').closest('summary')!)
    fireEvent.click(within(tools).getByRole('button', { name: 'profileMediaPosts' }))
    expect(screen.queryByTestId('group-profile-post-81')).not.toBeInTheDocument()
    expect(screen.getByTestId('group-profile-post-82')).toBeInTheDocument()
  })

  it('uses the same full-width About layout as the user profile', async () => {
    const { container } = render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={vi.fn()} />)
    await screen.findByRole('heading', { name: group.name })

    fireEvent.click(screen.getByRole('button', { name: 'profileTabAbout' }))

    const aboutGrid = container.querySelector('.self-profile-destination-grid.tab-about')
    expect(aboutGrid).toHaveClass('profile-destination-grid', 'self-profile-destination-grid', 'tab-about')
    expect(aboutGrid).not.toHaveClass('group-profile-feed-width-tab')
    expect(aboutGrid?.firstElementChild).toHaveClass('profile-post-list')
    expect(aboutGrid?.querySelector('.group-profile-about-card')).toHaveClass('profile-about-panel')
    expect(aboutGrid?.querySelector('.profile-about-details')).toBeInTheDocument()
    expect(within(aboutGrid as HTMLElement).getByText('profileJoinDate')).toBeInTheDocument()
    expect(within(aboutGrid as HTMLElement).queryByText('groupHistory')).not.toBeInTheDocument()
    expect(within(aboutGrid as HTMLElement).getByRole('button', { name: 'edit' })).toHaveClass('self-profile-section-action')
  })

  it('edits group description and privacy with the same inline controls as the user profile', async () => {
    const { container } = render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={vi.fn()} />)
    await screen.findByRole('heading', { name: group.name })
    fireEvent.click(screen.getByRole('button', { name: 'profileTabAbout' }))
    const about = container.querySelector('.group-profile-about-tab') as HTMLElement

    expect(about.querySelector('.profile-preserve-newlines')).toHaveTextContent(group.bio)
    expect(within(about).getByRole('button', { name: 'edit groupDescription' })).toBeInTheDocument()
    expect(within(about).getByRole('button', { name: 'edit privacy' })).toBeInTheDocument()
    fireEvent.click(within(about).getByRole('button', { name: 'edit groupDescription' }))
    fireEvent.change(within(about).getByRole('textbox', { name: 'groupDescription' }), { target: { value: 'Updated group\ndescription' } })
    fireEvent.click(within(about).getByRole('button', { name: 'save' }))
    await waitFor(() => expect(socialMocks.updateGroup).toHaveBeenCalledWith('61', expect.objectContaining({ bio: 'Updated group\ndescription', privacy: 1 })))
    await waitFor(() => expect(about.querySelector('.profile-preserve-newlines')?.textContent).toBe('Updated group\ndescription'))

    fireEvent.click(within(about).getByRole('button', { name: 'edit' }))
    expect(within(about).getByRole('button', { name: 'cancel' })).toBeInTheDocument()
    expect(within(about).getByRole('button', { name: 'save' })).toBeDisabled()
    fireEvent.click(within(about).getByRole('button', { name: 'privacy' }))
    fireEvent.click(within(about).getByRole('option', { name: 'publicGroup' }))
    fireEvent.click(within(about).getByRole('button', { name: 'save' }))
    await waitFor(() => expect(socialMocks.updateGroup).toHaveBeenLastCalledWith('61', expect.objectContaining({ privacy: 0 })))
  })

  it('opens the People tab with separate administrators, members and join requests', async () => {
    socialMocks.getGroupJoinRequests.mockResolvedValue([requester])
    const { container } = render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={vi.fn()} />)
    await screen.findByRole('heading', { name: group.name })

    fireEvent.click(screen.getByRole('button', { name: 'people' }))

    const directory = container.querySelector('.group-profile-people-directory') as HTMLElement
    expect(directory).toHaveClass('self-profile-collection-card', 'self-profile-connections-tab')
    expect(directory.querySelector('.self-profile-collection-tabs')).toBeInTheDocument()
    expect(await within(directory).findByText('Viewer')).toBeInTheDocument()
    expect(directory.querySelector('.self-profile-connections-grid .self-profile-connection-person')).toBeInTheDocument()
    expect(directory.querySelector('.group-profile-person-avatar .group-profile-admin-crown')).not.toBeInTheDocument()
    expect(directory.querySelector('.group-profile-person-role .group-profile-admin-crown')).toBeInTheDocument()
    expect(directory.querySelector('summary[aria-label="more"]')).toBeInTheDocument()
    expect(socialMocks.getGroupJoinRequests).not.toHaveBeenCalled()

    fireEvent.click(within(directory).getByRole('button', { name: 'groupMembers' }))
    expect(await within(directory).findByText('Friend member')).toBeInTheDocument()
    expect(within(directory).getByText('Other member')).toBeInTheDocument()
    expect(within(directory).queryByText('Viewer')).not.toBeInTheDocument()

    fireEvent.click(within(directory).getByRole('button', { name: 'joinRequests' }))
    const requesterName = await within(directory).findByText('Pending member')
    const requestCard = requesterName.closest('.group-profile-request-card') as HTMLElement
    const requestBody = requestCard.querySelector('.group-profile-request-body') as HTMLElement
    const approveButton = within(requestCard).getByRole('button', { name: 'approve' })
    expect(requestCard.querySelector('.group-profile-request-avatar')).toBeInTheDocument()
    expect(requestCard.querySelector('small')).not.toBeInTheDocument()
    expect(requestBody).toContainElement(approveButton)
    expect(requestBody).toContainElement(within(requestCard).getByRole('button', { name: 'decline' }))
    expect(socialMocks.getGroupJoinRequests).toHaveBeenCalledWith('61')
    fireEvent.click(approveButton)
    await waitFor(() => expect(socialMocks.approveGroupJoinRequest).toHaveBeenCalledWith('61', '75'))
    expect(within(directory).queryByText('Pending member')).not.toBeInTheDocument()
  })

  it('keeps join requests hidden from regular members', async () => {
    socialMocks.getGroupMembershipState.mockResolvedValue({ isMember: true, isAdmin: false, joinRequestPending: false, canViewPosts: true })
    const { container } = render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={vi.fn()} />)
    await screen.findByRole('heading', { name: group.name })

    fireEvent.click(screen.getByRole('button', { name: 'people' }))
    const directory = container.querySelector('.group-profile-people-directory') as HTMLElement
    expect(within(directory).getByRole('button', { name: 'groupAdmins' })).toBeInTheDocument()
    expect(within(directory).getByRole('button', { name: 'groupMembers' })).toBeInTheDocument()
    expect(within(directory).queryByRole('button', { name: 'joinRequests' })).not.toBeInTheDocument()
    fireEvent.click(within(directory).getByRole('button', { name: 'invite' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'invitePeople' })).toBeInTheDocument()
    await waitFor(() => expect(socialMocks.getGroupJoinRequests).not.toHaveBeenCalled())
  })

  it('shows only safe membership actions in the current administrator menu', async () => {
    const { container } = render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={vi.fn()} />)
    await screen.findByRole('heading', { name: group.name })
    fireEvent.click(screen.getByRole('button', { name: 'people' }))

    const selfCard = within(container.querySelector('.group-profile-people-directory') as HTMLElement).getByText('Viewer').closest('.group-profile-person-card') as HTMLElement
    fireEvent.click(selfCard.querySelector('summary[aria-label="more"]')!)

    expect(within(selfCard).queryByRole('menuitem', { name: 'viewProfile' })).not.toBeInTheDocument()
    expect(within(selfCard).queryByRole('menuitem', { name: 'removeAdmin' })).not.toBeInTheDocument()
    expect(within(selfCard).getByRole('menuitem', { name: 'leaveGroup' })).toBeInTheDocument()
    expect(within(selfCard).queryByRole('menuitem', { name: 'deleteGroup' })).not.toBeInTheDocument()
  })

  it('allows the current administrator to demote themselves only while another administrator exists', async () => {
    const secondAdmin = { ...otherMember, id: '76', username: 'second-admin', displayName: 'Second admin' }
    socialMocks.getGroup.mockResolvedValue({ ...group, adminCount: 2 })
    socialMocks.getGroupAdmins.mockResolvedValue({ items: [admin, secondAdmin], endCursor: null, hasNextPage: false })
    const { container } = render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={vi.fn()} />)
    await screen.findByRole('heading', { name: group.name })
    fireEvent.click(screen.getByRole('button', { name: 'people' }))

    const selfCard = within(container.querySelector('.group-profile-people-directory') as HTMLElement).getByText('Viewer').closest('.group-profile-person-card') as HTMLElement
    fireEvent.click(selfCard.querySelector('summary[aria-label="more"]')!)
    fireEvent.click(within(selfCard).getByRole('menuitem', { name: 'removeAdmin' }))

    await waitFor(() => expect(socialMocks.removeGroupAdmin).toHaveBeenCalledWith('61', '71'))
  })

  it('offers group deletion instead of leaving when the current administrator is the final participant', async () => {
    socialMocks.getGroup.mockResolvedValue({ ...group, memberCount: 0, adminCount: 1 })
    socialMocks.getGroupMembers.mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onNavigate = vi.fn()
    const { container } = render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={onNavigate} />)
    await screen.findByRole('heading', { name: group.name })
    fireEvent.click(screen.getByRole('button', { name: 'people' }))

    const selfCard = within(container.querySelector('.group-profile-people-directory') as HTMLElement).getByText('Viewer').closest('.group-profile-person-card') as HTMLElement
    fireEvent.click(selfCard.querySelector('summary[aria-label="more"]')!)
    expect(within(selfCard).queryByRole('menuitem', { name: 'leaveGroup' })).not.toBeInTheDocument()
    fireEvent.click(within(selfCard).getByRole('menuitem', { name: 'deleteGroup' }))

    await waitFor(() => expect(socialMocks.deleteGroup).toHaveBeenCalledWith('61'))
    expect(onNavigate).toHaveBeenCalledWith('/groups')
  })

  it('uses the same filters and media grid as the profile photo tab', async () => {
    const { container } = render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={vi.fn()} />)
    await screen.findByRole('heading', { name: group.name })

    fireEvent.click(screen.getByRole('button', { name: 'mediaFiles' }))
    const mediaTab = container.querySelector('.group-profile-media-tab') as HTMLElement
    expect(mediaTab).toHaveClass('self-profile-collection-card', 'self-profile-media-tab')
    expect(mediaTab.querySelector('.self-profile-collection-tabs')).toBeInTheDocument()
    await waitFor(() => expect(mediaTab.querySelector('.self-profile-media-grid .self-profile-media-open')).toBeInTheDocument())
    fireEvent.click(within(mediaTab).getByRole('button', { name: 'profileAddPhotoVideo' }))
    expect(within(mediaTab).getByTestId('group-composer')).toHaveAttribute('data-trigger-only', 'true')
    expect(within(mediaTab).getByTestId('group-composer')).toHaveAttribute('data-open-request', '1')
    expect(within(mediaTab).getByTestId('group-composer')).toHaveAttribute('data-group-id', '61')
    fireEvent.click(within(mediaTab).getByRole('button', { name: 'videos' }))
    expect(within(mediaTab).getByText('photosEmpty')).toBeInTheDocument()
  })

  it('does not recreate a shortcut visit for someone who is outside the group', async () => {
    socialMocks.getGroupMembershipState.mockResolvedValue({ isMember: false, isAdmin: false, joinRequestPending: false, canViewPosts: true })

    render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={vi.fn()} />)

    await screen.findByRole('heading', { name: group.name })
    await waitFor(() => expect(socialMocks.getGroupMembershipState).toHaveBeenCalled())
    expect(socialMocks.recordGroupVisit).not.toHaveBeenCalled()
  })

  it('shows only safe friend-member previews to a private-group outsider and keeps join state optimistic', async () => {
    socialMocks.getGroupMembershipState.mockResolvedValue({ isMember: false, isAdmin: false, joinRequestPending: false, canViewPosts: false })
    socialMocks.getGroupMembers.mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getGroupAdmins.mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getGroupFriendMembers.mockResolvedValue([friendMember])
    const { container } = render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={vi.fn()} />)

    await screen.findByRole('heading', { name: group.name })
    await waitFor(() => expect(socialMocks.getGroupFriendMembers).toHaveBeenCalledWith('61', 12))
    await waitFor(() => expect(container.querySelector('.group-profile-member-stack .avatar img')).toHaveAttribute('src', '/friend.jpg'))
    expect(container.querySelectorAll('.group-profile-member-stack > .group-profile-member-avatar')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'joinGroupLong' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'shareGroupAction' })).toBeInTheDocument()
    const outsiderTools = container.querySelector('.group-profile-post-tools') as HTMLElement
    expect(within(outsiderTools).getByText('profilePostFilters')).toBeInTheDocument()
    expect(within(outsiderTools).getByRole('button', { name: 'profileManagePosts' })).toBeInTheDocument()
    expect(screen.getByText('joinToSeePosts')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'joinGroupLong' }))
    await waitFor(() => expect(socialMocks.requestJoinGroup).toHaveBeenCalledWith('71', '61'))
    expect(await screen.findByRole('button', { name: 'joinRequested' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'joinRequested' }))
    await waitFor(() => expect(socialMocks.cancelJoinGroupRequest).toHaveBeenCalledWith('71', '61'))
  })

  it('keeps the safe friend-member preview after refreshing a pending private-group request', async () => {
    socialMocks.getGroupMembershipState.mockResolvedValue({ isMember: false, isAdmin: false, joinRequestPending: true, canViewPosts: false })
    socialMocks.getGroupMembers.mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getGroupAdmins.mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    socialMocks.getGroupFriendMembers.mockResolvedValue([friendMember])
    const { container } = render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={vi.fn()} />)

    await screen.findByRole('heading', { name: group.name })
    await waitFor(() => expect(container.querySelector('.group-profile-member-stack .avatar img')).toHaveAttribute('src', '/friend.jpg'))
    expect(screen.getByRole('button', { name: 'joinRequested' })).toBeInTheDocument()
    expect(socialMocks.getGroupFriendMembers).toHaveBeenCalledWith('61', 12)
  })

  it('scrolls both discussion columns and clamps the shorter group column', async () => {
    const { container } = render(<div className="authenticated-destination-scroll"><GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={vi.fn()} /></div>)
    await screen.findByTestId('group-composer')

    const destinationViewport = container.querySelector<HTMLElement>('.authenticated-destination-scroll')!
    const grid = container.querySelector<HTMLElement>('.group-profile-content-grid')!
    const postColumn = container.querySelector<HTMLElement>('.group-profile-post-column')!
    const infoColumn = container.querySelector<HTMLElement>('.group-profile-info-column')!
    Object.defineProperties(destinationViewport, {
      clientHeight: { configurable: true, value: 800 },
      scrollHeight: { configurable: true, value: 1600 },
    })
    Object.defineProperties(postColumn, {
      clientHeight: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, value: 2000 },
    })
    Object.defineProperties(infoColumn, {
      clientHeight: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, value: 1000 },
    })
    destinationViewport.scrollTop = 800
    postColumn.scrollTop = 300
    infoColumn.scrollTop = 400

    fireEvent.wheel(grid, { deltaY: 250 })
    await waitFor(() => {
      expect(postColumn.scrollTop).toBeCloseTo(550, 1)
      expect(infoColumn.scrollTop).toBe(500)
    })

    fireEvent.wheel(grid, { deltaY: 250 })
    await waitFor(() => {
      expect(postColumn.scrollTop).toBeCloseTo(800, 1)
      expect(infoColumn.scrollTop).toBe(500)
    })
  })

  it('keeps a public-group join pending until an administrator approves it', async () => {
    socialMocks.getGroup.mockResolvedValue({ ...group, privacy: 0 })
    socialMocks.getGroupMembershipState.mockResolvedValue({ isMember: false, isAdmin: false, joinRequestPending: false, canViewPosts: true })
    render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={vi.fn()} />)
    await screen.findByRole('heading', { name: group.name })

    fireEvent.click(screen.getByRole('button', { name: 'joinGroupLong' }))

    await waitFor(() => expect(socialMocks.requestJoinGroup).toHaveBeenCalledWith('71', '61'))
    expect(await screen.findByRole('button', { name: 'joinRequested' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'joined' })).not.toBeInTheDocument()
    expect(socialMocks.recordGroupVisit).not.toHaveBeenCalled()
  })

  it('orders member actions as invite, share, joined and the membership menu', async () => {
    socialMocks.getGroupMembershipState.mockResolvedValue({ isMember: true, isAdmin: false, joinRequestPending: false, canViewPosts: true })
    const { container } = render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={vi.fn()} />)
    await screen.findByRole('heading', { name: group.name })
    await screen.findByTestId('group-composer')

    const actions = container.querySelector('.group-profile-header-actions') as HTMLElement
    expect(Array.from(actions.querySelectorAll(':scope > button')).map((button) => button.textContent)).toEqual(['invite', 'shareGroupAction', 'joined'])
    const joinedButton = within(actions).getByRole('button', { name: 'joined' })
    fireEvent.click(joinedButton)
    expect(await screen.findByRole('menuitem', { name: 'leaveGroup' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'editGroup' })).not.toBeInTheDocument()
    fireEvent.click(joinedButton)
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'leaveGroup' })).not.toBeInTheDocument())
    fireEvent.click(within(actions).getByRole('button', { name: 'more' }))
    expect(screen.queryByRole('menuitem', { name: 'leaveGroup' })).not.toBeInTheDocument()
  })

  it('opens administrator controls from Manage Group and leaves the chevron neutral', async () => {
    socialMocks.getGroup.mockResolvedValue({ ...group, memberCount: 1 })
    socialMocks.getGroupMembers.mockResolvedValue({ items: [], endCursor: null, hasNextPage: false })
    const onNavigate = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { container } = render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={onNavigate} />)
    await screen.findByRole('heading', { name: group.name })

    const manageButton = screen.getByRole('button', { name: 'manageGroup' })
    expect(manageButton.querySelector('.group-profile-admin-crown')).toHaveAttribute('fill', 'currentColor')
    expect(screen.getByRole('button', { name: 'shareGroupAction' }).querySelector('svg')).toHaveAttribute('fill', 'currentColor')
    expect(container.querySelector('.group-profile-admin-edit')).not.toBeInTheDocument()
    const moreButton = within(container.querySelector('.group-profile-header-actions') as HTMLElement).getByRole('button', { name: 'more' })
    expect(moreButton).not.toHaveAttribute('aria-haspopup')
    fireEvent.click(moreButton)
    expect(screen.queryByRole('menuitem', { name: 'editGroup' })).not.toBeInTheDocument()
    fireEvent.click(manageButton)
    expect(await screen.findByRole('menuitem', { name: 'editGroup' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'manageGroupMembers' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'leaveGroup' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'deleteGroup' }))
    await waitFor(() => expect(socialMocks.deleteGroup).toHaveBeenCalledWith('61'))
    expect(onNavigate).toHaveBeenCalledWith('/groups')
  })

  it('edits a group cover inline with drag viewport and matching zoom controls', async () => {
    const { container } = render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={vi.fn()} />)
    await screen.findByRole('heading', { name: group.name })

    fireEvent.click(screen.getByRole('button', { name: /editCoverPhoto/ }))
    expect(screen.getByRole('menuitem', { name: 'chooseGroupCover' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'uploadPhoto' }))
    const uploadInput = container.querySelector('.group-profile-cover-file-input')
    expect(uploadInput).toBeInstanceOf(HTMLInputElement)
    fireEvent.change(uploadInput!, { target: { files: [new File(['cover'], 'cover.jpg', { type: 'image/jpeg' })] } })

    expect(container.querySelector('.self-profile-cover-preview')).toBeInTheDocument()
    expect(container.querySelector('.group-profile-inline-image-preview')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'storyZoomIn' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'storyZoomOut' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(container.querySelector('.self-profile-cover-preview')).not.toBeInTheDocument()
  })

  it('uses the same menu and circular inline editor as the user profile for the group avatar', async () => {
    const { container } = render(<GroupProfilePage groupId="61" userId="71" onBack={vi.fn()} onNavigate={vi.fn()} />)
    await screen.findByRole('heading', { name: group.name })

    fireEvent.click(screen.getByRole('button', { name: 'changeGroupAvatar' }))
    expect(screen.getByRole('menuitem', { name: 'chooseGroupAvatar' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'uploadPhoto' }))
    const uploadInput = container.querySelector('.group-profile-avatar-file-input')
    expect(uploadInput).toBeInstanceOf(HTMLInputElement)
    fireEvent.change(uploadInput!, { target: { files: [new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' })] } })

    expect(container.querySelector('.group-profile-avatar-shell')).toHaveClass('editing-avatar', 'no-story')
    expect(container.querySelector('.group-profile-avatar-shell .self-profile-avatar-preview')).toBeInTheDocument()
    expect(container.querySelector('.group-profile-avatar-shell .group-profile-inline-image-preview')).not.toBeInTheDocument()
    expect(container.querySelector('.self-profile-avatar-edit-controls')).toBeInTheDocument()
  })
})
