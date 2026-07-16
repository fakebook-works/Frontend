// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthenticatedApp } from './AuthenticatedApp'

const fastSearch = vi.hoisted(() => vi.fn())
const recordSearchResultView = vi.hoisted(() => vi.fn())

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
vi.mock('../api/search', () => ({ searchApi: { fastSearch, recordSearchResultView } }))

vi.mock('../i18n', () => ({
  languageOptions: [{ locale: 'en', label: 'English', shortLabel: 'EN' }],
  useI18n: () => ({ locale: 'en', setLocale: vi.fn(), t: (key: string) => key }),
}))

vi.mock('./GatewayHomePage', () => ({ GatewayHomePage: () => <div>home-page</div>, GatewayPostCard: () => <div>post-card</div> }))
vi.mock('./SavedPage', () => ({ SavedPage: () => <div>saved-page</div> }))
vi.mock('./SettingsPage', () => ({ SettingsPage: ({ initialSection }: { initialSection: string }) => <div>settings-{initialSection}</div> }))

describe('AuthenticatedApp routing and navigation', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    fastSearch.mockReset().mockResolvedValue([])
    recordSearchResultView.mockReset().mockResolvedValue(true)
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
    } }])
    render(<AuthenticatedApp />)

    const input = screen.getByRole('textbox', { name: 'searchPlaceholder' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Lan' } })
    const result = await screen.findByRole('button', { name: /Lan Nguyen/ })
    fireEvent.mouseDown(result)
    fireEvent.click(result)

    expect(recordSearchResultView).toHaveBeenCalledWith('10')
    expect(window.location.pathname).toBe('/profile/10')
  })
})
