// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MessengerPage } from './MessengerPage'

vi.mock('../../api/client', () => ({
  legacyApi: {
    messengerConversations: vi.fn().mockRejectedValue(new Error('offline')),
    messengerMessages: vi.fn().mockResolvedValue([]),
    sendMessengerMessage: vi.fn(),
    startConversation: vi.fn(),
    uploadMedia: vi.fn(),
  },
}))

vi.mock('../../api/realtime', () => ({
  createGatewaySocket: () => ({ on: vi.fn(), disconnect: vi.fn() }),
}))

vi.mock('../../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('Messenger unavailable state', () => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  afterEach(cleanup)

  it('shows an honest unavailable state instead of generated conversations', async () => {
    render(<MessengerPage me={{ id: 'me', username: 'me', displayName: 'Me', avatarUrl: null }} friends={[]} onOpenProfile={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('messengerUnavailable')).toBeInTheDocument())
    expect(screen.queryByText('Linh Tran')).not.toBeInTheDocument()
    expect(screen.queryByText('messengerPreviewMessage')).not.toBeInTheDocument()
  })
})
