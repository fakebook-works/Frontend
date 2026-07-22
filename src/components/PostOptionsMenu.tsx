import { useEffect, useRef, useState } from 'react'
import type { GatewayPost } from '../api/gatewayTypes'
import { socialApi, type GroupMembershipState, type ProfileRelationshipState } from '../api/social'
import { useI18n } from '../i18n'
import { Icon } from './Icon'

export function PostOptionsMenu({
  post,
  viewerId,
  owned,
  onDelete,
  onPostHidden,
}: {
  post: GatewayPost
  viewerId?: string
  owned: boolean
  onDelete?: () => void
  onPostHidden?: () => void
}) {
  const { t } = useI18n()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [relationship, setRelationship] = useState<ProfileRelationshipState | null>(null)
  const [membership, setMembership] = useState<GroupMembershipState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    function closeFromOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeFromOutside)
    return () => document.removeEventListener('pointerdown', closeFromOutside)
  }, [open])

  useEffect(() => {
    if (!open || !viewerId) return
    let active = true
    setLoading(true)
    setError(null)
    const context = owned
      ? Promise.resolve({ relationship: null, membership: null })
      : post.__typename === 'GroupPostDetail'
      ? socialApi.getGroupMembershipState(viewerId, post.group.id).then((value) => ({ membership: value, relationship: null }))
      : socialApi.getProfileRelationshipState(viewerId, post.author.id).then((value) => ({ relationship: value, membership: null }))
    Promise.all([
      socialApi.getContentEngagement(post.id).catch(() => null),
      context.catch(() => ({ relationship: null, membership: null })),
    ]).then(([engagement, state]) => {
      if (!active) return
      setSaved(Boolean(engagement?.viewerHasSaved))
      setRelationship(state.relationship)
      setMembership(state.membership)
    }).catch(() => {
      if (active) setError(t('postActionError'))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [open, owned, post, t, viewerId])

  async function runAction(key: string, action: () => Promise<boolean>, onSuccess: () => void) {
    setBusy(key)
    setError(null)
    try {
      if (!await action()) throw new Error('Action rejected')
      onSuccess()
    } catch {
      setError(t('postActionError'))
    } finally {
      setBusy(null)
    }
  }

  const disabled = loading || busy != null
  return <div className="post-options-menu" ref={rootRef}>
    <button type="button" className="post-header-icon" aria-label={t('postOptions')} aria-expanded={open} onClick={() => setOpen((value) => !value)}><Icon name="more" size={20} /></button>
    {open && <div className="post-options-popover" role="menu">
      {owned ? <>
        {loading && <div className="post-options-loading"><span className="spinner" /></div>}
        {!loading && viewerId && <button type="button" role="menuitem" disabled={disabled} onClick={() => void runAction('save', () => saved ? socialApi.unsaveContent(viewerId, post.id) : socialApi.saveContent(viewerId, post.id), () => setSaved((value) => !value))}><Icon name="bookmark" size={20} /><span><strong>{saved ? t('unsavePost') : t('savePost')}</strong></span></button>}
        {!loading && (onDelete || viewerId) && <button type="button" role="menuitem" className="danger-text" disabled={disabled} onClick={() => {
          if (onDelete) {
            setOpen(false)
            onDelete()
            return
          }
          if (viewerId && window.confirm(t('deletePostConfirm'))) {
            void runAction('delete', () => socialApi.deleteContent(post.id), () => { setOpen(false); onPostHidden?.() })
          }
        }}><Icon name="trash" size={20} /><span><strong>{t('deletePost')}</strong></span></button>}
      </> : viewerId ? <>
        {loading && <div className="post-options-loading"><span className="spinner" /></div>}
        {!loading && <button type="button" role="menuitem" disabled={disabled} onClick={() => void runAction('save', () => saved ? socialApi.unsaveContent(viewerId, post.id) : socialApi.saveContent(viewerId, post.id), () => setSaved((value) => !value))}><Icon name="bookmark" size={20} /><span><strong>{saved ? t('unsavePost') : t('savePost')}</strong></span></button>}
        {!loading && post.__typename !== 'GroupPostDetail' && relationship?.isFollowing && <button type="button" role="menuitem" disabled={disabled} onClick={() => void runAction('unfollow', () => socialApi.unfollowUser(viewerId, post.author.id), () => setRelationship((value) => value ? { ...value, isFollowing: false } : value))}><Icon name="userMinus" size={20} /><span><strong>{t('unfollow')}</strong></span></button>}
        {!loading && post.__typename !== 'GroupPostDetail' && relationship?.friendship === 'friend' && <button type="button" role="menuitem" disabled={disabled} onClick={() => void runAction('unfriend', () => socialApi.unfriend(viewerId, post.author.id), () => setRelationship((value) => value ? { ...value, friendship: 'none' } : value))}><Icon name="friends" size={20} /><span><strong>{t('removeFriend')}</strong></span></button>}
        {!loading && post.__typename !== 'GroupPostDetail' && !relationship?.isBlocked && <button type="button" role="menuitem" disabled={disabled} onClick={() => void runAction('block', () => socialApi.blockUser(viewerId, post.author.id), () => { setOpen(false); onPostHidden?.() })}><Icon name="block" size={20} /><span><strong>{t('block')}</strong></span></button>}
        {!loading && post.__typename === 'GroupPostDetail' && membership?.isMember && !membership.isAdmin && <button type="button" role="menuitem" disabled={disabled} onClick={() => void runAction('leave', () => socialApi.leaveGroup(viewerId, post.group.id), () => { setMembership((value) => value ? { ...value, isMember: false } : value); setOpen(false) })}><Icon name="logout" size={20} /><span><strong>{t('leaveGroup')}</strong></span></button>}
      </> : null}
      {error && <p className="post-options-error" role="alert">{error}</p>}
    </div>}
  </div>
}
