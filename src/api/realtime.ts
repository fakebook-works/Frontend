import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client'

import { API_GATEWAY_URL, getAuth } from './client'

const DEFAULT_SOCKET_PATH = '/socket.io'
const DEFAULT_SOCKET_TRANSPORTS = ['websocket'] as const

export interface GatewaySocketAuthPayload {
  token?: string
  authorization?: string
}

export type GatewaySocketOptions = Partial<ManagerOptions & SocketOptions> & {
  authToken?: string | null
}

function normalizeOptionalUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  if (trimmed === '/') return ''
  return trimmed.replace(/\/+$/, '')
}

function socketUrlFromApiGatewayUrl(apiGatewayUrl: string): string {
  const trimmed = apiGatewayUrl.trim()
  if (!trimmed || trimmed.startsWith('/')) return ''

  try {
    return new URL(trimmed).origin
  } catch {
    return ''
  }
}

function normalizeSocketGatewayUrl(socketGatewayUrl: string | undefined, apiGatewayUrl: string): string {
  return normalizeOptionalUrl(socketGatewayUrl) ?? socketUrlFromApiGatewayUrl(apiGatewayUrl)
}

function normalizeSocketPath(value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return DEFAULT_SOCKET_PATH

  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return normalizedPath.replace(/\/+$/, '') || DEFAULT_SOCKET_PATH
}

function normalizeNamespace(namespace: string): string {
  const trimmed = namespace.trim()
  if (!trimmed || trimmed === '/') return ''

  const normalizedNamespace = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return normalizedNamespace.replace(/\/+$/, '')
}

export const SOCKET_GATEWAY_URL = normalizeSocketGatewayUrl(import.meta.env.VITE_SOCKET_GATEWAY_URL, API_GATEWAY_URL)
export const SOCKET_PATH = normalizeSocketPath(import.meta.env.VITE_SOCKET_PATH)

export function getGatewaySocketAuthPayload(token = getAuth()?.accessToken ?? null): GatewaySocketAuthPayload {
  if (!token) return {}

  return {
    token,
    authorization: `Bearer ${token}`,
  }
}

export function getGatewaySocketUrl(namespace = '/'): string {
  return `${SOCKET_GATEWAY_URL}${normalizeNamespace(namespace)}`
}

export function getGatewaySocketOptions(options: GatewaySocketOptions = {}): Partial<ManagerOptions & SocketOptions> {
  const { authToken, auth, path, transports, withCredentials, ...socketOptions } = options

  return {
    ...socketOptions,
    path: path ?? SOCKET_PATH,
    transports: transports ?? [...DEFAULT_SOCKET_TRANSPORTS],
    withCredentials: withCredentials ?? true,
    auth:
      auth ??
      ((callback) => {
        const token = authToken === undefined ? getAuth()?.accessToken ?? null : authToken
        callback(getGatewaySocketAuthPayload(token))
      }),
  }
}

export function createGatewaySocket(namespace = '/', options: GatewaySocketOptions = {}): Socket {
  return io(getGatewaySocketUrl(namespace), getGatewaySocketOptions(options))
}