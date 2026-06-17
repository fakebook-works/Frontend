import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { subscribeApiEvents } from '../api/client'
import { useI18n } from '../i18n'

interface Toast {
  id: number
  message: string
}

const TOAST_TIMEOUT_MS = 5000

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  useEffect(
    () =>
      subscribeApiEvents((event) => {
        if (event.type !== 'gateway-error') return

        const id = nextId.current++
        setToasts((current) => [...current, { id, message: t('gatewayError') }])
        window.setTimeout(() => {
          setToasts((current) => current.filter((toast) => toast.id !== id))
        }, TOAST_TIMEOUT_MS)
      }),
    [t],
  )

  function dismiss(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  return (
    <>
      {children}
      <div className="toast-region" role="status" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div className="toast toast-warning" key={toast.id}>
            <span className="toast-mark" aria-hidden="true">!</span>
            <span className="toast-message">{toast.message}</span>
            <button type="button" className="toast-close" onClick={() => dismiss(toast.id)} aria-label={t('dismissToast')}>
              x
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
