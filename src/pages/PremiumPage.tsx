import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, isTerminalPaymentStatus } from '../api/client'
import type { PremiumOrder, PremiumPlan, PremiumPlanOffer } from '../api/gatewayTypes'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { parsePayOSReturn } from './payosReturn'

const POLL_INTERVAL_MS = 5_000
const MAX_POLL_ATTEMPTS = 24

function storageKey(userId: string) {
  return `fb.pendingPremiumOrder:${userId}`
}

function readPendingOrder(userId: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(userId))
  } catch {
    return null
  }
}

function savePendingOrder(userId: string, orderCode: string) {
  try {
    window.localStorage.setItem(storageKey(userId), orderCode)
  } catch {
    /* The in-memory state still supports this visit. */
  }
}

export function PremiumPage() {
  const { user, refreshUser } = useAuth()
  const { t, locale } = useI18n()
  const [plans, setPlans] = useState<PremiumPlanOffer[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [plansError, setPlansError] = useState<string | null>(null)
  const [checkoutBusy, setCheckoutBusy] = useState<PremiumPlan | null>(null)
  const [payOSReturn] = useState(() => parsePayOSReturn(window.location.search))
  const [orderCode, setOrderCode] = useState<string | null>(() => payOSReturn?.orderCode ?? (user ? readPendingOrder(user.userId) : null))
  const [order, setOrder] = useState<PremiumOrder | null>(null)
  const [reconcilingReturn, setReconcilingReturn] = useState(payOSReturn !== null)
  const [orderBusy, setOrderBusy] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)

  const loadPlans = useCallback(async () => {
    setPlansLoading(true)
    setPlansError(null)
    try {
      setPlans(await api.premiumPlans())
    } catch {
      setPlansError(t('premiumPlansLoadError'))
    } finally {
      setPlansLoading(false)
    }
  }, [t])

  const loadOrder = useCallback(async (code: string, foreground = true) => {
    if (foreground) setOrderBusy(true)
    setOrderError(null)
    try {
      const current = await api.premiumOrder(code)
      setOrder(current)
      if (current.status === 'ACTIVATED') await refreshUser()
      return current
    } catch {
      setOrderError(t('premiumOrderLoadError'))
      return null
    } finally {
      if (foreground) setOrderBusy(false)
    }
  }, [refreshUser, t])

  useEffect(() => {
    void loadPlans()
  }, [loadPlans])

  useEffect(() => {
    if (!user || !payOSReturn) return
    let active = true
    savePendingOrder(user.userId, payOSReturn.orderCode)
    window.history.replaceState({}, '', '/premium/payment')
    api.reconcilePremiumCheckout(payOSReturn.orderCode)
      .then(async (current) => {
        if (!active) return
        setOrder(current)
        if (current.status === 'ACTIVATED') await refreshUser()
      })
      .catch(() => active && setOrderError(t('premiumOrderLoadError')))
      .finally(() => active && setReconcilingReturn(false))
    return () => { active = false }
  }, [payOSReturn, refreshUser, t, user])

  useEffect(() => {
    if (!orderCode || reconcilingReturn) return
    let cancelled = false
    let attempts = 0
    let timer: number | null = null

    const check = async () => {
      if (cancelled) return
      attempts += 1
      const current = await loadOrder(orderCode, attempts === 1)
      if (cancelled || (current && isTerminalPaymentStatus(current.status)) || attempts >= MAX_POLL_ATTEMPTS) return
      timer = window.setTimeout(() => void check(), POLL_INTERVAL_MS)
    }

    void check()
    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [loadOrder, orderCode, reconcilingReturn])

  const premiumActive = useMemo(() => {
    if (!user?.validDate) return false
    const expiry = new Date(user.validDate)
    return !Number.isNaN(expiry.getTime()) && expiry.getTime() > Date.now()
  }, [user?.validDate])

  if (!user) return null

  const currency = new Intl.NumberFormat(locale, { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
  const date = user.validDate ? new Date(user.validDate) : null
  const premiumDate = date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(date)
    : null

  async function checkout(plan: PremiumPlan) {
    if (!user) return
    setCheckoutBusy(plan)
    setOrderError(null)
    try {
      const created = await api.createPremiumCheckout(plan)
      savePendingOrder(user.userId, created.orderCode)
      setOrderCode(created.orderCode)
      window.location.assign(created.checkoutUrl)
    } catch {
      setOrderError(t('genericError'))
      setCheckoutBusy(null)
    }
  }

  return (
    <main className="premium-page">
      <section className="premium-hero">
        <div>
          <h1>{t('premiumTitle')}</h1>
          <p>{t('premiumSubtitle')}</p>
        </div>
        <div className={premiumActive ? 'premium-status active' : 'premium-status'}>
          <span>{t('premiumCurrentStatus')}</span>
          <strong>{premiumActive && premiumDate ? t('premiumActiveUntil', { date: premiumDate }) : t('premiumInactive')}</strong>
        </div>
      </section>

      {orderCode && (
        <section className="card pending-order">
          <div className="service-heading">
            <div><h2>{t('pendingOrder')}</h2></div>
            <button type="button" className="btn-soft sm" disabled={orderBusy} onClick={() => void loadOrder(orderCode)}>{orderBusy ? t('checkingPayment') : t('refreshPaymentStatus')}</button>
          </div>
          <dl>
            <div><dt>{t('orderCode')}</dt><dd>{orderCode}</dd></div>
            <div><dt>{t('paymentStatus')}</dt><dd className={order ? `payment-state state-${order.status.toLowerCase()}` : 'payment-state'}>{order ? t(`paymentStatus${order.status}`) : t('checkingPayment')}</dd></div>
            {order && <div><dt>{t('premium')}</dt><dd>{order.plan === 'MONTHLY' ? t('monthlyPlan') : t('yearlyPlan')} · {currency.format(order.amount)}</dd></div>}
          </dl>
          {order?.status === 'ACTIVATED' && <p className="form-success">{t('paymentActivated')}</p>}
          {orderError && <p className="form-error">{orderError}</p>}
        </section>
      )}

      <section className="premium-plans" aria-labelledby="premium-plans-title">
        <div className="premium-section-heading"><h2 id="premium-plans-title">{t('choosePremiumPlan')}</h2></div>
        {plansLoading ? <div className="card state-card"><span className="spinner" /><p>{t('loadingMore')}</p></div> : plansError ? (
          <div className="card state-card"><p className="form-error">{plansError}</p><button type="button" className="btn-primary" onClick={() => void loadPlans()}>{t('tryAgain')}</button></div>
        ) : (
          <div className="plan-grid">
            {plans.map((plan) => (
              <article className={plan.code === 'YEARLY' ? 'card plan-card featured' : 'card plan-card'} key={plan.code}>
                <span className="plan-code">{plan.code === 'MONTHLY' ? t('monthlyPlan') : t('yearlyPlan')}</span>
                <strong>{currency.format(plan.amount)}</strong>
                <p>{t('planDuration', { count: plan.durationMonths })}</p>
                <ul className="plan-benefits"><li>{t('premiumVerifiedBenefit')}</li><li>{t('premiumSupportBenefit')}</li></ul>
                <button type="button" className={plan.code === 'YEARLY' ? 'btn-primary block' : 'btn-soft block'} disabled={checkoutBusy !== null} onClick={() => void checkout(plan.code)}>
                  {checkoutBusy === plan.code ? t('creatingCheckout') : t('startCheckout')}
                </button>
                <small>{t('checkoutRedirectNote')}</small>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
