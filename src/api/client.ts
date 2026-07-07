// Single fetch-based API client for the Fakebook backend.
// - Stores the JWT pair in localStorage.
// - Attaches the access token as a Bearer header.
// - On a 401, transparently tries the refresh-token flow once, then retries.
import type {
  ActivityDto,
  AuthResponse,
  CommentDto,
  FriendDto,
  FriendRequestDto,
  ListingDetailDto,
  ListingDto,
  MediaUpload,
  MediaUploadRequest,
  MessengerConversationDto,
  MessengerMessageDto,
  PostDto,
  UserProfile,
  UserSummary,
} from './types'

const DEFAULT_API_GATEWAY_URL = '/api'
const DEFAULT_JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

const API_V1_PREFIX = '/v1'
const AUTH_API_PREFIX = `${API_V1_PREFIX}/auth`
const USERS_API_PREFIX = `${API_V1_PREFIX}/users`

const AUTH_ROUTES = {
  register: `${AUTH_API_PREFIX}/register`,
  login: `${AUTH_API_PREFIX}/login`,
  refresh: `${AUTH_API_PREFIX}/refresh`,
  logout: `${AUTH_API_PREFIX}/logout`,
} as const

const USERS_ME_ROUTE = `${USERS_API_PREFIX}/me`

const USER_ROUTES = {
  me: USERS_ME_ROUTE,
  byId: (id: string) => `${USERS_API_PREFIX}/${encodeURIComponent(id)}`,
  updateProfile: USERS_ME_ROUTE,
  updateAvatar: `${USERS_ME_ROUTE}/avatar`,
  search: (q: string) => `${USERS_API_PREFIX}/search?q=${encodeURIComponent(q)}`,
  activities: (take: number) => `${USERS_ME_ROUTE}/activities?take=${take}`,
} as const

const PUBLIC_API_PATHS: ReadonlySet<string> = new Set([AUTH_ROUTES.register, AUTH_ROUTES.login, AUTH_ROUTES.refresh])

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
export const UPLOAD_SERVER_URL = normalizeBaseUrl(import.meta.env.VITE_UPLOAD_SERVER_URL ?? '/media')

function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_GATEWAY_URL}${normalizedPath}`
}

function normalizePath(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return normalizedPath.split('?')[0]
}

function authModeForPath(path: string, authMode?: ApiAuthMode): ApiAuthMode {
  if (authMode) return authMode
  return PUBLIC_API_PATHS.has(normalizePath(path)) ? 'public' : 'protected'
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
  accessTokenExpiresAt: string
  refreshToken: string
  refreshTokenExpiresAt: string
  user: UserSummary
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

export function persistAuth(res: AuthResponse): StoredAuth {
  const stored: StoredAuth = {
    accessToken: res.accessToken,
    accessTokenExpiresAt: res.accessTokenExpiresAt,
    refreshToken: res.refreshToken,
    refreshTokenExpiresAt: res.refreshTokenExpiresAt,
    user: res.user,
  }
  writeAuth(stored)
  return stored
}

export function setStoredUser(user: UserSummary) {
  const current = getAuth()
  if (current) writeAuth({ ...current, user })
}

export function subscribeAuth(fn: Listener): () => void {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((l) => l !== fn)
  }
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

// Share a single in-flight refresh across concurrent 401s.
let refreshing: Promise<StoredAuth | null> | null = null

async function refreshTokens(): Promise<StoredAuth | null> {
  const current = getAuth()
  if (!current?.refreshToken) return null
  try {
    const res = await fetch(apiUrl(AUTH_ROUTES.refresh), {
      method: 'POST',
      headers: jsonHeaders(undefined, true, 'public'),
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    })
    if (!res.ok) {
      clearAuth()
      return null
    }
    return persistAuth((await res.json()) as AuthResponse)
  } catch {
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
    if (context.allowRetry && getAuth()?.refreshToken) {
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
  username: string
  email: string
  password: string
  displayName: string
}
export interface LoginBody {
  usernameOrEmail: string
  password: string
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
export interface CreateListingBody {
  title: string
  description: string
  imageUrl: string | null
  category: number
  location: string | null
  type: number
  price: number
  auctionDays: number | null
}
export interface ListingQuery {
  category?: string
  q?: string
  type?: string
  skip?: number
  take?: number
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
  register: (body: RegisterBody) =>
    request<AuthResponse>(AUTH_ROUTES.register, { method: 'POST', body: JSON.stringify(body), auth: 'public' }),
  login: (body: LoginBody) =>
    request<AuthResponse>(AUTH_ROUTES.login, { method: 'POST', body: JSON.stringify(body), auth: 'public' }),
  logout: (refreshToken: string) =>
    request<void>(AUTH_ROUTES.logout, { method: 'POST', body: JSON.stringify({ refreshToken }) }),

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

  // ----- marketplace -----
  listings: (opts: ListingQuery = {}) => {
    const p = new URLSearchParams()
    if (opts.category) p.set('category', opts.category)
    if (opts.q) p.set('q', opts.q)
    if (opts.type) p.set('type', opts.type)
    p.set('skip', String(opts.skip ?? 0))
    p.set('take', String(opts.take ?? 24))
    return request<ListingDto[]>(`/marketplace?${p.toString()}`)
  },
  myListings: () => request<ListingDto[]>('/marketplace/mine'),
  listing: (id: string) => request<ListingDetailDto>(`/marketplace/${id}`),
  createListing: (body: CreateListingBody) =>
    request<ListingDetailDto>('/marketplace', { method: 'POST', body: JSON.stringify(body) }),
  placeBid: (id: string, amount: number) =>
    request<ListingDetailDto>(`/marketplace/${id}/bids`, { method: 'POST', body: JSON.stringify({ amount }) }),
  buyListing: (id: string) => request<ListingDetailDto>(`/marketplace/${id}/buy`, { method: 'POST' }),
  deleteListing: (id: string) => request<void>(`/marketplace/${id}`, { method: 'DELETE' }),

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
