export const GROUP_MEMBERSHIP_CHANGED_EVENT = 'fakebook:group-membership-changed'

export interface GroupMembershipChangedDetail {
  groupId: string
  state: 'left'
}

export function notifyGroupLeft(groupId: string) {
  if (typeof window === 'undefined' || groupId.length === 0) return
  window.dispatchEvent(new CustomEvent<GroupMembershipChangedDetail>(GROUP_MEMBERSHIP_CHANGED_EVENT, {
    detail: { groupId, state: 'left' },
  }))
}

export function leftGroupIdFromEvent(event: Event): string | null {
  const detail = (event as CustomEvent<GroupMembershipChangedDetail>).detail
  return detail?.state === 'left' && typeof detail.groupId === 'string' && detail.groupId.length > 0
    ? detail.groupId
    : null
}
