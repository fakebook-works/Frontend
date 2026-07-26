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

async function readSubscription<T>(
  response: Response,
  subscription: GatewaySubscription<T>,
  signal: AbortSignal,
  onHealthy?: () => void,
) {
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
      if (payload.data) {
        // The stream is genuinely working, which is the only safe point to forget
        // previous failures.
        onHealthy?.()
        subscription.onData(payload.data)
      }
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
      // Deliberately not reset here: fetch resolving says nothing about whether the
      // gateway accepted the subscription. A 401, 429 or 500 rejects inside
      // readSubscription, and resetting first put the backoff back to one second, so a
      // failing gateway was hammered once a second forever by every open stream.
      await readSubscription(response, subscription, controller.signal, () => {
        retryAttempt = 0
      })
      if (!controller.signal.aborted) scheduleReconnect()
    } catch (error) {
      if (controller.signal.aborted) return
      subscription.onError?.(error instanceof Error ? error : new Error('Realtime connection failed.'))
      scheduleReconnect()
    }
  }

  const scheduleReconnect = () => {
    if (controller.signal.aborted || retryTimer !== null) return
    // Jitter keeps the several streams a single tab holds open from reconnecting in
    // lockstep after a gateway restart.
    const backoff = Math.min(15_000, 1_000 * 2 ** retryAttempt++)
    const delay = backoff / 2 + Math.random() * (backoff / 2)
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
