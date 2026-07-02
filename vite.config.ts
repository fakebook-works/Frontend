import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

function proxyTargetFromGatewayUrl(gatewayUrl: string | undefined): string | undefined {
  if (!gatewayUrl || gatewayUrl.startsWith('/')) return undefined

  try {
    return new URL(gatewayUrl).origin
  } catch {
    return undefined
  }
}

function normalizeProxyPath(path: string | undefined, fallback: string): string {
  const trimmed = path?.trim()
  if (!trimmed) return fallback

  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return normalizedPath.replace(/\/+$/, '') || fallback
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxy: Record<string, ProxyOptions> = {}
  const apiGatewayTarget = proxyTargetFromGatewayUrl(env.VITE_API_GATEWAY_URL)
  const socketGatewayTarget = proxyTargetFromGatewayUrl(env.VITE_SOCKET_GATEWAY_URL) ?? apiGatewayTarget
  const socketPath = normalizeProxyPath(env.VITE_SOCKET_PATH, '/socket.io')
  const uploadsTarget = env.UPLOADS_HTTPS || env.UPLOADS_HTTP

  if (apiGatewayTarget) {
    proxy['/api'] = {
      target: apiGatewayTarget,
      changeOrigin: true,
    }
  }

  if (socketGatewayTarget) {
    proxy[socketPath] = {
      target: socketGatewayTarget,
      changeOrigin: true,
      ws: true,
    }
  }

  if (uploadsTarget) {
    proxy['/media'] = {
      target: uploadsTarget,
      changeOrigin: true,
    }
  }

  return {
    plugins: [react()],
    server: {
      proxy,
    },
  }
})