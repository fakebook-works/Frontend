import type { GatewayPost } from '../api/gatewayTypes'

export interface ProfilePostMonthGroup {
  id: string
  label: string
  posts: GatewayPost[]
}

export function groupProfilePostsByMonth(posts: GatewayPost[], locale: string): ProfilePostMonthGroup[] {
  const groups = new Map<string, ProfilePostMonthGroup>()
  for (const post of posts) {
    const created = new Date(post.create)
    const valid = !Number.isNaN(created.getTime())
    const id = valid ? `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}` : 'unknown'
    let group = groups.get(id)
    if (!group) {
      const formatted = valid
        ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(created)
        : post.create
      group = {
        id,
        label: formatted ? `${formatted.charAt(0).toLocaleUpperCase(locale)}${formatted.slice(1)}` : '',
        posts: [],
      }
      groups.set(id, group)
    }
    group.posts.push(post)
  }
  return [...groups.values()]
}
