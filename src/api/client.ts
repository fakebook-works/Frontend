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
  PostDto,
  UserProfile,
  UserSummary,
} from './types'

const DEFAULT_API_GATEWAY_URL = '/api'
const DEFAULT_JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

function normalizeBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return DEFAULT_API_GATEWAY_URL
  return trimmed.replace(/\/+$/, '') || DEFAULT_API_GATEWAY_URL
}

export const API_GATEWAY_URL = normalizeBaseUrl(import.meta.env.VITE_API_GATEWAY_URL)

function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_GATEWAY_URL}${normalizedPath}`
}

function jsonHeaders(overrides?: HeadersInit, hasBody = false): Headers {
  const headers = new Headers(DEFAULT_JSON_HEADERS)
  if (!hasBody) headers.delete('Content-Type')
  if (overrides) {
    new Headers(overrides).forEach((value, key) => {
      headers.set(key, value)
    })
  }
  return headers
}

const AUTH_KEY = 'fb.auth'

export interface StoredAuth {
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string
  refreshTokenExpiresAt: string
  user: UserSummary
}

type Listener = (auth: StoredAuth | null) => void
let listeners: Listener[] = []

export function getAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? (JSON.parse(raw) as StoredAuth) : null
  } catch {
    return null
  }
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
    const res = await fetch(apiUrl('/auth/refresh'), {
      method: 'POST',
      headers: jsonHeaders(undefined, true),
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

async function request<T>(path: string, options: RequestInit = {}, allowRetry = true): Promise<T> {
  const auth = getAuth()
  const headers = jsonHeaders(options.headers, options.body != null)
  if (auth?.accessToken) headers.set('Authorization', `Bearer ${auth.accessToken}`)

  const res = await fetch(apiUrl(path), { ...options, headers })

  if (res.status === 401 && allowRetry && getAuth()?.refreshToken) {
    const refreshed = await ensureRefresh()
    if (refreshed) return request<T>(path, options, false)
    clearAuth()
    throw new ApiError(401, 'Your session has expired. Please log in again.')
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      message = body?.error ?? body?.title ?? message
    } catch {
      /* error body was not JSON */
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
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

// Uploads go to the separate upload service at /media (not the /api group), as
// multipart/form-data. request() can't be reused because it forces a JSON body.
async function uploadMedia(file: File): Promise<MediaUpload> {
  const form = new FormData()
  form.append('file', file)

  const send = (token: string | undefined) => {
    const headers = new Headers()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch('/media', { method: 'POST', headers, body: form })
  }

  let res = await send(getAuth()?.accessToken)
  if (res.status === 401 && getAuth()?.refreshToken) {
    const refreshed = await ensureRefresh()
    if (refreshed) res = await send(refreshed.accessToken)
  }

  if (!res.ok) {
    let message = `Upload failed (${res.status})`
    try {
      const body = await res.json()
      message = body?.error ?? body?.title ?? message
    } catch {
      /* error body was not JSON */
    }
    throw new ApiError(res.status, message)
  }
  return (await res.json()) as MediaUpload
}

export const api = {
  // ----- media -----
  uploadMedia,

  // ----- auth -----
  register: (body: RegisterBody) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: LoginBody) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: (refreshToken: string) =>
    request<void>('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  // ----- users -----
  me: () => request<UserProfile>('/users/me'),
  user: (id: string) => request<UserProfile>(`/users/${id}`),
  updateProfile: (body: UpdateProfileBody) =>
    request<UserProfile>('/users/me', { method: 'PUT', body: JSON.stringify(body) }),
  updateAvatar: (avatarUrl: string) =>
    request<UserProfile>('/users/me/avatar', { method: 'PUT', body: JSON.stringify({ avatarUrl }) }),
  searchUsers: (q: string) => request<UserSummary[]>(`/users/search?q=${encodeURIComponent(q)}`),
  activities: (take = 12) => request<ActivityDto[]>(`/users/me/activities?take=${take}`),

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
}
