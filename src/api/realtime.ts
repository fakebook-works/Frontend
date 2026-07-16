import { GRAPHQL_GATEWAY_URL, getAuth, parseGraphQlEnvelope } from './client'

interface GraphQlSsePayload<T> {
  data?: T
  errors?: Array<{ message?: string }>
}

export interface GatewaySubscription<T> {
  query: string
  variables?: Record<string, unknown>
  onData: (data: T) => void
  onError?: (error: Error) => void
}

export function parseSseFrames(value: string): { payloads: string[]; remainder: string } {
  const normalized = value.replace(/\r\n/g, '\n')
  const frames = normalized.split('\n\n')
  const remainder = frames.pop() ?? ''
  const payloads = frames.flatMap((frame) => {
    const data = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
    return data ? [data] : []
  })
  return { payloads, remainder }
}

function subscriptionHeaders(): Headers {
  const headers = new Headers({
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
  })
  const token = getAuth()?.accessToken
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

async function readSubscription<T>(response: Response, subscription: GatewaySubscription<T>, signal: AbortSignal) {
  if (!response.ok) throw new Error(`Realtime connection failed (${response.status}).`)
  if (!response.body) throw new Error('Realtime response did not include a stream.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (!signal.aborted) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const parsed = parseSseFrames(buffer)
    buffer = parsed.remainder
    for (const payloadText of parsed.payloads) {
      if (payloadText === '[DONE]') return
      const payload = parseGraphQlEnvelope<T>(payloadText) as GraphQlSsePayload<T>
      if (payload.errors?.length) throw new Error(payload.errors[0]?.message || 'Realtime operation failed.')
      if (payload.data) subscription.onData(payload.data)
    }
    if (done) return
  }
}

export function subscribeGatewayGraphQl<T>(subscription: GatewaySubscription<T>): () => void {
  const controller = new AbortController()
  let retryTimer: number | null = null
  let retryAttempt = 0

  const connect = async () => {
    if (controller.signal.aborted) return
    try {
      const response = await fetch(GRAPHQL_GATEWAY_URL, {
        method: 'POST',
        headers: subscriptionHeaders(),
        credentials: 'include',
        body: JSON.stringify({ query: subscription.query, variables: subscription.variables ?? {} }),
        signal: controller.signal,
      })
      retryAttempt = 0
      await readSubscription(response, subscription, controller.signal)
      if (!controller.signal.aborted) scheduleReconnect()
    } catch (error) {
      if (controller.signal.aborted) return
      subscription.onError?.(error instanceof Error ? error : new Error('Realtime connection failed.'))
      scheduleReconnect()
    }
  }

  const scheduleReconnect = () => {
    if (controller.signal.aborted || retryTimer !== null) return
    const delay = Math.min(15_000, 1_000 * 2 ** retryAttempt++)
    retryTimer = window.setTimeout(() => {
      retryTimer = null
      void connect()
    }, delay)
  }

  void connect()
  return () => {
    controller.abort()
    if (retryTimer !== null) window.clearTimeout(retryTimer)
  }
}
