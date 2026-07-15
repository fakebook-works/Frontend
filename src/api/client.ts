// Single fetch-based API client for the Fakebook backend.
// Authentication uses the Gateway GraphQL endpoint. Only the short-lived
// access token is available to JavaScript; the Gateway owns the HttpOnly
// refresh cookie and rotates it during refresh requests.
import type {
  ActivityDto,
  CommentDto,
  FriendDto,
  FriendRequestDto,
  MediaUpload,
  MediaUploadRequest,
  MessengerConversationDto,
  MessengerMessageDto,
  PostDto,
  UserProfile,
  UserSummary,
} from './types'

const DEFAULT_API_GATEWAY_URL = '/api'
const DEFAULT_GRAPHQL_GATEWAY_URL = '/graphql'
const DEFAULT_JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

const API_V1_PREFIX = '/v1'
const USERS_API_PREFIX = `${API_V1_PREFIX}/users`

const USERS_ME_ROUTE = `${USERS_API_PREFIX}/me`

const USER_ROUTES = {
  me: USERS_ME_ROUTE,
  byId: (id: string) => `${USERS_API_PREFIX}/${encodeURIComponent(id)}`,
  updateProfile: USERS_ME_ROUTE,
  updateAvatar: `${USERS_ME_ROUTE}/avatar`,
  search: (q: string) => `${USERS_API_PREFIX}/search?q=${encodeURIComponent(q)}`,
  activities: (take: number) => `${USERS_ME_ROUTE}/activities?take=${take}`,
} as const

const GATEWAY_ERROR_STATUSES = new Set([502, 503, 504])
const GATEWAY_ERROR_MESSAGE = 'Server is temporarily unreachable.'
const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.'

type ApiAuthMode = 'protected' | 'public'

interface ApiRequestInit extends RequestInit {
  auth?: ApiAuthMode
}

type ApiEvent =
  | { type: 'gateway-error'; status: number; message: string }
  | { type: 'auth-expired'; status: 401; message: string }

type ApiEventListener = (event: ApiEvent) => void

type ResponseInterceptorContext<T> = {
  authMode: ApiAuthMode
  allowRetry: boolean
  parse: (res: Response) => Promise<T>
  retryAfterRefresh: (auth: StoredAuth) => Promise<T>
}

function normalizeBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return DEFAULT_API_GATEWAY_URL
  return trimmed.replace(/\/+$/, '') || DEFAULT_API_GATEWAY_URL
}

export const API_GATEWAY_URL = normalizeBaseUrl(import.meta.env.VITE_API_GATEWAY_URL)
export const GRAPHQL_GATEWAY_URL = normalizeBaseUrl(
  import.meta.env.VITE_GRAPHQL_GATEWAY_URL ?? DEFAULT_GRAPHQL_GATEWAY_URL,
)
export const UPLOAD_SERVER_URL = normalizeBaseUrl(import.meta.env.VITE_UPLOAD_SERVER_URL ?? '/media')

function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_GATEWAY_URL}${normalizedPath}`
}

function authModeForPath(_path: string, authMode?: ApiAuthMode): ApiAuthMode {
  return authMode ?? 'protected'
}

function jsonHeaders(overrides?: HeadersInit, hasBody = false, authMode: ApiAuthMode = 'protected'): Headers {
  const headers = new Headers(DEFAULT_JSON_HEADERS)
  if (!hasBody) headers.delete('Content-Type')
  if (overrides) {
    new Headers(overrides).forEach((value, key) => {
      headers.set(key, value)
    })
  }
  applyAuthInterceptor(headers, authMode)
  return headers
}

const AUTH_KEY = 'fb.auth'
let apiEventListeners: ApiEventListener[] = []

export interface StoredAuth {
  accessToken: string
  user: AuthUser
}

export interface AuthUser {
  userId: string
  email: string
  validDate: string | null
  status: number
}

export interface AuthSession {
  sessionId: string
  deviceName: string | null
  os: string | null
  browser: string | null
  ipAddress: string | null
  expiresAt: string | null
  createdAt: string | null
  lastSeenAt: string | null
  revocationReason: string | null
  revokedAt: string | null
  isCurrent: boolean
}

export interface AuthActionResult {
  success: boolean
  message: string | null
}

export interface RegistrationResult extends AuthActionResult {
  userId: string | null
}

export interface LoginResult {
  accessToken: string
  refreshTokenExpiresAt: string | null
  user: AuthUser
}

type Listener = (auth: StoredAuth | null) => void
let listeners: Listener[] = []

export function subscribeApiEvents(fn: ApiEventListener): () => void {
  apiEventListeners.push(fn)
  return () => {
    apiEventListeners = apiEventListeners.filter((listener) => listener !== fn)
  }
}

function emitApiEvent(event: ApiEvent) {
  for (const listener of apiEventListeners) listener(event)
}

export function getAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? (JSON.parse(raw) as StoredAuth) : null
  } catch {
    return null
  }
}

function getAccessToken(): string | null {
  return getAuth()?.accessToken ?? null
}

function applyAuthInterceptor(headers: Headers, authMode: ApiAuthMode): Headers {
  if (authMode === 'public') {
    headers.delete('Authorization')
    return headers
  }
  const accessToken = getAccessToken()
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  return headers
}

function writeAuth(auth: StoredAuth | null) {
  if (auth) localStorage.setItem(AUTH_KEY, JSON.stringify(auth))
  else localStorage.removeItem(AUTH_KEY)
  for (const listener of listeners) listener(auth)
}

export function clearAuth() {
  writeAuth(null)
}

export function persistAuth(res: LoginResult): StoredAuth {
  const stored: StoredAuth = {
    accessToken: res.accessToken,
    user: res.user,
  }
  writeAuth(stored)
  return stored
}

export function subscribeAuth(fn: Listener): () => void {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((l) => l !== fn)
  }
}

export class ApiError extends Error {
  status: number
  code: string | null
  constructor(status: number, message: string, code: string | null = null) {
    super(message)
    this.status = status
    this.code = code
    this.name = 'ApiError'
  }
}

interface GraphQlErrorItem {
  message?: string
  extensions?: { code?: string }
}

interface GraphQlEnvelope<T> {
  data?: T
  errors?: GraphQlErrorItem[]
}

function parseGraphQlEnvelope<T>(text: string): GraphQlEnvelope<T> {
  // HotChocolate Long values are JSON numbers. Quote Snowflake-sized identity
  // fields before JSON.parse so JavaScript cannot round them past 2^53 - 1.
  const losslessIdentityJson = text.replace(
    /("(?:userId|sessionId)"\s*:\s*)(-?\d{16,})(?=\s*[,}])/g,
    '$1"$2"',
  )
  return JSON.parse(losslessIdentityJson) as GraphQlEnvelope<T>
}

function normalizeAuthUser(user: AuthUser): AuthUser {
  return { ...user, userId: String(user.userId) }
}

function normalizeSession(session: AuthSession): AuthSession {
  return { ...session, sessionId: String(session.sessionId) }
}

async function graphQlRequest<T>(
  document: string,
  variables: Record<string, unknown> = {},
  authMode: ApiAuthMode = 'protected',
  allowRetry = true,
): Promise<T> {
  const headers = jsonHeaders(undefined, true, authMode)
  let res: Response
  try {
    res = await fetch(GRAPHQL_GATEWAY_URL, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ query: document, variables }),
    })
  } catch {
    notifyGatewayError(503)
    throw new ApiError(503, GATEWAY_ERROR_MESSAGE)
  }

  if (GATEWAY_ERROR_STATUSES.has(res.status)) {
    notifyGatewayError(res.status)
    throw new ApiError(res.status, GATEWAY_ERROR_MESSAGE)
  }

  let envelope: GraphQlEnvelope<T>
  try {
    envelope = parseGraphQlEnvelope<T>(await res.text())
  } catch {
    throw new ApiError(res.status || 500, 'The server returned an invalid response.')
  }

  const firstError = envelope.errors?.[0]
  const code = firstError?.extensions?.code ?? null
  if ((res.status === 401 || code === 'UNAUTHENTICATED') && authMode === 'protected') {
    if (allowRetry) {
      const refreshed = await ensureRefresh()
      if (refreshed) return graphQlRequest<T>(document, variables, authMode, false)
    }
    return expireSession()
  }

  if (!res.ok || firstError || !envelope.data) {
    throw new ApiError(res.ok ? 400 : res.status, 'The request could not be completed.', code)
  }

  return envelope.data
}

// Share a single in-flight refresh across concurrent 401s.
let refreshing: Promise<StoredAuth | null> | null = null

async function refreshTokens(): Promise<StoredAuth | null> {
  try {
    const data = await graphQlRequest<{ refreshToken: LoginResult }>(
      `mutation RefreshSession {
        refreshToken {
          accessToken
          refreshTokenExpiresAt
          user { userId email validDate status }
        }
      }`,
      {},
      'public',
      false,
    )
    data.refreshToken.user = normalizeAuthUser(data.refreshToken.user)
    return persistAuth(data.refreshToken)
  } catch {
    clearAuth()
    return null
  }
}

function ensureRefresh(): Promise<StoredAuth | null> {
  if (!refreshing) {
    refreshing = refreshTokens().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

function expireSession(): never {
  clearAuth()
  emitApiEvent({ type: 'auth-expired', status: 401, message: SESSION_EXPIRED_MESSAGE })
  throw new ApiError(401, SESSION_EXPIRED_MESSAGE)
}

function notifyGatewayError(status: number) {
  emitApiEvent({ type: 'gateway-error', status, message: GATEWAY_ERROR_MESSAGE })
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json()
    return body?.error ?? body?.title ?? fallback
  } catch {
    return fallback
  }
}

async function parseJsonOrEmpty<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

async function responseInterceptor<T>(res: Response, context: ResponseInterceptorContext<T>): Promise<T> {
  if (res.status === 401 && context.authMode === 'protected') {
    if (context.allowRetry) {
      const refreshed = await ensureRefresh()
      if (refreshed) return context.retryAfterRefresh(refreshed)
    }
    return expireSession()
  }

  if (GATEWAY_ERROR_STATUSES.has(res.status)) {
    notifyGatewayError(res.status)
    throw new ApiError(res.status, GATEWAY_ERROR_MESSAGE)
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorMessage(res, `Request failed (${res.status})`))
  }

  return context.parse(res)
}

async function request<T>(path: string, options: ApiRequestInit = {}, allowRetry = true): Promise<T> {
  const { auth, headers: headerOverrides, ...fetchOptions } = options
  const authMode = authModeForPath(path, auth)
  const headers = jsonHeaders(headerOverrides, fetchOptions.body != null, authMode)

  let res: Response
  try {
    res = await fetch(apiUrl(path), { ...fetchOptions, headers })
  } catch {
    notifyGatewayError(503)
    throw new ApiError(503, GATEWAY_ERROR_MESSAGE)
  }

  return responseInterceptor<T>(res, {
    authMode,
    allowRetry,
    parse: parseJsonOrEmpty,
    retryAfterRefresh: () => request<T>(path, options, false),
  })
}

export interface RegisterBody {
  name: string
  gender: boolean
  birthdate: string
  location: string
  email: string
  password: string
}
export interface LoginBody {
  email: string
  password: string
}
export interface VerifyEmailBody {
  email: string
  otp: string
}
export interface ResetPasswordBody extends VerifyEmailBody {
  newPassword: string
}
export interface CreatePostBody {
  content: string
  imageUrl: string | null
  mediaType: string | null
  privacy: number
}
export interface UpdateProfileBody {
  displayName?: string
  bio?: string
  location?: string
  gender?: string
  birthDate?: string | null
}
export interface SendMessageBody {
  body: string
  attachments?: MediaUpload[]
}

async function createMediaUploadRequest(file: File): Promise<MediaUploadRequest> {
  const send = (token: string | undefined) => {
    const headers = jsonHeaders(undefined, true, 'protected')
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(`${UPLOAD_SERVER_URL}/media/upload-requests`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      }),
    })
  }

  let res: Response
  try {
    res = await send(getAuth()?.accessToken)
  } catch {
    notifyGatewayError(503)
    throw new ApiError(503, GATEWAY_ERROR_MESSAGE)
  }

  return responseInterceptor<MediaUploadRequest>(res, {
    authMode: 'protected',
    allowRetry: true,
    parse: (response) => response.json() as Promise<MediaUploadRequest>,
    retryAfterRefresh: async (auth) => {
      const retryResponse = await send(auth.accessToken)
      return responseInterceptor<MediaUploadRequest>(retryResponse, {
        authMode: 'protected',
        allowRetry: false,
        parse: (response) => response.json() as Promise<MediaUploadRequest>,
        retryAfterRefresh: () => expireSession(),
      })
    },
  })
}

// Uploads use a signed URL issued by the backend. The signed upload endpoint
// still performs full server-side validation before returning a stored media URL.
async function uploadMedia(file: File): Promise<MediaUpload> {
  const uploadRequest = await createMediaUploadRequest(file)
  const form = new FormData()
  form.append('file', file)

  const uploadUrl = uploadRequest.uploadUrl.startsWith('http')
    ? uploadRequest.uploadUrl
    : `${UPLOAD_SERVER_URL}${uploadRequest.uploadUrl}`

  let res: Response
  try {
    res = await fetch(uploadUrl, { method: 'PUT', body: form })
  } catch {
    notifyGatewayError(503)
    throw new ApiError(503, GATEWAY_ERROR_MESSAGE)
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorMessage(res, `Upload failed (${res.status})`))
  }

  return (await res.json()) as MediaUpload
}

export const api = {
  // ----- media -----
  uploadMedia,

  // ----- auth -----
  register: async (body: RegisterBody): Promise<RegistrationResult> => {
    const data = await graphQlRequest<{ createUser: RegistrationResult }>(
      `mutation CreateUser($input: CreateUserInput!) {
        createUser(input: $input) { success userId message }
      }`,
      { input: body },
      'public',
    )
    return {
      ...data.createUser,
      userId: data.createUser.userId == null ? null : String(data.createUser.userId),
    }
  },
  login: async (body: LoginBody): Promise<LoginResult> => {
    const data = await graphQlRequest<{ login: LoginResult }>(
      `mutation Login($input: LoginInput!) {
        login(input: $input) {
          accessToken
          refreshTokenExpiresAt
          user { userId email validDate status }
        }
      }`,
      { input: { identifier: body.email, password: body.password } },
      'public',
    )
    data.login.user = normalizeAuthUser(data.login.user)
    return data.login
  },
  restoreSession: async (): Promise<StoredAuth | null> => {
    const current = getAuth()
    if (current?.accessToken) {
      try {
        const data = await graphQlRequest<{ me: AuthUser }>(
          `query RestoreSession { me { userId email validDate status } }`,
        )
        return persistAuth({
          accessToken: current.accessToken,
          refreshTokenExpiresAt: null,
          user: normalizeAuthUser(data.me),
        })
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== 'UNAUTHENTICATED') {
          return getAuth()
        }
      }
    }
    return refreshTokens()
  },
  authMe: async (): Promise<AuthUser> => {
    const data = await graphQlRequest<{ me: AuthUser }>(
      `query CurrentAuthUser { me { userId email validDate status } }`,
    )
    return normalizeAuthUser(data.me)
  },
  verifyEmail: async (body: VerifyEmailBody): Promise<AuthActionResult> => {
    const data = await graphQlRequest<{ verifyEmail: AuthActionResult }>(
      `mutation VerifyEmail($input: VerifyEmailInput!) {
        verifyEmail(input: $input) { success message }
      }`,
      { input: { identifier: body.email, otp: body.otp } },
      'public',
    )
    return data.verifyEmail
  },
  resendEmailVerification: async (email: string): Promise<AuthActionResult> => {
    const data = await graphQlRequest<{ resendEmailVerification: AuthActionResult }>(
      `mutation ResendEmailVerification($input: ResendEmailVerificationInput!) {
        resendEmailVerification(input: $input) { success message }
      }`,
      { input: { identifier: email } },
      'public',
    )
    return data.resendEmailVerification
  },
  requestPasswordReset: async (email: string): Promise<AuthActionResult> => {
    const data = await graphQlRequest<{ requestPasswordReset: AuthActionResult }>(
      `mutation RequestPasswordReset($input: RequestPasswordResetInput!) {
        requestPasswordReset(input: $input) { success message }
      }`,
      { input: { identifier: email } },
      'public',
    )
    return data.requestPasswordReset
  },
  resetPassword: async (body: ResetPasswordBody): Promise<AuthActionResult> => {
    const data = await graphQlRequest<{ resetPassword: AuthActionResult }>(
      `mutation ResetPassword($input: ResetPasswordInput!) {
        resetPassword(input: $input) { success message }
      }`,
      { input: { identifier: body.email, otp: body.otp, newPassword: body.newPassword } },
      'public',
    )
    return data.resetPassword
  },
  changePassword: async (currentPassword: string, newPassword: string): Promise<AuthActionResult> => {
    const data = await graphQlRequest<{ changePassword: AuthActionResult }>(
      `mutation ChangePassword($input: ChangePasswordInput!) {
        changePassword(input: $input) { success message }
      }`,
      { input: { currentPassword, newPassword } },
    )
    return data.changePassword
  },
  logout: async (): Promise<AuthActionResult> => {
    const data = await graphQlRequest<{ logout: AuthActionResult }>(
      `mutation Logout { logout { success message } }`,
    )
    return data.logout
  },
  logoutAll: async (): Promise<AuthActionResult> => {
    const data = await graphQlRequest<{ logoutAll: AuthActionResult }>(
      `mutation LogoutAll { logoutAll { success message } }`,
    )
    return data.logoutAll
  },
  mySessions: async (): Promise<AuthSession[]> => {
    const data = await graphQlRequest<{ mySessions: AuthSession[] }>(
      `query MySessions {
        mySessions {
          sessionId deviceName os browser ipAddress expiresAt createdAt
          lastSeenAt revocationReason revokedAt isCurrent
        }
      }`,
    )
    return data.mySessions.map(normalizeSession)
  },
  mySessionHistory: async (): Promise<AuthSession[]> => {
    const data = await graphQlRequest<{ mySessionHistory: AuthSession[] }>(
      `query MySessionHistory {
        mySessionHistory {
          sessionId deviceName os browser ipAddress expiresAt createdAt
          lastSeenAt revocationReason revokedAt isCurrent
        }
      }`,
    )
    return data.mySessionHistory.map(normalizeSession)
  },
  logoutSession: async (sessionId: string): Promise<AuthActionResult> => {
    if (!/^\d+$/.test(sessionId)) throw new ApiError(400, 'Invalid session identifier.')
    const data = await graphQlRequest<{ logoutSession: AuthActionResult }>(
      `mutation LogoutSession {
        logoutSession(input: { sessionId: ${sessionId} }) { success message }
      }`,
    )
    return data.logoutSession
  },

  // ----- users -----
  me: () => request<UserProfile>(USER_ROUTES.me),
  user: (id: string) => request<UserProfile>(USER_ROUTES.byId(id)),
  updateProfile: (body: UpdateProfileBody) =>
    request<UserProfile>(USER_ROUTES.updateProfile, { method: 'PUT', body: JSON.stringify(body) }),
  updateAvatar: (avatarUrl: string) =>
    request<UserProfile>(USER_ROUTES.updateAvatar, { method: 'PUT', body: JSON.stringify({ avatarUrl }) }),
  searchUsers: (q: string) => request<UserSummary[]>(USER_ROUTES.search(q)),
  activities: (take = 12) => request<ActivityDto[]>(USER_ROUTES.activities(take)),

  // ----- friends -----
  friends: () => request<FriendDto[]>('/friends'),
  incomingRequests: () => request<FriendRequestDto[]>('/friends/requests/incoming'),
  outgoingRequests: () => request<FriendRequestDto[]>('/friends/requests/outgoing'),
  sendFriendRequest: (targetUserId: string) =>
    request<{ friendshipId: string }>('/friends/requests', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }),
  acceptRequest: (friendshipId: string) =>
    request<void>(`/friends/requests/${friendshipId}/accept`, { method: 'POST' }),
  declineRequest: (friendshipId: string) =>
    request<void>(`/friends/requests/${friendshipId}/decline`, { method: 'POST' }),
  unfriend: (friendshipId: string) => request<void>(`/friends/${friendshipId}`, { method: 'DELETE' }),

  // ----- posts / feed -----
  feed: (skip = 0, take = 20) => request<PostDto[]>(`/feed?skip=${skip}&take=${take}`),
  userPosts: (userId: string, skip = 0, take = 20) =>
    request<PostDto[]>(`/posts/user/${userId}?skip=${skip}&take=${take}`),
  createPost: (body: CreatePostBody) =>
    request<PostDto>('/posts', { method: 'POST', body: JSON.stringify(body) }),
  updatePost: (id: string, body: CreatePostBody) =>
    request<PostDto>(`/posts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePost: (id: string) => request<void>(`/posts/${id}`, { method: 'DELETE' }),
  sharePost: (id: string, message: string | null) =>
    request<PostDto>(`/posts/${id}/share`, { method: 'POST', body: JSON.stringify({ message }) }),

  // ----- comments / reactions -----
  comments: (postId: string) => request<CommentDto[]>(`/posts/${postId}/comments`),
  addComment: (postId: string, content: string, parentCommentId: string | null = null) =>
    request<CommentDto>(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parentCommentId }),
    }),
  react: (postId: string, type: number) =>
    request<void>(`/posts/${postId}/reactions`, { method: 'POST', body: JSON.stringify({ type }) }),
  unreact: (postId: string) => request<void>(`/posts/${postId}/reactions`, { method: 'DELETE' }),

  // ----- messenger -----
  messengerConversations: () => request<MessengerConversationDto[]>('/messenger/conversations'),
  messengerMessages: (conversationId: string) =>
    request<MessengerMessageDto[]>(`/messenger/conversations/${conversationId}/messages`),
  sendMessengerMessage: (conversationId: string, body: SendMessageBody) =>
    request<MessengerMessageDto>(`/messenger/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  startConversation: (participant: UserSummary) =>
    request<MessengerConversationDto>('/messenger/conversations', {
      method: 'POST',
      body: JSON.stringify({
        participantId: participant.id,
        username: participant.username,
        displayName: participant.displayName,
        avatarUrl: participant.avatarUrl,
      }),
    }),
}
