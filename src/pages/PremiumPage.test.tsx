// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PremiumPage } from './PremiumPage'

const apiMocks = vi.hoisted(() => ({
  premiumPlans: vi.fn(),
  premiumOrder: vi.fn(),
  createPremiumCheckout: vi.fn(),
}))
const refreshUser = vi.hoisted(() => vi.fn())
const translate = vi.hoisted(() => (key: string) => key)

vi.mock('../api/client', () => ({
  api: apiMocks,
  isTerminalPaymentStatus: (status: string) => ['ACTIVATED', 'CANCELLED', 'EXPIRED', 'FAILED'].includes(status),
}))

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    user: { userId: '9007199254740993123', email: 'owner@example.com', validDate: null, status: 1 },
    refreshUser,
  }),
}))

vi.mock('../i18n', () => ({
  useI18n: () => ({
    locale: 'vi',
    t: translate,
  }),
}))

describe('PremiumPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    apiMocks.premiumPlans.mockResolvedValue([
      { code: 'MONTHLY', amount: 52000, durationMonths: 1 },
      { code: 'YEARLY', amount: 500000, durationMonths: 12 },
    ])
    apiMocks.premiumOrder.mockReset()
    apiMocks.createPremiumCheckout.mockReset()
    refreshUser.mockResolvedValue(null)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders plans returned by Payment instead of hard-coded offers', async () => {
    render(<PremiumPage />)

    expect(await screen.findByText('monthlyPlan')).toBeInTheDocument()
    expect(screen.getByText('yearlyPlan')).toBeInTheDocument()
    expect(screen.getAllByText('startCheckout')).toHaveLength(2)
    expect(apiMocks.premiumPlans).toHaveBeenCalledTimes(1)
  })

  it('restores a pending order and refreshes Authentication after activation', async () => {
    window.localStorage.setItem('fb.pendingPremiumOrder:9007199254740993123', 'order-7')
    apiMocks.premiumOrder.mockResolvedValue({
      orderCode: 'order-7',
      plan: 'MONTHLY',
      amount: 52000,
      status: 'ACTIVATED',
      createdAt: '2026-07-15T12:00:00Z',
      expiresAt: '2026-07-15T12:15:00Z',
      paidAt: '2026-07-15T12:02:00Z',
      targetValidDate: '2026-08-15T12:02:00Z',
    })

    render(<PremiumPage />)

    expect(await screen.findByText('paymentStatusACTIVATED')).toBeInTheDocument()
    expect(screen.getByText('paymentActivated')).toBeInTheDocument()
    await waitFor(() => expect(refreshUser).toHaveBeenCalledTimes(1))
  })

  it('shows a retry state when Payment plans are unavailable', async () => {
    apiMocks.premiumPlans.mockRejectedValue(new Error('offline'))
    render(<PremiumPage />)

    expect(await screen.findByText('premiumPlansLoadError')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'tryAgain' })).toBeInTheDocument()
  })
})
