// Single fetch-based API client for the Fakebook backend.
// Authentication uses the Gateway GraphQL endpoint. Only the short-lived
// access token is available to JavaScript; the Gateway owns the HttpOnly
// refresh cookie and rotates it during refresh requests.
import type { MediaUpload } from './types'
import type {
  CreateGatewayPostInput,
  CreateGatewayStoryInput,
  CreatedContent,
  GatewayPost,
  NormalStory,
  PremiumCheckout,
  PremiumOrder,
  PaymentOrderStatus,
  PremiumPlan,
  PremiumPlanOffer,
  RecommendationItem,
  StoryPage,
  VisitedGroupPage,
} from './gatewayTypes'

const DEFAULT_GRAPHQL_GATEWAY_URL = '/graphql'
const DEFAULT_JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

const GATEWAY_ERROR_STATUSES = new Set([502, 503, 504])
const GATEWAY_ERROR_MESSAGE = 'Server is temporarily unreachable.'
const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.'

type ApiAuthMode = 'protected' | 'public'

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

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim()
  if (!trimmed) return fallback
  return trimmed.replace(/\/+$/, '') || fallback
}

export const GRAPHQL_GATEWAY_URL = normalizeBaseUrl(
  import.meta.env.VITE_GRAPHQL_GATEWAY_URL ?? DEFAULT_GRAPHQL_GATEWAY_URL,
  DEFAULT_GRAPHQL_GATEWAY_URL,
)
export const UPLOAD_SERVER_URL = normalizeBaseUrl(import.meta.env.VITE_UPLOAD_SERVER_URL ?? '/media', '/media')

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

export function parseGraphQlEnvelope<T>(text: string): GraphQlEnvelope<T> {
  // HotChocolate Long values are JSON numbers. Quote Snowflake-sized identity
  // fields before JSON.parse so JavaScript cannot round them past 2^53 - 1.
  const losslessIdentityJson = text.replace(
    /("(?:id|[A-Za-z][A-Za-z0-9]*Id)"\s*:\s*)(-?\d{16,})(?=\s*[,}])/g,
    '$1"$2"',
  )
  return JSON.parse(losslessIdentityJson) as GraphQlEnvelope<T>
}

export function graphQlLongLiteral(value: string): string {
  if (!/^[1-9]\d*$/.test(value)) throw new ApiError(400, 'Invalid identifier.')
  return value
}

function normalizeMedia<T extends { id: string | number }>(media: T): T & { id: string } {
  return { ...media, id: String(media.id) }
}

function normalizeGatewayPost(post: GatewayPost): GatewayPost {
  const normalized = {
    ...post,
    id: String(post.id),
    author: { ...post.author, id: String(post.author.id) },
    media: post.media.map(normalizeMedia),
  }
  return post.__typename === 'GroupPostDetail'
    ? { ...normalized, __typename: 'GroupPostDetail', group: { ...post.group, id: String(post.group.id) } }
    : { ...normalized, __typename: 'FeedPostDetail' }
}


function normalizeAuthUser(user: AuthUser): AuthUser {
  return { ...user, userId: String(user.userId) }
}

function normalizeSession(session: AuthSession): AuthSession {
  return { ...session, sessionId: String(session.sessionId) }
}

export async function gatewayGraphQl<T>(
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
      if (refreshed) return gatewayGraphQl<T>(document, variables, authMode, false)
    }
    return expireSession()
  }

  if (!res.ok || firstError || !envelope.data) {
    throw new ApiError(res.ok ? 400 : res.status, 'The request could not be completed.', code)
  }

  return envelope.data
}

// Existing feature modules in this file keep the local alias while newer
// modules import the public, typed Gateway transport above.
const graphQlRequest = gatewayGraphQl

// Share a single in-flight refresh across concurrent 401s.
let refreshing: Promise<StoredAuth | null> | null = null

async function refreshTokens(): Promise<StoredAuth | null> {
  try {
    const data = await gatewayGraphQl<{ refreshToken: LoginResult }>(
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
function directUploadUrl(): string {
  return UPLOAD_SERVER_URL.endsWith('/media')
    ? `${UPLOAD_SERVER_URL}/upload`
    : `${UPLOAD_SERVER_URL}/media/upload`
}

export function resolveUploadedMediaUrl(value: string, baseUrl = UPLOAD_SERVER_URL): string {
  if (/^https?:\/\//i.test(value) || !/^https?:\/\//i.test(baseUrl)) return value
  return new URL(value, `${baseUrl.replace(/\/+$/, '')}/`).toString()
}

async function uploadMedia(file: File, allowRetry = true): Promise<MediaUpload> {
  const send = (token: string | undefined) => {
    const headers = jsonHeaders(undefined, false, 'protected')
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const form = new FormData()
    form.append('file', file)
    return fetch(directUploadUrl(), { method: 'POST', headers, body: form })
  }

  let res: Response
  try {
    res = await send(getAuth()?.accessToken)
  } catch {
    notifyGatewayError(503)
    throw new ApiError(503, GATEWAY_ERROR_MESSAGE)
  }

  const uploaded = await responseInterceptor<MediaUpload>(res, {
    authMode: 'protected',
    allowRetry,
    parse: (response) => response.json() as Promise<MediaUpload>,
    retryAfterRefresh: () => uploadMedia(file, false),
  })
  return { ...uploaded, url: resolveUploadedMediaUrl(uploaded.url) }
}

const HOME_POST_FIELDS = `
  __typename
  ... on FeedPostDetail {
    id type content privacy create
    author { id name avatar isVerified canFollow }
    media { id type url }
  }
  ... on GroupPostDetail {
    id type content privacy create
    author { id name avatar isVerified canFollow }
    group { id name avatar canJoin }
    media { id type url }
  }
`

const HOME_STORY_FIELDS = `
  __typename
  ... on NormalStory { id content create media { id type url } }
  ... on FeedPostShareStory {
    id content create
    sharedSource { id content media { id type url } author { id name avatar isVerified } }
  }
  ... on ReelShareStory {
    id content create
    sharedSource { id content media { id type url } author { id name avatar isVerified } }
  }
`


function normalizeStoryPage(page: StoryPage): StoryPage {
  return {
    ...page,
    items: page.items.map((bucket) => ({
      ...bucket,
      author: { ...bucket.author, id: String(bucket.author.id) },
      stories: bucket.stories.map((story) => {
        const base = { ...story, id: String(story.id) }
        if (story.__typename === 'NormalStory') {
          return { ...base, __typename: 'NormalStory', media: story.media.map(normalizeMedia) }
        }
        return {
          ...base,
          __typename: story.__typename,
          sharedSource: {
            ...story.sharedSource,
            id: String(story.sharedSource.id),
            media: story.sharedSource.media ? normalizeMedia(story.sharedSource.media) : null,
            author: story.sharedSource.author
              ? { ...story.sharedSource.author, id: String(story.sharedSource.author.id) }
              : null,
          },
        }
      }),
    })),
  }
}

export function validatedCheckoutUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ApiError(502, 'Checkout could not be started. Please try again.')
  }
  if (url.protocol !== 'https:') {
    throw new ApiError(502, 'The checkout link could not be verified.')
  }
  return url.toString()
}

export function visibleRecommendationPosts(items: RecommendationItem[]): GatewayPost[] {
  return items.flatMap((item) => (item.post ? [item.post] : []))
}

export function nextPageCursor(page: { hasNextPage: boolean; endCursor: string | null }): string | null {
  return page.hasNextPage ? page.endCursor : null
}

export function isTerminalPaymentStatus(status: PaymentOrderStatus): boolean {
  return ['ACTIVATED', 'CANCELLED', 'EXPIRED', 'FAILED'].includes(status)
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

  // ----- composed SocialGraph / Recommendation -----
  recommendedFeed: async (userId: string, skip = 0, take = 20): Promise<RecommendationItem[]> => {
    const data = await graphQlRequest<{ recommendFeed: RecommendationItem[] }>(
      `query RecommendedFeed($userId: ID!, $skip: Int!, $take: Int!) {
        recommendFeed(userId: $userId, skip: $skip, take: $take) {
          postId
          post { ${HOME_POST_FIELDS} }
        }
      }`,
      { userId, skip: Math.max(0, skip), take: Math.min(100, Math.max(1, take)) },
    )
    return data.recommendFeed.map((item) => ({
      postId: String(item.postId),
      post: item.post ? normalizeGatewayPost(item.post) : null,
    }))
  },
  postDetail: async (postId: string): Promise<GatewayPost | null> => {
    const id = graphQlLongLiteral(postId)
    const data = await graphQlRequest<{ postDetail: GatewayPost | null }>(
      `query PostDetail { postDetail(postId: ${id}) { ${HOME_POST_FIELDS} } }`,
    )
    return data.postDetail ? normalizeGatewayPost(data.postDetail) : null
  },
  createFeedPost: async (input: CreateGatewayPostInput): Promise<CreatedContent> => {
    const authorId = graphQlLongLiteral(input.authorId)
    const data = await graphQlRequest<{ createFeedPost: CreatedContent }>(
      `mutation CreateFeedPost($content: String!, $privacy: Int!, $media: [MediaInput!]) {
        createFeedPost(input: {
          authorId: ${authorId}
          content: $content
          privacy: $privacy
          media: $media
        }) {
          id type content privacy create authorId media { id type url }
        }
      }`,
      { content: input.content, privacy: input.privacy, media: input.media ?? null },
    )
    return {
      ...data.createFeedPost,
      id: String(data.createFeedPost.id),
      authorId: String(data.createFeedPost.authorId),
      media: data.createFeedPost.media.map(normalizeMedia),
    }
  },
  homeStories: async (userId: string, limit = 12, cursor: string | null = null): Promise<StoryPage> => {
    const id = graphQlLongLiteral(userId)
    const data = await graphQlRequest<{ homeStories: StoryPage }>(
      `query HomeStories($limit: Int!, $cursor: String) {
        homeStories(userId: ${id}, limit: $limit, cursor: $cursor) {
          items {
            author { id name avatar isVerified }
            latestCreate
            stories { ${HOME_STORY_FIELDS} }
          }
          endCursor
          hasNextPage
        }
      }`,
      { limit: Math.min(50, Math.max(1, limit)), cursor },
    )
    return normalizeStoryPage(data.homeStories)
  },
  myStories: async (userId: string): Promise<StoryPage['items'][number] | null> => {
    const id = graphQlLongLiteral(userId)
    const data = await graphQlRequest<{ myStories: StoryPage['items'][number] | null }>(
      `query MyStories {
        myStories(userId: ${id}) {
          author { id name avatar isVerified }
          latestCreate
          stories { ${HOME_STORY_FIELDS} }
        }
      }`,
    )
    if (!data.myStories) return null
    return normalizeStoryPage({ items: [data.myStories], endCursor: null, hasNextPage: false }).items[0]
  },
  createNormalStory: async (input: CreateGatewayStoryInput): Promise<NormalStory> => {
    const authorId = graphQlLongLiteral(input.authorId)
    const data = await graphQlRequest<{ createNormalStory: NormalStory }>(
      `mutation CreateNormalStory($content: String!, $media: MediaInput) {
        createNormalStory(input: { authorId: ${authorId}, content: $content, media: $media }) {
          id content create media { id type url }
        }
      }`,
      { content: input.content, media: input.media ?? null },
    )
    return {
      ...data.createNormalStory,
      __typename: 'NormalStory',
      id: String(data.createNormalStory.id),
      media: data.createNormalStory.media.map(normalizeMedia),
    }
  },
  createShareStory: async (authorIdValue: string, sourceIdValue: string, content: string) => {
    const authorId = graphQlLongLiteral(authorIdValue)
    const sourceId = graphQlLongLiteral(sourceIdValue)
    const data = await graphQlRequest<{ createShareStory: { __typename: string; id: string } }>(
      `mutation CreateShareStory($content: String!) {
        createShareStory(input: { authorId: ${authorId}, content: $content, sharedSourceId: ${sourceId} }) {
          ${HOME_STORY_FIELDS}
        }
      }`,
      { content },
    )
    return { ...data.createShareStory, id: String(data.createShareStory.id) }
  },
  deleteStory: async (authorIdValue: string, storyIdValue: string): Promise<AuthActionResult> => {
    const authorId = graphQlLongLiteral(authorIdValue)
    const storyId = graphQlLongLiteral(storyIdValue)
    const data = await graphQlRequest<{ deleteStory: AuthActionResult }>(
      `mutation DeleteStory {
        deleteStory(input: { authorId: ${authorId}, storyId: ${storyId} }) { success message }
      }`,
    )
    return data.deleteStory
  },
  visitedGroups: async (userId: string, limit = 8, cursor: string | null = null): Promise<VisitedGroupPage> => {
    const id = graphQlLongLiteral(userId)
    const data = await graphQlRequest<{ visitedGroups: VisitedGroupPage }>(
      `query VisitedGroups($limit: Int!, $cursor: String) {
        visitedGroups(userId: ${id}, limit: $limit, cursor: $cursor) {
          items { id name avatar }
          endCursor
          hasNextPage
        }
      }`,
      { limit: Math.min(100, Math.max(1, limit)), cursor },
    )
    return {
      ...data.visitedGroups,
      items: data.visitedGroups.items.map((group) => ({ ...group, id: String(group.id) })),
    }
  },
  recordGroupVisit: async (userIdValue: string, groupIdValue: string): Promise<boolean> => {
    const userId = graphQlLongLiteral(userIdValue)
    const groupId = graphQlLongLiteral(groupIdValue)
    const data = await graphQlRequest<{ recordGroupVisit: boolean }>(
      `mutation RecordGroupVisit { recordGroupVisit(userId: ${userId}, groupId: ${groupId}) }`,
    )
    return data.recordGroupVisit
  },

  // ----- composed Payment -----
  premiumPlans: async (): Promise<PremiumPlanOffer[]> => {
    const data = await graphQlRequest<{ premiumPlans: PremiumPlanOffer[] }>(
      `query PremiumPlans { premiumPlans { code amount durationMonths } }`,
    )
    return data.premiumPlans
  },
  createPremiumCheckout: async (plan: PremiumPlan): Promise<PremiumCheckout> => {
    const data = await graphQlRequest<{ createPremiumCheckout: PremiumCheckout }>(
      `mutation CreatePremiumCheckout($input: CreatePremiumCheckoutInput!) {
        createPremiumCheckout(input: $input) { orderCode status checkoutUrl }
      }`,
      { input: { plan } },
    )
    return {
      ...data.createPremiumCheckout,
      orderCode: String(data.createPremiumCheckout.orderCode),
      checkoutUrl: validatedCheckoutUrl(data.createPremiumCheckout.checkoutUrl),
    }
  },
  premiumOrder: async (orderCode: string): Promise<PremiumOrder> => {
    const data = await graphQlRequest<{ premiumOrder: PremiumOrder }>(
      `query PremiumOrder($orderCode: ID!) {
        premiumOrder(orderCode: $orderCode) {
          orderCode plan amount status createdAt expiresAt paidAt targetValidDate
        }
      }`,
      { orderCode },
    )
    return { ...data.premiumOrder, orderCode: String(data.premiumOrder.orderCode) }
  },
  reconcilePremiumCheckout: async (orderCode: string): Promise<PremiumOrder> => {
    const data = await graphQlRequest<{ reconcilePremiumCheckout: PremiumOrder }>(
      `mutation ReconcilePremiumCheckout($orderCode: ID!) {
        reconcilePremiumCheckout(orderCode: $orderCode) {
          orderCode plan amount status createdAt expiresAt paidAt targetValidDate
        }
      }`,
      { orderCode: graphQlLongLiteral(orderCode) },
    )
    return { ...data.reconcilePremiumCheckout, orderCode: String(data.reconcilePremiumCheckout.orderCode) }
  },

}
