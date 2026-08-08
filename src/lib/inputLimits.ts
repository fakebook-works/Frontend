/**
 * Browser-side input ceilings are a usability aid only. Every value is still
 * validated and bounded by the Gateway/service before it is persisted.
 */
export const INPUT_LIMITS = {
  email: 254,
  displayName: 80,
  profileDescription: 255,
  profileLocation: 255,
  post: 63_206,
  comment: 8_000,
  messenger: 20_000,
  story: 125,
  password: 128,
  search: 200,
  groupName: 100,
  groupDescription: 2_000,
  conversationTitle: 120,
  reelCaption: 5_000,
  verificationCode: 6,
} as const
