import { parseMentionContent, type MentionDisplayUser } from './mentions'

/**
 * A linear-size map between serialized mention content and the text rendered to
 * the user. Each boundary stores only numeric offsets; the rendered text itself
 * is kept once so measuring long captions never builds every possible prefix.
 */
export interface MentionTruncationMap {
  display: string
  rawOffsets: readonly number[]
  displayOffsets: readonly number[]
}

export function buildMentionTruncationMap(
  content: string,
  mentions: readonly MentionDisplayUser[],
  unavailableLabel: string,
): MentionTruncationMap {
  const users = new Map(mentions.map((mention) => [mention.userId, mention]))
  const displayParts: string[] = []
  const rawOffsets: number[] = [0]
  const displayOffsets: number[] = [0]
  let rawOffset = 0
  let displayOffset = 0

  parseMentionContent(content).forEach((segment) => {
    if (segment.type === 'mention') {
      const mention = users.get(segment.userId)
      const token = `[[mention:${segment.userId}]]`
      const label = mention?.available && mention.name ? mention.name : unavailableLabel
      rawOffset += token.length
      displayOffset += label.length
      displayParts.push(label)
      rawOffsets.push(rawOffset)
      displayOffsets.push(displayOffset)
      return
    }

    displayParts.push(segment.value)
    for (const character of segment.value) {
      rawOffset += character.length
      displayOffset += character.length
      rawOffsets.push(rawOffset)
      displayOffsets.push(displayOffset)
    }
  })

  return {
    display: displayParts.join(''),
    rawOffsets,
    displayOffsets,
  }
}
