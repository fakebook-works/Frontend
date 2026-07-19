export const POST_BACKGROUND_PRESETS = [
  { id: 'ocean', background: 'linear-gradient(135deg, #1877f2 0%, #45a3ff 100%)' },
  { id: 'violet', background: 'linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)' },
  { id: 'sunset', background: 'linear-gradient(135deg, #ff6b6b 0%, #f59e0b 100%)' },
  { id: 'rose', background: 'linear-gradient(135deg, #ec4899 0%, #fb7185 100%)' },
  { id: 'mint', background: 'linear-gradient(135deg, #0f9f8f 0%, #34d399 100%)' },
  { id: 'midnight', background: 'linear-gradient(135deg, #111827 0%, #374151 100%)' },
] as const

export type PostBackgroundId = (typeof POST_BACKGROUND_PRESETS)[number]['id']

const POST_BACKGROUND_PREFIX = '[[post-bg:v1:'
const POST_BACKGROUND_PATTERN = /^\[\[post-bg:v1:([a-z0-9-]+)\]\](?:\r?\n)?/i
const ALLOWED_BACKGROUND_IDS = new Set<string>(POST_BACKGROUND_PRESETS.map((preset) => preset.id))

export function isPostBackgroundId(value: string): value is PostBackgroundId {
  return ALLOWED_BACKGROUND_IDS.has(value)
}

export function getPostBackgroundPreset(backgroundId: PostBackgroundId | null | undefined) {
  return backgroundId
    ? POST_BACKGROUND_PRESETS.find((preset) => preset.id === backgroundId) ?? null
    : null
}

export function encodePostContent(text: string, backgroundId: PostBackgroundId | null = null) {
  const content = text.trim()
  if (!backgroundId || !isPostBackgroundId(backgroundId)) return content
  return `${POST_BACKGROUND_PREFIX}${backgroundId}]]${content ? `\n${content}` : ''}`
}

export function decodePostContent(rawContent: string | null | undefined) {
  const raw = rawContent ?? ''
  const match = POST_BACKGROUND_PATTERN.exec(raw)
  if (!match) {
    return {
      text: raw,
      backgroundId: null,
      hasBackgroundMetadata: false,
    } as const
  }

  const backgroundId = match[1].toLowerCase()
  const allowedBackgroundId = isPostBackgroundId(backgroundId) ? backgroundId : null
  return {
    text: raw.slice(match[0].length),
    backgroundId: allowedBackgroundId,
    hasBackgroundMetadata: allowedBackgroundId !== null,
  }
}
