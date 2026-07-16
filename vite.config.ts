import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

export function proxyTargetFromGatewayUrl(gatewayUrl: string | undefined): string | undefined {
  if (!gatewayUrl || gatewayUrl.startsWith('/')) return undefined

  try {
    return new URL(gatewayUrl).origin
  } catch {
    return undefined
  }
}

export function allowedDevHosts(value: string | undefined): string[] {
  if (!value?.trim()) return []
  return [...new Set(value.split(',').flatMap((entry) => {
    const trimmed = entry.trim()
    if (!trimmed || trimmed === '*') return []
    try {
      const url = trimmed.includes('://') ? new URL(trimmed) : new URL(`https://${trimmed}`)
      return /^[a-z0-9.-]+$/i.test(url.hostname) ? [url.hostname] : []
    } catch {
      return []
    }
  }))]
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxy: Record<string, ProxyOptions> = {}
  const devGatewayTarget = proxyTargetFromGatewayUrl(env.VITE_DEV_GATEWAY_TARGET)
  const apiGatewayTarget = devGatewayTarget ?? proxyTargetFromGatewayUrl(env.VITE_API_GATEWAY_URL)
  const graphQlGatewayTarget = devGatewayTarget ?? proxyTargetFromGatewayUrl(env.VITE_GRAPHQL_GATEWAY_URL) ?? apiGatewayTarget
  const uploadsTarget = proxyTargetFromGatewayUrl(env.VITE_DEV_UPLOAD_TARGET) ?? env.UPLOADS_HTTPS ?? env.UPLOADS_HTTP
  const allowedHosts = allowedDevHosts(env.VITE_DEV_ALLOWED_HOST)

  if (apiGatewayTarget) {
    proxy['/api'] = {
      target: apiGatewayTarget,
      changeOrigin: true,
    }
  }

  if (graphQlGatewayTarget) {
    proxy['/graphql'] = {
      target: graphQlGatewayTarget,
      changeOrigin: true,
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
      allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
    },
  }
})
