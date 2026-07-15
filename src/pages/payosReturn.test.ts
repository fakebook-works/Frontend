import { describe, expect, it } from 'vitest'
import { parsePayOSReturn } from './payosReturn'

describe('parsePayOSReturn', () => {
  it('accepts the documented successful return parameters without converting orderCode to a JavaScript number', () => {
    expect(parsePayOSReturn('?code=00&id=link-1&cancel=false&status=PAID&orderCode=9007199254740991')).toEqual({
      code: '00',
      paymentLinkId: 'link-1',
      cancelled: false,
      status: 'PAID',
      orderCode: '9007199254740991',
    })
  })

  it('accepts the documented cancelled return parameters', () => {
    expect(parsePayOSReturn('?code=00&id=link-2&cancel=true&status=CANCELLED&orderCode=803347')).toMatchObject({
      cancelled: true,
      status: 'CANCELLED',
      orderCode: '803347',
    })
  })

  it('rejects forged or out-of-range order codes', () => {
    expect(parsePayOSReturn('?code=00&id=x&cancel=false&status=PAID&orderCode=9007199254740992')).toBeNull()
    expect(parsePayOSReturn('?code=00&id=x&cancel=false&status=PAID&orderCode=1e3')).toBeNull()
  })
})
