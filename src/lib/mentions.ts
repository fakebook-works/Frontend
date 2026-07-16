export function activeMention(text: string): { start: number; query: string } | null {
  const match = /(?:^|\s)@([^\s@]*)$/.exec(text)
  if (!match) return null
  return { start: match.index + (match[0].startsWith(' ') ? 1 : 0), query: match[1].toLocaleLowerCase() }
}
