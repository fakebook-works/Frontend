const MAX_PAYOS_ORDER_CODE = 9_007_199_254_740_991n
const PAYOS_RETURN_STATUSES = new Set(['PAID', 'PENDING', 'PROCESSING', 'CANCELLED'])

export interface PayOSReturn {
  code: string
  paymentLinkId: string
  cancelled: boolean
  status: 'PAID' | 'PENDING' | 'PROCESSING' | 'CANCELLED'
  orderCode: string
}

export function parsePayOSReturn(search: string): PayOSReturn | null {
  const params = new URLSearchParams(search)
  const code = params.get('code')
  const paymentLinkId = params.get('id')
  const cancel = params.get('cancel')
  const status = params.get('status')
  const orderCode = params.get('orderCode')
  if (!code || !paymentLinkId || (cancel !== 'true' && cancel !== 'false') ||
      !status || !PAYOS_RETURN_STATUSES.has(status) || !orderCode || !/^[1-9]\d*$/.test(orderCode)) return null
  try {
    if (BigInt(orderCode) > MAX_PAYOS_ORDER_CODE) return null
  } catch {
    return null
  }
  return {
    code,
    paymentLinkId,
    cancelled: cancel === 'true',
    status: status as PayOSReturn['status'],
    orderCode,
  }
}
