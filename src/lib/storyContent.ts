export const STORY_BACKGROUND_PRESETS = [
  { id: 'blue', color: '#0866ff' },
  { id: 'purple', color: '#7c3aed' },
  { id: 'pink', color: '#d63384' },
  { id: 'orange', color: '#e67e22' },
  { id: 'green', color: '#11998e' },
  { id: 'charcoal', color: '#242526' },
] as const

export const DEFAULT_STORY_BACKGROUND: string = STORY_BACKGROUND_PRESETS[0].color

const STORY_BACKGROUND_PREFIX = '[[story-bg:'
const STORY_BACKGROUND_PATTERN = /^\[\[story-bg:(#[0-9a-fA-F]{6})\]\](?:\r?\n)?/
const ALLOWED_BACKGROUNDS = new Set<string>(STORY_BACKGROUND_PRESETS.map((preset) => preset.color.toLowerCase()))

export function isStoryBackground(color: string) {
  return ALLOWED_BACKGROUNDS.has(color.toLowerCase())
}

export function encodeStoryContent(text: string, backgroundColor = DEFAULT_STORY_BACKGROUND) {
  const color = isStoryBackground(backgroundColor) ? backgroundColor.toLowerCase() : DEFAULT_STORY_BACKGROUND
  const content = text.trim()
  return `${STORY_BACKGROUND_PREFIX}${color}]]${content ? `\n${content}` : ''}`
}

export function decodeStoryContent(rawContent: string | null | undefined) {
  const raw = rawContent ?? ''
  const match = STORY_BACKGROUND_PATTERN.exec(raw)
  if (!match || !isStoryBackground(match[1])) {
    return {
      text: raw,
      backgroundColor: DEFAULT_STORY_BACKGROUND,
      hasBackgroundMetadata: false,
    }
  }

  return {
    text: raw.slice(match[0].length),
    backgroundColor: match[1].toLowerCase(),
    hasBackgroundMetadata: true,
  }
}
