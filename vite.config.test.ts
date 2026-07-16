import { describe, expect, it } from 'vitest'
import { allowedDevHosts, proxyTargetFromGatewayUrl } from './vite.config'

describe('Vite development proxy targets', () => {
  it('keeps browser-relative URLs out of the proxy target resolver', () => {
    expect(proxyTargetFromGatewayUrl('/graphql')).toBeUndefined()
    expect(proxyTargetFromGatewayUrl('/media')).toBeUndefined()
  })

  it('normalizes absolute development endpoints to their origins', () => {
    expect(proxyTargetFromGatewayUrl('http://localhost:2001/graphql')).toBe('http://localhost:2001')
    expect(proxyTargetFromGatewayUrl('http://localhost:4001/media')).toBe('http://localhost:4001')
  })

  it('allows only explicit hostnames and rejects wildcard configuration', () => {
    expect(allowedDevHosts('https://fakebook.example.ts.net:8443, localhost, *')).toEqual(['fakebook.example.ts.net', 'localhost'])
    expect(allowedDevHosts('*')).toEqual([])
  })
})
