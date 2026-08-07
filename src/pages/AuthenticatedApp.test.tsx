// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthenticatedApp } from './AuthenticatedApp'

const fastSearch = vi.hoisted(() => vi.fn())
const recordSearchResultView = vi.hoisted(() => vi.fn())
const heartbeatPresence = vi.hoisted(() => vi.fn())

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    user: { userId: '1', email: 'test@example.com', validDate: null, status: 1 },
    logout: vi.fn(),
  }),
}))

vi.mock('../api/social', () => ({ socialApi: {
  getProfile: vi.fn().mockResolvedValue(null),
  getRelationProfiles: vi.fn().mockResolvedValue([]),
} }))
vi.mock('../api/notifications', () => ({ notificationApi: {
  notifications: vi.fn().mockResolvedValue({ items: [], unreadCount: 0 }),
  subscribeNotifications: vi.fn(() => vi.fn()),
} }))
vi.mock('../api/search', () => ({ searchApi: {
  fastSearch,
  recordSearchResultView,
  search: vi.fn().mockResolvedValue({ tab: 'posts', page: 1, hasNextPage: false, users: [], groups: [], posts: [], reels: [] }),
} }))
vi.mock('../api/messenger', () => ({ messengerApi: {
  heartbeatPresence,
  conversations: vi.fn().mockResolvedValue([]),
  messages: vi.fn().mockResolvedValue([]),
  createDirectConversation: vi.fn(),
  createGroupConversation: vi.fn(),
  sendMessage: vi.fn(),
  presence: vi.fn().mockResolvedValue([]),
  setTyping: vi.fn().mockResolvedValue(undefined),
  subscribeInbox: vi.fn(() => vi.fn()),
  subscribeConversations: vi.fn(() => vi.fn()),
  subscribePresence: vi.fn(() => vi.fn()),
} }))

vi.mock('../i18n', () => ({
  languageOptions: [{ locale: 'en', label: 'English', shortLabel: 'EN' }],
  useI18n: () => ({ locale: 'en', setLocale: vi.fn(), t: (key: string) => key }),
}))

vi.mock('./GatewayHomePage', () => ({ GatewayHomePage: ({ refreshToken = 0, onOpenReel, onNavigate }: { refreshToken?: number; onOpenReel?: (reel: { __typename: 'ReelDetail'; id: string; type: number; content: string; privacy: number; create: string; author: { id: string; name: string; avatar: string; isVerified: boolean }; media: never[] }) => void; onNavigate?: (path: string) => void }) => <div data-testid="home-page" data-refresh-token={refreshToken}>home-page<button type="button" onClick={() => onOpenReel?.({ __typename: 'ReelDetail', id: 'home-reel', type: 2, content: 'Home reel', privacy: 0, create: '2026-08-02T00:00:00Z', author: { id: '1', name: 'Test', avatar: '', isVerified: false }, media: [] })}>open-home-reel</button><button type="button" onClick={() => onNavigate?.('/content/home-post')}>open-home-post</button><button type="button" onClick={() => onNavigate?.('/photo/home-post/media-1')}>open-home-photo</button></div>, GatewayPostCard: () => <div>post-card</div> }))
vi.mock('./FriendsPage', () => ({ FriendsPage: ({ onOpenReel }: { onOpenReel?: (ownerId: string, reelId: string, reel: { id: string; type: number; content: string; privacy: number; createdAt: string; authorId: string; media: never[] }) => void }) => <div>friends-page<button type="button" onClick={() => onOpenReel?.('friend-2', 'friend-reel', { id: 'friend-reel', type: 2, content: '', privacy: 0, createdAt: '', authorId: 'friend-2', media: [] })}>open-friends-profile-reel</button></div> }))
vi.mock('./ProfilePage', () => ({ ProfilePage: ({ onOpenReel }: { onOpenReel?: (ownerId: string, reelId: string, reel: { id: string; type: number; content: string; privacy: number; createdAt: string; authorId: string; media: never[] }) => void }) => <div data-testid="profile-page" data-active-tab="posts">profile-page<button type="button" onClick={() => onOpenReel?.('2', 'profile-reel', { id: 'profile-reel', type: 2, content: 'Profile reel', privacy: 0, createdAt: '2026-08-02T00:00:00Z', authorId: '2', media: [] })}>open-profile-reel</button></div> }))
vi.mock('./GroupsPage', () => ({ GroupsPage: () => <div>groups-page</div>, GroupProfilePage: () => <div>group-profile-page</div> }))
vi.mock('./ReelsPage', () => ({ ReelsPage: ({ mode, active, entryReelId, entryReel, onEntryClose, onNavigate }: { mode: string; active?: boolean; entryReelId?: string | null; entryReel?: { id: string } | null; onEntryClose?: () => void; onNavigate: (path: string) => void }) => <div data-testid={entryReelId ? 'reel-overlay' : `reels-page-${mode}`} data-active={active ? 'true' : 'false'} data-reel-id={entryReelId ?? undefined} data-has-seed={entryReel?.id === entryReelId ? 'true' : 'false'}>reels-page{!entryReelId && <><input aria-label={`reel-position-${mode}`} defaultValue="" /><button type="button" onClick={() => onNavigate('/reels/for-you')}>open-for-you</button><button type="button" onClick={() => onNavigate('/reels/following')}>open-following</button></>}{entryReelId && <button type="button" onClick={onEntryClose}>close-reel-overlay</button>}</div> }))
vi.mock('./SavedPage', () => ({ SavedPage: () => <div>saved-page</div> }))
vi.mock('./SettingsPage', () => ({ SettingsPage: ({ initialSection }: { initialSection: string }) => <div>settings-{initialSection}</div> }))
vi.mock('../components/ContentActions', () => ({
  ContentDetailOverlay: ({ contentId, onClose, onOpenImage }: { contentId: string; onClose: () => void; onOpenImage?: (post: { __typename: 'FeedPostDetail'; id: string; media: Array<{ id: string; type: number; url: string }> }, media: { id: string; type: number; url: string }, index: number) => void }) => <div data-testid="content-overlay" data-content-id={contentId}><button type="button" onClick={onClose}>close-content-overlay</button><button type="button" onClick={() => onOpenImage?.({ __typename: 'FeedPostDetail', id: contentId, media: [{ id: 'media-1', type: 0, url: '/media-1.jpg' }] }, { id: 'media-1', type: 0, url: '/media-1.jpg' }, 0)}>open-detail-photo</button></div>,
}))
vi.mock('../components/PostPhotoViewer', () => ({
  PostPhotoViewer: ({ contentId, initialMediaId, onClose }: { contentId: string; initialMediaId?: string; onClose: () => void }) => <div data-testid="photo-overlay" data-content-id={contentId} data-media-id={initialMediaId}><button type="button" onClick={onClose}>close-photo-overlay</button></div>,
}))

describe('AuthenticatedApp routing and navigation', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    fastSearch.mockReset().mockResolvedValue([])
    recordSearchResultView.mockReset().mockResolvedValue(true)
    heartbeatPresence.mockReset().mockResolvedValue({ userId: '1', isOnline: true, expiresAt: null, updatedAt: '' })
  })
  afterEach(() => {
    cleanup()
    window.history.replaceState({}, '', '/')
  })

  it('exposes every primary service destination', () => {
    render(<AuthenticatedApp />)

    expect(screen.getByRole('button', { name: 'messages' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'notifications' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'reels' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'friends' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'groups' })).toBeEnabled()
    expect(screen.getAllByRole('button', { name: 'home' }).every((button) => !button.hasAttribute('disabled'))).toBe(true)
    expect(screen.getByRole('button', { name: 'test' }).querySelector('.avatar')).toHaveStyle({ width: '36px', height: '36px' })
  })

  it('keeps the Home-style new-conversation rail visible on profile routes with no open chats', () => {
    window.history.replaceState({}, '', '/profile/2')
    const { container } = render(<AuthenticatedApp />)

    expect(container.querySelector('.mini-chat-region')).toHaveClass('has-bubble-rail', 'home-compose-rail')
    expect(container.querySelector('.mini-chat-new-button')).toBeInTheDocument()
  })

  it.each(['/friends', '/groups'])('uses the Home chat-window and bubble layout on %s', (path) => {
    window.history.replaceState({}, '', path)
    const { container } = render(<AuthenticatedApp />)

    expect(container.querySelector('.authenticated-app')).toHaveClass(path === '/friends' ? 'friends-route' : 'groups-route')
    expect(container.querySelector('.mini-chat-region')).toHaveClass('has-bubble-rail', 'home-compose-rail')
    expect(container.querySelector('.mini-chat-region')).not.toHaveClass('media-viewer-compose-rail')
    expect(container.querySelector('.mini-chat-region')).toHaveAttribute('data-layout', 'default')
    expect(screen.getByRole('button', { name: 'newMessage' })).toBeInTheDocument()
  })

  it('uses the Home chat-window and pinned compose rail on Search results', () => {
    window.history.replaceState({}, '', '/search?q=fakebook&tab=groups')
    const { container } = render(<AuthenticatedApp />)

    expect(container.querySelector('.authenticated-app')).toHaveClass('search-results-route')
    expect(container.querySelector('.mini-chat-region')).toHaveClass('has-bubble-rail', 'home-compose-rail')
    expect(container.querySelector('.mini-chat-region')).not.toHaveClass('media-viewer-compose-rail')
    expect(container.querySelector('.mini-chat-region')).toHaveAttribute('data-layout', 'default')
    expect(screen.getByRole('button', { name: 'newMessage' })).toBeInTheDocument()
  })

  it('treats a group profile as a detail page with the regular search and no active Groups tab', () => {
    window.history.replaceState({}, '', '/groups/61')
    const { container } = render(<AuthenticatedApp />)
    const navigation = screen.getByRole('navigation', { name: 'appNavigation' })

    expect(screen.getByText('group-profile-page')).toBeInTheDocument()
    expect(container.querySelector('.authenticated-app')).not.toHaveClass('groups-route')
    expect(navigation.querySelector('button[aria-label="groups"]')).not.toHaveClass('active')
    expect(container.querySelector('.shell-search')).not.toHaveStyle({ width: '36px', height: '36px' })
    expect(container.querySelector('.mini-chat-region')).toHaveClass('home-compose-rail')
  })

  it.each([
    { path: '/profile/2', page: 'profile-page' },
    { path: '/groups/61', page: 'group-profile-page' },
  ])('lands at the cover when navigating to the $path detail profile', ({ path, page }) => {
    render(<AuthenticatedApp />)
    const scrollRoot = screen.getByTestId('destination-scroll-root')
    scrollRoot.scrollTop = 840

    window.history.pushState({}, '', path)
    fireEvent.popState(window)

    expect(screen.getByText(page)).toBeInTheDocument()
    expect(scrollRoot.scrollTop).toBe(0)
  })

  it('keeps the saved Home position while entering a user profile at its cover', () => {
    render(<AuthenticatedApp />)
    const scrollRoot = screen.getByTestId('destination-scroll-root')
    const navigation = screen.getByRole('navigation', { name: 'appNavigation' })
    scrollRoot.scrollTop = 675
    fireEvent.scroll(scrollRoot)

    fireEvent.click(screen.getByRole('button', { name: 'test' }))
    fireEvent.click(screen.getByRole('button', { name: 'seeYourProfile' }))
    expect(screen.getByText('profile-page')).toBeInTheDocument()
    expect(scrollRoot.scrollTop).toBe(0)

    fireEvent.click(navigation.querySelector<HTMLButtonElement>('button[aria-label="home"]')!)
    expect(scrollRoot.scrollTop).toBe(675)
  })

  it('uses the photo-viewer chat layout on Reels without reserving an empty rail', () => {
    window.history.replaceState({}, '', '/reels')
    const { container } = render(<AuthenticatedApp />)

    expect(container.querySelector('.mini-chat-region')).not.toHaveClass('has-bubble-rail')
    expect(container.querySelector('.mini-chat-region')).toHaveClass('media-viewer-compose-rail')
    expect(container.querySelector('.mini-chat-region')).not.toHaveClass('home-compose-rail')
    expect(container.querySelector('.mini-chat-region')).toHaveAttribute('data-layout', 'media-viewer')
    expect(screen.queryByRole('button', { name: 'newMessage' })).not.toBeInTheDocument()
    expect(container.querySelector('.app-shell-nav button.active .reel-icon-divider')).toHaveAttribute('stroke', 'var(--card)')
  })

  it('uses a filled icon for the active destination and outlines for the others', () => {
    render(<AuthenticatedApp />)
    const navigation = screen.getByRole('navigation', { name: 'appNavigation' })
    const home = navigation.querySelector<HTMLButtonElement>('button[aria-label="home"]')!
    const friends = navigation.querySelector<HTMLButtonElement>('button[aria-label="friends"]')!
    const reels = navigation.querySelector<HTMLButtonElement>('button[aria-label="reels"]')!
    const groups = navigation.querySelector<HTMLButtonElement>('button[aria-label="groups"]')!

    expect(home).toHaveClass('active')
    expect(home.querySelector('svg')).toHaveAttribute('fill', 'currentColor')
    expect(friends.querySelector('svg')).toHaveAttribute('fill', 'none')
    expect(friends.querySelector('svg')).toHaveAttribute('stroke', 'currentColor')
    expect(friends.querySelector('svg')).toHaveAttribute('stroke-width', '2')
    expect(reels.querySelector('svg')).toHaveAttribute('fill', 'none')
    expect(groups.querySelector('svg')).toHaveAttribute('fill', 'none')
    const groupGlyph = groups.querySelector<SVGElement>('.shell-nav-group-glyph')!
    expect(groupGlyph).toHaveAttribute('stroke-width', '1.9')
    expect(groupGlyph.querySelector('clipPath circle')).toBeInTheDocument()
    expect(groupGlyph.querySelectorAll('g[clip-path] circle')).toHaveLength(3)
    expect(Array.from(groupGlyph.querySelectorAll('g[clip-path] circle'), (circle) => circle.getAttribute('r'))).toEqual(['2.35', '2.75', '2.75'])
    expect(groupGlyph.querySelectorAll('g[clip-path] path')).toHaveLength(1)
  })

  it('refreshes the current Home from either the active Home tab or the Fakebook logo', () => {
    const { container } = render(<AuthenticatedApp />)
    const homePage = screen.getByTestId('home-page')
    const navigation = screen.getByRole('navigation', { name: 'appNavigation' })

    expect(homePage).toHaveAttribute('data-refresh-token', '0')
    fireEvent.click(navigation.querySelector<HTMLButtonElement>('button[aria-label="home"]')!)
    expect(homePage).toHaveAttribute('data-refresh-token', '1')
    fireEvent.click(container.querySelector<HTMLButtonElement>('.app-brand')!)
    expect(homePage).toHaveAttribute('data-refresh-token', '2')
  })

  it('keeps each visited primary destination mounted and restores its own scroll position', () => {
    render(<AuthenticatedApp />)
    const navigation = screen.getByRole('navigation', { name: 'appNavigation' })
    const scrollRoot = screen.getByTestId('destination-scroll-root')
    const homePage = screen.getByTestId('home-page')

    scrollRoot.scrollTop = 640
    fireEvent.scroll(scrollRoot)
    fireEvent.click(navigation.querySelector<HTMLButtonElement>('button[aria-label="friends"]')!)
    const friendsPage = screen.getByText('friends-page')
    expect(scrollRoot.scrollTop).toBe(0)

    scrollRoot.scrollTop = 175
    fireEvent.scroll(scrollRoot)
    fireEvent.click(navigation.querySelector<HTMLButtonElement>('button[aria-label="home"]')!)
    expect(screen.getByTestId('home-page')).toBe(homePage)
    expect(scrollRoot.scrollTop).toBe(640)

    fireEvent.click(navigation.querySelector<HTMLButtonElement>('button[aria-label="friends"]')!)
    expect(screen.getByText('friends-page')).toBe(friendsPage)
    expect(scrollRoot.scrollTop).toBe(175)
  })

  it('keeps each visited Reel feed tab mounted with its own viewer position', () => {
    window.history.replaceState({}, '', '/reels/for-you')
    render(<AuthenticatedApp />)

    const forYouPosition = screen.getByRole('textbox', { name: 'reel-position-for-you' })
    fireEvent.change(forYouPosition, { target: { value: 'reel-8' } })
    fireEvent.click(screen.getByRole('button', { name: 'open-following' }))

    const followingPosition = screen.getByRole('textbox', { name: 'reel-position-following' })
    fireEvent.change(followingPosition, { target: { value: 'reel-3' } })
    fireEvent.click(screen.getByRole('button', { name: 'open-for-you' }))

    expect(screen.getByRole('textbox', { name: 'reel-position-for-you' })).toBe(forYouPosition)
    expect(forYouPosition).toHaveValue('reel-8')
    fireEvent.click(screen.getByRole('button', { name: 'open-following' }))
    expect(screen.getByRole('textbox', { name: 'reel-position-following' })).toBe(followingPosition)
    expect(followingPosition).toHaveValue('reel-3')
  })

  it('opens a Home Reel at a canonical overlay URL and closes back without losing the feed position', async () => {
    render(<AuthenticatedApp />)
    const scrollRoot = screen.getByTestId('destination-scroll-root')
    const homePage = screen.getByTestId('home-page')
    scrollRoot.scrollTop = 640
    fireEvent.scroll(scrollRoot)

    fireEvent.click(screen.getByRole('button', { name: 'open-home-reel' }))

    expect(screen.getByTestId('reel-overlay')).toHaveAttribute('data-reel-id', 'home-reel')
    expect(screen.getByTestId('reel-overlay')).toHaveAttribute('data-has-seed', 'true')
    expect(window.location.pathname).toBe('/reel/home-reel')
    expect(window.location.search).toBe('?source=for-you')
    expect(screen.getByTestId('home-page')).toBe(homePage)
    expect(scrollRoot.scrollTop).toBe(640)

    fireEvent.click(screen.getByRole('button', { name: 'close-reel-overlay' }))
    await waitFor(() => expect(screen.queryByTestId('reel-overlay')).not.toBeInTheDocument())
    expect(window.location.pathname).toBe('/')
    expect(screen.getByTestId('home-page')).toBe(homePage)
    expect(scrollRoot.scrollTop).toBe(640)
  })

  it('closes a route-owned Reel from Profile All without changing the tab or scroll position', async () => {
    window.history.replaceState({}, '', '/profile/2')
    render(<AuthenticatedApp />)
    const scrollRoot = screen.getByTestId('destination-scroll-root')
    const profilePage = screen.getByTestId('profile-page')
    scrollRoot.scrollTop = 510
    fireEvent.scroll(scrollRoot)

    fireEvent.click(screen.getByRole('button', { name: 'open-profile-reel' }))

    expect(screen.getByTestId('reel-overlay')).toHaveAttribute('data-reel-id', 'profile-reel')
    expect(screen.getByTestId('reel-overlay')).toHaveAttribute('data-has-seed', 'true')
    expect(window.location.pathname).toBe('/reel/profile-reel')
    expect(window.location.search).toBe('?source=profile&owner=2')
    expect(screen.getByTestId('profile-page')).toBe(profilePage)
    expect(profilePage).toHaveAttribute('data-active-tab', 'posts')
    expect(scrollRoot.scrollTop).toBe(510)

    fireEvent.click(screen.getByRole('button', { name: 'close-reel-overlay' }))
    await waitFor(() => expect(screen.queryByTestId('reel-overlay')).not.toBeInTheDocument())
    expect(window.location.pathname).toBe('/profile/2')
    expect(window.location.search).toBe('')
    expect(screen.getByTestId('profile-page')).toBe(profilePage)
    expect(profilePage).toHaveAttribute('data-active-tab', 'posts')
    expect(scrollRoot.scrollTop).toBe(510)
  })

  it('opens a Reel from the embedded Friends profile over the same Friends destination', async () => {
    window.history.replaceState({}, '', '/friends/suggestions')
    render(<AuthenticatedApp />)
    const friendsPage = screen.getByText('friends-page')
    const scrollRoot = screen.getByTestId('destination-scroll-root')
    scrollRoot.scrollTop = 330
    fireEvent.scroll(scrollRoot)

    fireEvent.click(screen.getByRole('button', { name: 'open-friends-profile-reel' }))
    expect(window.location.pathname).toBe('/reel/friend-reel')
    expect(window.location.search).toBe('?source=profile&owner=friend-2')
    expect(screen.getByText('friends-page')).toBe(friendsPage)
    expect(scrollRoot.scrollTop).toBe(330)

    fireEvent.click(screen.getByRole('button', { name: 'close-reel-overlay' }))
    await waitFor(() => expect(screen.queryByTestId('reel-overlay')).not.toBeInTheDocument())
    expect(window.location.pathname).toBe('/friends/suggestions')
    expect(screen.getByText('friends-page')).toBe(friendsPage)
    expect(scrollRoot.scrollTop).toBe(330)
  })

  it('keeps one background history entry while replacing post detail with its photo viewer', async () => {
    render(<AuthenticatedApp />)
    const homePage = screen.getByTestId('home-page')

    fireEvent.click(screen.getByRole('button', { name: 'open-home-post' }))
    expect(window.location.pathname).toBe('/content/home-post')
    expect(await screen.findByTestId('content-overlay')).toHaveAttribute('data-content-id', 'home-post')
    expect(screen.getByTestId('home-page')).toBe(homePage)
    expect(document.querySelector('.app-shell-topbar')).toHaveClass('is-content-detail')
    expect(document.querySelector('#content-detail-shell-close-target .content-detail-shell-close')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'open-detail-photo' }))
    expect(window.location.pathname).toBe('/photo/home-post/media-1')
    expect(screen.queryByTestId('content-overlay')).not.toBeInTheDocument()
    expect(await screen.findByTestId('photo-overlay')).toHaveAttribute('data-content-id', 'home-post')
    expect(screen.getByTestId('home-page')).toBe(homePage)
    expect(document.querySelector('.app-shell-topbar')).not.toHaveClass('is-content-detail')

    fireEvent.click(screen.getByRole('button', { name: 'close-photo-overlay' }))
    await waitFor(() => expect(screen.queryByTestId('photo-overlay')).not.toBeInTheDocument())
    expect(window.location.pathname).toBe('/')
    expect(screen.getByTestId('home-page')).toBe(homePage)
  })

  it('renders direct media and profile Reel links without loading a competing destination behind them', async () => {
    window.history.replaceState({}, '', '/content/direct-post')
    const first = render(<AuthenticatedApp />)

    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
    expect(await screen.findByTestId('content-overlay')).toHaveAttribute('data-content-id', 'direct-post')
    fireEvent.click(screen.getByRole('button', { name: 'close-content-overlay' }))
    expect(window.location.pathname).toBe('/home')
    first.unmount()

    window.history.replaceState({}, '', '/photo/direct-post/direct-media')
    const second = render(<AuthenticatedApp />)
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
    expect(await screen.findByTestId('photo-overlay')).toHaveAttribute('data-content-id', 'direct-post')
    fireEvent.click(screen.getByRole('button', { name: 'close-photo-overlay' }))
    await waitFor(() => expect(window.location.pathname).toBe('/home'))
    second.unmount()

    window.history.replaceState({}, '', '/reel/direct-reel?source=profile&owner=2')
    render(<AuthenticatedApp />)
    expect(screen.queryByTestId('profile-page')).not.toBeInTheDocument()
    expect(await screen.findByTestId('reel-overlay')).toHaveAttribute('data-reel-id', 'direct-reel')
    fireEvent.click(screen.getByRole('button', { name: 'close-reel-overlay' }))
    expect(window.location.pathname).toBe('/profile/2')
    expect(window.location.search).toBe('?tab=reels')
  })

  it.each([
    { path: '/reels', label: 'reels', pageText: 'reels-page' },
    { path: '/groups', label: 'groups', pageText: 'groups-page' },
  ])('refreshes and returns to the top when clicking the active $label destination', ({ path, label, pageText }) => {
    window.history.replaceState({}, '', path)
    render(<AuthenticatedApp />)
    const navigation = screen.getByRole('navigation', { name: 'appNavigation' })
    const scrollRoot = screen.getByTestId('destination-scroll-root')
    const originalPage = screen.getByText(pageText)
    scrollRoot.scrollTop = 480
    fireEvent.scroll(scrollRoot)

    fireEvent.click(navigation.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!)

    expect(screen.getByText(pageText)).not.toBe(originalPage)
    expect(scrollRoot.scrollTop).toBe(0)
  })

  it('opens account destinations from the avatar menu', () => {
    render(<AuthenticatedApp />)
    fireEvent.click(screen.getByRole('button', { name: 'test' }))
    fireEvent.click(screen.getByRole('button', { name: /premium/i }))
    expect(screen.getByText('settings-premium')).toBeInTheDocument()
  })

  it('opens the application menu and navigates to saved content', () => {
    render(<AuthenticatedApp />)
    fireEvent.click(screen.getByRole('button', { name: 'menu' }))
    expect(screen.getByRole('dialog', { name: 'menu' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'saved' }))
    expect(screen.getByText('saved-page')).toBeInTheDocument()
  })

  it('opens notifications as a topbar overlay without replacing the current page', () => {
    render(<AuthenticatedApp />)

    fireEvent.click(screen.getByRole('button', { name: 'notifications' }))

    expect(screen.getByRole('dialog', { name: 'notifications' })).toBeInTheDocument()
    expect(screen.getByText('home-page')).toBeInTheDocument()
  })

  it('closes the Messenger and notification menus when clicking outside', () => {
    render(<AuthenticatedApp />)

    fireEvent.click(screen.getByRole('button', { name: 'messages' }))
    expect(screen.getByRole('dialog', { name: 'messages' })).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('dialog', { name: 'messages' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'notifications' }))
    expect(screen.getByRole('dialog', { name: 'notifications' })).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('dialog', { name: 'notifications' })).not.toBeInTheDocument()
  })

  it('opens the settings and privacy submenu before navigating to settings', () => {
    render(<AuthenticatedApp />)
    fireEvent.click(screen.getByRole('button', { name: 'test' }))
    fireEvent.click(screen.getByRole('button', { name: /settingsPrivacy/i }))
    expect(screen.getByRole('heading', { name: 'settingsPrivacy' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /settingsGeneral/i }))
    expect(screen.getByText('settings-overview')).toBeInTheDocument()
  })

  it('uses Escape to go back from the submenu, then closes and restores avatar focus', async () => {
    render(<AuthenticatedApp />)
    const avatarButton = screen.getByRole('button', { name: 'test' })
    fireEvent.click(avatarButton)
    fireEvent.click(screen.getByRole('button', { name: /settingsPrivacy/i }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'seeYourProfile' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'accountMenu' })).not.toBeInTheDocument()
    await waitFor(() => expect(avatarButton).toHaveFocus())
  })

  it('opens Premium directly for the PayOS return route', () => {
    window.history.replaceState({}, '', '/premium/payment?status=PAID&orderCode=123')
    render(<AuthenticatedApp />)
    expect(screen.getByText('settings-premium')).toBeInTheDocument()
  })

  it('records a quick-search result view without blocking profile navigation', async () => {
    fastSearch.mockResolvedValue([{ kind: 'user', id: '10', referenceId: '10', profile: {
      id: '10', displayName: 'Lan Nguyen', username: 'lan', avatarUrl: null, isVerified: false, followerCount: 2,
    }, viewerIsSelf: false, viewerIsFriend: true, viewerIsFollowing: false }])
    render(<AuthenticatedApp />)

    const input = screen.getByRole('textbox', { name: 'searchPlaceholder' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Lan' } })
    const result = await screen.findByRole('button', { name: /Lan Nguyen/ })
    expect(result).toHaveTextContent('friends')
    expect(screen.queryByText('seeAllResults')).not.toBeInTheDocument()
    fireEvent.mouseDown(result)
    fireEvent.click(result)

    expect(recordSearchResultView).toHaveBeenCalledWith('10')
    expect(window.location.pathname).toBe('/profile/10')
  })

  it('starts quick search from the first character', async () => {
    render(<AuthenticatedApp />)

    const input = screen.getByRole('textbox', { name: 'searchPlaceholder' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'L' } })

    await waitFor(() => expect(fastSearch).toHaveBeenCalledWith('L'))
    expect(await screen.findByRole('button', { name: 'L' })).toBeInTheDocument()
  })

  it('shows the recent-search empty state before a keyword is entered', () => {
    const { container } = render(<AuthenticatedApp />)

    fireEvent.focus(screen.getByRole('textbox', { name: 'searchPlaceholder' }))

    expect(screen.getByText('noRecentSearches')).toBeInTheDocument()
    expect(container.querySelector('.shell-brand-search')).toHaveClass('has-recent-empty')
    expect(container.querySelector('.quick-search-results')).toHaveClass('is-recent-empty')
  })

  it('labels viewer relationships and renders group search avatars as rounded squares', async () => {
    fastSearch.mockResolvedValue([
      { kind: 'user', id: '1', referenceId: '1', viewerIsSelf: true, viewerIsFriend: false, viewerIsFollowing: false, profile: { id: '1', displayName: 'Test User', avatarUrl: null, isVerified: false } },
      { kind: 'group', id: '20', referenceId: '20', viewerIsMember: true, group: { id: '20', name: 'Fakebook Group', avatarUrl: null, memberCount: 12 } },
    ])
    render(<AuthenticatedApp />)

    const input = screen.getByRole('textbox', { name: 'searchPlaceholder' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'F' } })

    expect(await screen.findByRole('button', { name: /Test User/ })).toHaveTextContent('searchSelf')
    const group = screen.getByRole('button', { name: /Fakebook Group/ })
    expect(group).toHaveTextContent('searchYourGroup · membersCount')
    expect(group.querySelector('.quick-search-group-avatar')).toBeInTheDocument()
  })

  it('adds the entered keyword as a slow-search result when fast search is not full', async () => {
    fastSearch.mockResolvedValue([{ kind: 'user', id: '10', referenceId: '10', viewerIsSelf: false, viewerIsFriend: false, viewerIsFollowing: true, profile: {
      id: '10', displayName: 'Lan Nguyen', avatarUrl: null, isVerified: false, followerCount: 2,
    } }])
    render(<AuthenticatedApp />)

    const input = screen.getByRole('textbox', { name: 'searchPlaceholder' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Lan' } })

    expect(await screen.findByRole('button', { name: /Lan Nguyen/ })).toHaveTextContent('following')
    expect(document.querySelector('.shell-brand-search')).not.toHaveClass('has-recent-empty')
    expect(document.querySelector('.quick-search-results')).not.toHaveClass('is-recent-empty')
    fireEvent.click(screen.getByRole('button', { name: 'Lan' }))

    expect(window.location.pathname).toBe('/search')
    expect(new URLSearchParams(window.location.search).get('q')).toBe('Lan')
  })

  it('swaps the Fakebook logo for a back button while search is focused', () => {
    const { container } = render(<AuthenticatedApp />)
    const input = screen.getByRole('textbox', { name: 'searchPlaceholder' })

    expect(container.querySelector('.shell-search-glyph')).toBeInTheDocument()
    fireEvent.focus(input)

    expect(container.querySelector('.shell-search-wrap')).toHaveClass('is-active')
    expect(container.querySelector('.shell-search-glyph')).toHaveClass('is-hidden')
    expect(container.querySelector('.app-brand')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('button', { name: 'back' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'back' }))

    expect(container.querySelector('.shell-search-wrap')).not.toHaveClass('is-active')
    expect(container.querySelector('.shell-search-wrap')).toHaveClass('is-closing')
    expect(container.querySelector('.shell-brand-search')).toHaveClass('is-closing')
    expect(container.querySelector('.shell-search-glyph')).not.toHaveClass('is-hidden')
    expect(container.querySelector('.app-brand')).toHaveAttribute('aria-hidden', 'false')
    expect(input).not.toHaveFocus()
  })
})
