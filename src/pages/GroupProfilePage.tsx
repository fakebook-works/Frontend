import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, FormEvent } from 'react'
import { api } from '../api/client'
import type { GatewayPost } from '../api/gatewayTypes'
import {
  socialApi,
  type GroupMembershipState,
  type ProfileRelationshipState,
  type SocialGroup,
  type SocialPhoto,
  type SocialProfile,
} from '../api/social'
import type { MediaUpload, UserSummary } from '../api/types'
import { AnchoredMenuPortal } from '../components/AnchoredMenuPortal'
import { Avatar } from '../components/Avatar'
import { GroupMembersIcon, GroupMembershipIcon } from '../components/GroupMembersIcon'
import { Icon } from '../components/Icon'
import { PostPrivacyIcon } from '../components/PostPrivacyIcon'
import { ProfilePostGridCard, ProfilePostGridIcon, ProfilePostListIcon, type ProfileGridMediaTarget } from '../components/ProfilePostGrid'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { useInlineImageCrop } from '../lib/useInlineImageCrop'
import { useImageAmbientColor } from '../lib/useImageAmbientColor'
import { groupProfilePostsByMonth } from '../lib/profilePostGrid'
import { useProfileColumnScroll, useProfilePageScrollMode } from '../lib/useProfileColumnScroll'
import { PostComposer, GatewayPostCard } from './GatewayHomePage'
import './GroupProfilePage.css'

const PostPhotoViewer = lazy(() => import('../components/PostPhotoViewer').then((module) => ({ default: module.PostPhotoViewer })))
const ContentDetailOverlay = lazy(() => import('../components/ContentActions').then((module) => ({ default: module.ContentDetailOverlay })))

type GroupProfileTab = 'discussion' | 'about' | 'people' | 'media'
type GroupMediaFilter = 'all' | 'photos' | 'videos'
type GroupPostFilter = 'all' | 'media' | 'text'
type GroupImageKind = 'avatar' | 'background'

interface GroupMediaViewerState {
  contentId: string
  media: { id: string; type: number; url: string }
}

const EMPTY_MEMBERSHIP: GroupMembershipState = {
  isMember: false,
  isAdmin: false,
  joinRequestPending: false,
  canViewPosts: false,
}

const EMPTY_RELATIONSHIP: ProfileRelationshipState = {
  friendship: 'none',
  isFollowing: false,
  followsViewer: false,
  isBlocked: false,
  isBlockedBy: false,
}

function groupDate(value: string, locale: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

function groupPhotoPreviewCornerClass(index: number, total: number) {
  const columnCount = 3
  const row = Math.floor(index / columnCount)
  const rowStart = row * columnCount
  const rowEnd = Math.min(rowStart + columnCount - 1, total - 1)
  const lastRow = Math.floor((total - 1) / columnCount)
  const hasPhotoBelow = index + columnCount < total
  const classes: string[] = []
  if (index === 0) classes.push('round-top-left')
  if (row === 0 && index === rowEnd) classes.push('round-top-right')
  if (row === lastRow && index === rowStart) classes.push('round-bottom-left')
  if (index === rowEnd && !hasPhotoBelow) classes.push('round-bottom-right')
  return classes.join(' ')
}

function uniquePeople(...collections: UserSummary[][]) {
  return [...new Map(collections.flat().map((person) => [person.id, person])).values()]
}

function GroupProfileSkeletonBlock({ className = '' }: { className?: string }) {
  return <span className={`profile-skeleton-block${className ? ` ${className}` : ''}`} aria-hidden="true" />
}

function GroupProfileSkeleton() {
  return <main className="profile-destination self-profile-page profile-page-skeleton group-profile-page group-profile-skeleton" aria-busy="true">
    <section className="self-profile-cover-card profile-skeleton-hero">
      <GroupProfileSkeletonBlock className="profile-skeleton-cover" />
      <div className="profile-skeleton-identity">
        <GroupProfileSkeletonBlock className="profile-skeleton-avatar" />
        <div className="profile-skeleton-title-lines"><GroupProfileSkeletonBlock className="profile-skeleton-name" /><GroupProfileSkeletonBlock className="profile-skeleton-meta" /><GroupProfileSkeletonBlock className="profile-skeleton-meta short" /></div>
        <div className="profile-skeleton-actions"><GroupProfileSkeletonBlock /><GroupProfileSkeletonBlock /><GroupProfileSkeletonBlock /></div>
      </div>
      <div className="profile-skeleton-tabs">{Array.from({ length: 4 }, (_, index) => <GroupProfileSkeletonBlock key={index} />)}</div>
    </section>
    <div className="profile-destination-grid self-profile-destination-grid tab-posts profile-skeleton-content group-profile-content-grid">
      <section className="profile-post-list profile-skeleton-posts"><section className="card profile-skeleton-composer"><GroupProfileSkeletonBlock className="avatar" /><GroupProfileSkeletonBlock className="input" /><div>{Array.from({ length: 3 }, (_, index) => <GroupProfileSkeletonBlock key={index} />)}</div></section><section className="card profile-skeleton-tools"><GroupProfileSkeletonBlock className="title" /><div><GroupProfileSkeletonBlock /><GroupProfileSkeletonBlock /></div><footer><GroupProfileSkeletonBlock /><GroupProfileSkeletonBlock /></footer></section>{Array.from({ length: 2 }, (_, index) => <section className="card profile-skeleton-post" key={index}><header><GroupProfileSkeletonBlock className="avatar" /><div><GroupProfileSkeletonBlock /><GroupProfileSkeletonBlock /></div></header><GroupProfileSkeletonBlock className="line" /><GroupProfileSkeletonBlock className="media" /></section>)}</section>
      <aside className="self-profile-left-column profile-skeleton-left"><section className="card profile-skeleton-side-card"><GroupProfileSkeletonBlock className="heading" />{Array.from({ length: 5 }, (_, index) => <GroupProfileSkeletonBlock className="line" key={index} />)}</section><section className="card profile-skeleton-side-card"><GroupProfileSkeletonBlock className="heading" /><div className="profile-skeleton-square-grid">{Array.from({ length: 6 }, (_, index) => <GroupProfileSkeletonBlock key={index} />)}</div></section></aside>
    </div>
  </main>
}

function GroupMemberStack({ people, onNavigate }: { people: UserSummary[]; onNavigate: (path: string) => void }) {
  if (people.length === 0) return null
  return <div className="group-profile-member-stack" aria-label={`${people.length}`}>
    {people.slice(0, 12).map((person, index, visible) => <span className="group-profile-member-avatar" style={{ zIndex: visible.length - index }} key={person.id}><Avatar name={person.displayName} src={person.avatarUrl} size={34} title={person.displayName} onClick={() => onNavigate(`/profile/${person.id}`)} /></span>)}
  </div>
}

function GroupEditModal({ group, onClose, onUpdated }: { group: SocialGroup; onClose: () => void; onUpdated: (group: SocialGroup) => void }) {
  const { t } = useI18n()
  const [name, setName] = useState(group.name)
  const [bio, setBio] = useState(group.bio ?? '')
  const [privacy, setPrivacy] = useState(group.privacy)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const updated = await socialApi.updateGroup(group.id, { name: name.trim(), bio: bio.trim(), privacy })
      if (!updated) throw new Error('Missing group update')
      onUpdated(updated)
      onClose()
    } catch {
      setError(t('updateGroupError'))
    } finally {
      setBusy(false)
    }
  }

  return <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}>
    <form className="modal group-profile-edit-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
      <header className="modal-head"><h2>{t('editGroup')}</h2><button type="button" className="group-profile-modal-close" onClick={onClose} aria-label={t('close')}><Icon name="close" size={21} /></button></header>
      <div className="group-profile-edit-fields">
        <label><span>{t('groupName')}</span><input autoFocus value={name} maxLength={100} onChange={(event) => setName(event.target.value)} /></label>
        <label><span>{t('groupDescription')}</span><textarea rows={5} value={bio} maxLength={2000} onChange={(event) => setBio(event.target.value)} /></label>
        <label><span>{t('privacy')}</span><select value={privacy} onChange={(event) => setPrivacy(Number(event.target.value))}><option value={0}>{t('publicGroup')}</option><option value={1}>{t('privateGroup')}</option></select></label>
        {error && <p className="form-error">{error}</p>}
      </div>
      <footer className="modal-foot"><button type="button" className="btn-soft" onClick={onClose}>{t('cancel')}</button><button type="submit" className="btn-primary" disabled={busy || !name.trim()}>{busy ? t('saving') : t('save')}</button></footer>
    </form>
  </div>
}

function ExistingGroupPhotoPicker({ photos, kind, onClose, onSelect }: { photos: SocialPhoto[]; kind: GroupImageKind; onClose: () => void; onSelect: (photo: SocialPhoto) => void }) {
  const { t } = useI18n()
  return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="modal group-photo-picker" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><header className="modal-head"><div><h2>{kind === 'avatar' ? t('chooseGroupAvatar') : t('chooseGroupCover')}</h2><p>{t('chooseExistingPhoto')}</p></div><button type="button" className="group-profile-modal-close" onClick={onClose}><Icon name="close" size={21} /></button></header><div className="group-photo-picker-grid">{photos.map((photo) => <button type="button" key={`${photo.contentId}-${photo.media.id}`} onClick={() => onSelect(photo)}><img src={photo.media.url} alt="" loading="lazy" /></button>)}</div></section></div>
}

function GroupAboutCard({ group, locale, admin, compact = false, onEdit }: { group: SocialGroup; locale: string; admin: boolean; compact?: boolean; onEdit: () => void }) {
  const { t } = useI18n()
  return <section className={`card self-profile-side-card self-profile-intro-card group-profile-about-card${compact ? ' compact' : ''}`}>
    <header><h2>{t('about')}</h2>{admin && !compact && <button type="button" aria-label={t('edit')} onClick={onEdit}><GroupInfoEditIcon /></button>}</header>
    <p className={group.bio ? 'self-profile-bio group-profile-description' : 'self-profile-bio group-profile-description muted'}>{group.bio || t('noGroupDescription')}</p>
    <div className="self-profile-info-section group-profile-about-details"><div className="self-profile-info-rows group-profile-about-rows"><p className="group-profile-about-row"><PostPrivacyIcon privacy={group.privacy === 0 ? 0 : 2} group size={25} /><span><strong>{group.privacy === 0 ? t('publicGroup') : t('privateGroup')}</strong><small>{group.privacy === 0 ? t('publicGroupVisibility') : t('privateGroupVisibility')}</small></span></p>
      <p className="group-profile-about-row"><Icon name="eye" size={25} /><span><strong>{t('groupVisibleToPeople')}</strong><small>{t('groupVisibleToPeopleDetail')}</small></span></p>
      <p className="group-profile-about-row"><Icon name="clock" size={25} /><span><strong>{t('groupHistory')}</strong><small>{t('groupCreatedOn', { date: groupDate(group.createdAt, locale) })}</small></span></p></div></div>
  </section>
}

function GroupPeoplePreview({ people, count, onNavigate, onOpen }: { people: UserSummary[]; count: number; onNavigate: (path: string) => void; onOpen: () => void }) {
  const { t } = useI18n()
  return <section className="card self-profile-side-card self-profile-friends-card group-profile-preview-card"><header><div><h2>{t('people')}</h2><small>{t('membersCount', { count })}</small></div><button type="button" onClick={onOpen}>{t('viewAllGroupMembers')}</button></header><div className="self-profile-friend-preview">{people.slice(0, 9).map((person) => <button type="button" key={person.id} onClick={() => onNavigate(`/profile/${person.id}`)}><Avatar name={person.displayName} src={person.avatarUrl} size={96} /><strong>{person.displayName}</strong></button>)}</div></section>
}

function GroupMediaPreview({ media, hasMore, onOpenTab, onOpenMedia }: { media: SocialPhoto[]; hasMore: boolean; onOpenTab: () => void; onOpenMedia: (item: SocialPhoto) => void }) {
  const { t } = useI18n()
  const photos = media.filter((item) => item.media.type === 0)
  const previewPhotos = photos.slice(0, 9)
  return <section className="card self-profile-side-card self-profile-photos-card group-profile-preview-card group-profile-media-preview"><header><div><h2>{t('mediaFiles')}</h2><small>{t(hasMore ? 'profilePhotoStatMore' : 'profilePhotoStat', { count: photos.length })}</small></div><button type="button" onClick={onOpenTab}>{t('profileSeeAllPhotos')}</button></header><div className="self-profile-photo-preview">{previewPhotos.map((item, index) => <button type="button" className={groupPhotoPreviewCornerClass(index, previewPhotos.length)} key={`${item.contentId}-${item.media.id}`} onClick={() => onOpenMedia(item)}><img src={item.media.url} alt="" loading="lazy" /></button>)}</div></section>
}

function GroupInfoEditIcon() {
  return <svg className="self-profile-info-edit-icon" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m4.2 19.8 1.05-4.15L15.7 5.2a2.05 2.05 0 0 1 2.9 0l.2.2a2.05 2.05 0 0 1 0 2.9L8.35 18.75 4.2 19.8Z" /><path d="m13.85 7.05 3.1 3.1" /></svg>
}

function GroupCoverCameraIcon() {
  return <svg className="self-profile-cover-camera-icon" width="19" height="19" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8.25 4.1h7.5l1.65 2H20a2.4 2.4 0 0 1 2.4 2.4v9.1A2.4 2.4 0 0 1 20 20H4a2.4 2.4 0 0 1-2.4-2.4V8.5A2.4 2.4 0 0 1 4 6.1h2.6l1.65-2Z" fill="currentColor" /><circle cx="12" cy="13" r="4.7" fill="var(--profile-camera-lens, #fff)" /><circle cx="12" cy="13" r="2.65" fill="currentColor" /></svg>
}

function GroupCoverPhotoIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="3.25" y="2.75" width="17.5" height="18.5" rx="2.4" /><circle cx="8.25" cy="8" r="1.35" /><path d="m5.6 18 4.2-4.55 2.7 2.55 2.45-2.75 3.45 4.75" /></svg>
}

function GroupCoverUploadIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 15V3m0 0L7.8 7.25M12 3l4.2 4.25" /><path d="M4 14.5v4.25A2.25 2.25 0 0 0 6.25 21h11.5A2.25 2.25 0 0 0 20 18.75V14.5" /></svg>
}

function GroupHeaderChevronIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m7 9.5 5 5 5-5" /></svg>
}

function GroupInvitePlusIcon() {
  return <svg className="self-profile-add-story-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" /></svg>
}

function GroupAdminCrownIcon({ size = 18 }: { size?: number }) {
  return <svg className="group-profile-admin-crown" width={size} height={Math.round(size * .75)} viewBox="0 0 24 18" fill="currentColor" stroke="currentColor" aria-hidden="true" focusable="false"><path d="M3 6.3Q3.1 5.7 3.8 6.2l3.8 2.6 3.7-5.1q.6-.9 1.2 0l3.9 5.1 3.9-2.6q.8-.5.6.6l-1.6 7.3q-.1.7-.9.7H5.4q-.8 0-.9-.7L3 6.3Z" /><path d="M5.2 15.1Q5.2 14.6 5.8 14.6h12.4q.6 0 .6.5v1q0 .5-.6.5H5.8q-.6 0-.6-.5v-1Z" /></svg>
}

function GroupPostFilterIcon() {
  return <svg className="profile-post-filter-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M3.5 7h7.9M16.6 7h3.9M3.5 17h3.9M12.6 17h7.9" /><circle cx="14" cy="7" r="2.3" /><circle cx="10" cy="17" r="2.3" /></svg>
}

function GroupPostManageIcon() {
  return <svg className="profile-post-manage-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path fillRule="evenodd" clipRule="evenodd" d="M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a9.2 9.2 0 0 0-1.69-.98l-.38-2.65A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42l-.38 2.65a9.2 9.2 0 0 0-1.69.98l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65a7.2 7.2 0 0 0 0 1.96l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.12.22.37.31.6.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65a9.2 9.2 0 0 0 1.69-.98l2.49 1c.23.09.48 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65ZM12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" /></svg>
}

function GroupPostViewTools({ filter, view, manageMode, onFilterChange, onViewChange, onManageToggle }: { filter: GroupPostFilter; view: 'list' | 'grid'; manageMode: boolean; onFilterChange: (filter: GroupPostFilter) => void; onViewChange: (view: 'list' | 'grid') => void; onManageToggle: () => void }) {
  const { t } = useI18n()
  return <section className="card self-profile-post-tools group-profile-post-tools">
    <header><h2>{t('postsLabel')}</h2><div><details><summary><GroupPostFilterIcon />{t('profilePostFilters')}</summary><div>{(['all', 'media', 'text'] as GroupPostFilter[]).map((item) => <button type="button" key={item} className={filter === item ? 'active' : ''} onClick={() => onFilterChange(item)}>{t(item === 'all' ? 'profileAllPosts' : item === 'media' ? 'profileMediaPosts' : 'profileTextPosts')}</button>)}</div></details><button type="button" className={manageMode ? 'active' : ''} onClick={onManageToggle}><GroupPostManageIcon />{t(manageMode ? 'done' : 'profileManagePosts')}</button></div></header>
    {manageMode && <p>{t('profileManagePostsHint')}</p>}
    <div className="self-profile-post-view-tabs"><button type="button" className={view === 'list' ? 'active' : ''} onClick={() => onViewChange('list')}><ProfilePostListIcon /><span>{t('profileListView')}</span></button><button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => onViewChange('grid')}><ProfilePostGridIcon /><span>{t('profileGridView')}</span></button></div>
  </section>
}

function GroupPersonCard({ person, currentUserId, isAdmin, viewerIsAdmin, relationship, busy, onNavigate, onRelationshipAction, onGroupAction }: {
  person: UserSummary
  currentUserId: string
  isAdmin: boolean
  viewerIsAdmin: boolean
  relationship: ProfileRelationshipState
  busy: boolean
  onNavigate: (path: string) => void
  onRelationshipAction: (person: UserSummary, action: 'friend' | 'unfriend' | 'follow' | 'unfollow' | 'block') => void
  onGroupAction: (person: UserSummary, action: 'promote' | 'demote' | 'remove') => void
}) {
  const { t } = useI18n()
  const self = person.id === currentUserId
  return <article className="group-profile-person-card">
    <button type="button" className="group-profile-person-link" onClick={() => onNavigate(`/profile/${person.id}`)}><span className="group-profile-person-avatar"><Avatar name={person.displayName} src={person.avatarUrl} size={64} />{isAdmin && <i aria-label={t('groupAdmin')}>♛</i>}</span><span><strong>{person.displayName}<VerifiedBadge verified={person.isVerified} /></strong><small>{isAdmin ? t('groupAdmin') : t('groupMember')}</small></span></button>
    {!self && <div className="group-profile-person-actions">
      {relationship.friendship === 'none' && <button type="button" className="btn-primary sm" disabled={busy} onClick={() => onRelationshipAction(person, 'friend')}><Icon name="userPlus" size={16} />{t('addFriend')}</button>}
      {relationship.friendship === 'outgoing' && <button type="button" className="btn-soft sm" disabled>{t('requestSent')}</button>}
      {relationship.friendship !== 'friend' && !relationship.isFollowing && <button type="button" className="btn-soft sm" disabled={busy} onClick={() => onRelationshipAction(person, 'follow')}>{t('follow')}</button>}
      <details><summary aria-label={t('more')}><Icon name="more" size={18} /></summary><div role="menu"><button type="button" role="menuitem" onClick={() => onNavigate(`/profile/${person.id}`)}><Icon name="user" size={18} />{t('viewProfile')}</button>{relationship.isFollowing && <button type="button" role="menuitem" disabled={busy} onClick={() => onRelationshipAction(person, 'unfollow')}><Icon name="userMinus" size={18} />{t('unfollow')}</button>}{relationship.friendship === 'friend' && <button type="button" role="menuitem" disabled={busy} onClick={() => onRelationshipAction(person, 'unfriend')}><Icon name="userMinus" size={18} />{t('removeFriend')}</button>}{viewerIsAdmin && !isAdmin && <button type="button" role="menuitem" disabled={busy} onClick={() => onGroupAction(person, 'promote')}><Icon name="settings" size={18} />{t('makeAdmin')}</button>}{viewerIsAdmin && isAdmin && <button type="button" role="menuitem" disabled={busy} onClick={() => onGroupAction(person, 'demote')}><Icon name="userMinus" size={18} />{t('removeAdmin')}</button>}{viewerIsAdmin && <button type="button" role="menuitem" className="danger-text" disabled={busy} onClick={() => onGroupAction(person, 'remove')}><Icon name="trash" size={18} />{t('removeMember')}</button>}<button type="button" role="menuitem" className="danger-text" disabled={busy} onClick={() => onRelationshipAction(person, 'block')}><Icon name="block" size={18} />{t('block')}</button></div></details>
    </div>}
  </article>
}

export function GroupProfilePage({ groupId, userId, onBack, onNavigate }: { groupId: string; userId: string; onBack: () => void; onNavigate: (path: string) => void }) {
  const { t, locale } = useI18n()
  const [group, setGroup] = useState<SocialGroup | null>(null)
  const [viewer, setViewer] = useState<SocialProfile | null>(null)
  const [membership, setMembership] = useState<GroupMembershipState>(EMPTY_MEMBERSHIP)
  const [posts, setPosts] = useState<GatewayPost[]>([])
  const [postCursor, setPostCursor] = useState<string | null>(null)
  const [postsHaveMore, setPostsHaveMore] = useState(false)
  const [members, setMembers] = useState<UserSummary[]>([])
  const [admins, setAdmins] = useState<UserSummary[]>([])
  const [friendMemberPreview, setFriendMemberPreview] = useState<UserSummary[]>([])
  const [friends, setFriends] = useState<SocialProfile[]>([])
  const [relationships, setRelationships] = useState<Record<string, ProfileRelationshipState>>({})
  const [requests, setRequests] = useState<SocialProfile[]>([])
  const [media, setMedia] = useState<SocialPhoto[]>([])
  const [mediaCursor, setMediaCursor] = useState<string | null>(null)
  const [mediaHaveMore, setMediaHaveMore] = useState(false)
  const [tab, setTab] = useState<GroupProfileTab>('discussion')
  const [mediaFilter, setMediaFilter] = useState<GroupMediaFilter>('all')
  const [postFilter, setPostFilter] = useState<GroupPostFilter>('all')
  const [postView, setPostView] = useState<'list' | 'grid'>('list')
  const [manageMode, setManageMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [postsLoading, setPostsLoading] = useState(false)
  const [peopleLoading, setPeopleLoading] = useState(false)
  const [mediaLoading, setMediaLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [groupActionMenuAnchor, setGroupActionMenuAnchor] = useState<HTMLElement | null>(null)
  const [imageMenu, setImageMenu] = useState<GroupImageKind | null>(null)
  const [imageCandidates, setImageCandidates] = useState<SocialPhoto[]>([])
  const [existingPicker, setExistingPicker] = useState<GroupImageKind | null>(null)
  const [photoViewer, setPhotoViewer] = useState<GroupMediaViewerState | null>(null)
  const [groupDetailPostId, setGroupDetailPostId] = useState<string | null>(null)
  const coverActionRef = useRef<HTMLDivElement>(null)
  const avatarActionRef = useRef<HTMLDivElement>(null)
  const coverUploadInputRef = useRef<HTMLInputElement>(null)
  const avatarUploadInputRef = useRef<HTMLInputElement>(null)
  const groupPageRef = useRef<HTMLElement>(null)
  const groupContentGridRef = useRef<HTMLDivElement>(null)
  const profileWidthRulerRef = useRef<HTMLElement>(null)
  const groupPostColumnRef = useRef<HTMLElement>(null)
  const groupInfoColumnRef = useRef<HTMLElement>(null)
  const avatarEditor = useInlineImageCrop(groupId)
  const coverEditor = useInlineImageCrop(groupId)
  const coverAmbientColor = useImageAmbientColor(coverEditor.target?.previewUrl ?? group?.backgroundUrl)

  useProfilePageScrollMode()
  useProfileColumnScroll({
    active: tab === 'discussion' && !loading && group != null,
    pageRef: groupPageRef,
    firstColumnRef: groupPostColumnRef,
    secondColumnRef: groupInfoColumnRef,
    resetKey: groupId,
  })

  useLayoutEffect(() => {
    if (loading || !group) return
    const page = groupPageRef.current
    const ruler = profileWidthRulerRef.current
    const grid = page?.querySelector<HTMLElement>('.self-profile-destination-grid') ?? null
    if (!page || !grid || !ruler) return
    let disposed = false
    const alignToUserProfileColumns = () => {
      if (disposed) return
      if (window.innerWidth <= 980) {
        page.style.removeProperty('--self-profile-left-column-width')
        return
      }
      const measuredWidth = ruler.getBoundingClientRect().width || ruler.scrollWidth
      const gridWidth = grid.getBoundingClientRect().width || grid.clientWidth
      if (measuredWidth <= 0 || gridWidth <= 0) return
      const columnGap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0
      const maxWidth = Math.max(0, gridWidth - columnGap - 280)
      page.style.setProperty('--self-profile-left-column-width', `${Math.round(Math.min(measuredWidth, maxWidth) * 100) / 100}px`)
    }
    alignToUserProfileColumns()
    window.addEventListener('resize', alignToUserProfileColumns)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(alignToUserProfileColumns)
    observer?.observe(grid)
    observer?.observe(ruler)
    void document.fonts?.ready.then(alignToUserProfileColumns)
    return () => {
      disposed = true
      window.removeEventListener('resize', alignToUserProfileColumns)
      observer?.disconnect()
      page.style.removeProperty('--self-profile-left-column-width')
    }
  }, [group, loading, locale, tab])

  const allPeople = useMemo(() => uniquePeople(admins, members), [admins, members])
  const adminIds = useMemo(() => new Set(admins.map((person) => person.id)), [admins])
  const memberOnly = useMemo(() => members.filter((person) => !adminIds.has(person.id)), [adminIds, members])
  const eligibleTagPeople = useMemo(() => {
    const participantIds = new Set(allPeople.map((person) => person.id))
    return friends.filter((person) => participantIds.has(person.id))
  }, [allPeople, friends])
  const filteredMedia = useMemo(() => media.filter((item) => mediaFilter === 'all' || (mediaFilter === 'photos' ? item.media.type === 0 : item.media.type === 1)), [media, mediaFilter])
  const filteredPosts = useMemo(() => posts.filter((post) => {
    const hasMedia = post.media.length > 0 || Boolean(post.sharedSource?.media.length)
    return postFilter === 'all' || (postFilter === 'media' ? hasMedia : !hasMedia)
  }), [postFilter, posts])
  const groupPostMonthGroups = useMemo(() => groupProfilePostsByMonth(filteredPosts, locale), [filteredPosts, locale])
  const visiblePeople = useMemo(
    () => group?.privacy !== 0 && !membership.canViewPosts ? friendMemberPreview : allPeople,
    [allPeople, friendMemberPreview, group?.privacy, membership.canViewPosts],
  )

  const loadCore = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [groupValue, membershipValue, viewerValue] = await Promise.all([
        socialApi.getGroup(groupId),
        socialApi.getGroupMembershipState(userId, groupId),
        socialApi.getProfile(userId),
      ])
      setGroup(groupValue)
      setMembership(membershipValue)
      setViewer(viewerValue)
      if (groupValue && (membershipValue.isMember || membershipValue.isAdmin)) {
        void socialApi.recordGroupVisit(userId, groupId).catch(() => undefined)
      }
    } catch {
      setError(t('groupsLoadError'))
    } finally {
      setLoading(false)
    }
  }, [groupId, t, userId])

  const loadPosts = useCallback(async (cursor: string | null = null, append = false) => {
    if (!membership.canViewPosts) {
      setPosts([])
      setPostCursor(null)
      setPostsHaveMore(false)
      return
    }
    setPostsLoading(true)
    try {
      const page = await socialApi.getGroupPosts(groupId, 20, cursor)
      setPosts((current) => append ? [...current, ...page.items] : page.items)
      setPostCursor(page.endCursor)
      setPostsHaveMore(page.hasNextPage)
    } catch {
      if (!append) setPosts([])
      setError(t('groupPostsLoadError'))
    } finally {
      setPostsLoading(false)
    }
  }, [groupId, membership.canViewPosts, t])

  const loadPeople = useCallback(async () => {
    setPeopleLoading(true)
    try {
      const [memberPage, adminPage, friendProfiles] = await Promise.all([
        socialApi.getGroupMembers(groupId, 50),
        socialApi.getGroupAdmins(groupId, 50),
        socialApi.getRelationProfiles(userId, 0, 200),
      ])
      setMembers(memberPage.items)
      setAdmins(adminPage.items)
      setFriends(friendProfiles)
      const people = uniquePeople(adminPage.items, memberPage.items)
      const states = await socialApi.getProfileRelationshipStates(userId, people.map((person) => person.id)).catch(() => ({}))
      setRelationships(states)
    } catch {
      setError(t('groupMembersLoadError'))
    } finally {
      setPeopleLoading(false)
    }
  }, [groupId, t, userId])

  const loadRequests = useCallback(async () => {
    if (!membership.isAdmin) {
      setRequests([])
      return
    }
    try { setRequests(await socialApi.getGroupJoinRequests(groupId)) } catch { setError(t('groupRequestsLoadError')) }
  }, [groupId, membership.isAdmin, t])

  const loadMedia = useCallback(async (cursor: string | null = null, append = false) => {
    if (!membership.canViewPosts) {
      setMedia([])
      return
    }
    setMediaLoading(true)
    try {
      const page = await socialApi.getGroupMedia(groupId, 50, cursor).catch(() => socialApi.getGroupPhotos(groupId, 50, cursor))
      setMedia((current) => append ? [...current, ...page.items] : page.items)
      setMediaCursor(page.endCursor)
      setMediaHaveMore(page.hasNextPage)
    } catch {
      if (!append) setMedia([])
      setError(t('profileMediaLoadError'))
    } finally {
      setMediaLoading(false)
    }
  }, [groupId, membership.canViewPosts, t])

  useEffect(() => { void loadCore() }, [loadCore])
  useEffect(() => { void loadPosts() }, [loadPosts])
  useEffect(() => { void loadPeople() }, [loadPeople])
  useEffect(() => {
    setPostFilter('all')
    setPostView('list')
    setManageMode(false)
  }, [groupId])
  useEffect(() => {
    if (!group || group.privacy === 0 || membership.canViewPosts) {
      setFriendMemberPreview([])
      return
    }
    let active = true
    socialApi.getGroupSuggestions(50).then((suggestions) => {
      if (active) setFriendMemberPreview(suggestions.find((item) => item.group.id === group.id)?.friendMembers ?? [])
    }).catch(() => { if (active) setFriendMemberPreview([]) })
    return () => { active = false }
  }, [group, membership.canViewPosts])
  useEffect(() => { void loadRequests() }, [loadRequests])
  useEffect(() => { void loadMedia() }, [loadMedia])
  useEffect(() => setGroupActionMenuAnchor(null), [groupId, membership.isAdmin, membership.isMember])
  useEffect(() => {
    if (!membership.isAdmin) return
    let active = true
    socialApi.getGroupPhotoCandidates(groupId, 50).then((page) => { if (active) setImageCandidates(page.items) }).catch(() => { if (active) setImageCandidates([]) })
    return () => { active = false }
  }, [groupId, membership.isAdmin])
  async function membershipAction(action: 'join' | 'cancel' | 'leave') {
    if (!group) return
    setBusy(true)
    setError(null)
    try {
      const success = action === 'join' ? await socialApi.requestJoinGroup(userId, group.id) : action === 'cancel' ? await socialApi.cancelJoinGroupRequest(userId, group.id) : await socialApi.leaveGroup(userId, group.id)
      if (!success) throw new Error('Rejected')
      if (action === 'join' && group.privacy === 0) setMembership({ isMember: true, isAdmin: false, joinRequestPending: false, canViewPosts: true })
      else if (action === 'join') setMembership((current) => ({ ...current, joinRequestPending: true }))
      else if (action === 'cancel') setMembership((current) => ({ ...current, joinRequestPending: false }))
      else setMembership({ isMember: false, isAdmin: false, joinRequestPending: false, canViewPosts: group.privacy === 0 })
      const [, latestGroup] = await Promise.all([loadPeople(), socialApi.getGroup(group.id).catch(() => null)])
      if (latestGroup) setGroup(latestGroup)
      if (action === 'join' && group.privacy === 0) void socialApi.recordGroupVisit(userId, group.id).catch(() => undefined)
    } catch {
      setError(action === 'leave' ? t('leaveGroupError') : t('joinGroupError'))
    } finally {
      setBusy(false)
    }
  }

  async function shareGroup() {
    if (!group) return
    const url = new URL(`/groups/${group.id}`, window.location.origin).toString()
    try {
      if (navigator.share) await navigator.share({ title: group.name, url })
      else if (navigator.clipboard) await navigator.clipboard.writeText(url)
      else throw new Error('Share API unavailable')
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return
      setError(t('groupShareError'))
    }
  }

  async function deleteOwnedGroup() {
    if (!group || !membership.isAdmin || (group.memberCount ?? allPeople.length) !== 1) return
    setGroupActionMenuAnchor(null)
    if (!window.confirm(t('deleteGroupConfirm', { name: group.name }))) return
    setBusy(true)
    setError(null)
    try {
      if (!await socialApi.deleteGroup(group.id)) throw new Error('Rejected')
      onNavigate('/groups')
    } catch {
      setError(t('deleteGroupError'))
    } finally {
      setBusy(false)
    }
  }

  async function relationshipAction(person: UserSummary, action: 'friend' | 'unfriend' | 'follow' | 'unfollow' | 'block') {
    setBusyUserId(person.id)
    try {
      const success = action === 'friend' ? await socialApi.sendFriendRequest(userId, person.id)
        : action === 'unfriend' ? await socialApi.unfriend(userId, person.id)
          : action === 'follow' ? await socialApi.followUser(userId, person.id)
            : action === 'unfollow' ? await socialApi.unfollowUser(userId, person.id)
              : await socialApi.blockUser(userId, person.id)
      if (!success) throw new Error('Rejected')
      setRelationships((current) => {
        const previous = current[person.id] ?? EMPTY_RELATIONSHIP
        const next = action === 'friend' ? { ...previous, friendship: 'outgoing' as const }
          : action === 'unfriend' ? { ...previous, friendship: 'none' as const }
            : action === 'follow' ? { ...previous, isFollowing: true }
              : action === 'unfollow' ? { ...previous, isFollowing: false }
                : { ...EMPTY_RELATIONSHIP, isBlocked: true }
        return { ...current, [person.id]: next }
      })
    } catch {
      setError(t('genericError'))
    } finally {
      setBusyUserId(null)
    }
  }

  async function groupPersonAction(person: UserSummary, action: 'promote' | 'demote' | 'remove') {
    setBusyUserId(person.id)
    try {
      const success = action === 'promote' ? await socialApi.addGroupAdmin(groupId, person.id) : action === 'demote' ? await socialApi.removeGroupAdmin(groupId, person.id) : await socialApi.removeGroupMember(groupId, person.id)
      if (!success) throw new Error('Rejected')
      if (action === 'promote') setAdmins((current) => uniquePeople([person], current))
      else if (action === 'demote') setAdmins((current) => current.filter((item) => item.id !== person.id))
      else {
        setAdmins((current) => current.filter((item) => item.id !== person.id))
        setMembers((current) => current.filter((item) => item.id !== person.id))
      }
      const latest = await socialApi.getGroup(groupId)
      if (latest) setGroup(latest)
    } catch {
      setError(t('groupMemberActionError'))
    } finally {
      setBusyUserId(null)
    }
  }

  async function reviewRequest(profileId: string, approve: boolean) {
    setBusyUserId(profileId)
    try {
      const success = approve ? await socialApi.approveGroupJoinRequest(groupId, profileId) : await socialApi.rejectGroupJoinRequest(groupId, profileId)
      if (!success) throw new Error('Rejected')
      setRequests((current) => current.filter((profile) => profile.id !== profileId))
      if (approve) await loadPeople()
    } catch {
      setError(t('groupRequestActionError'))
    } finally {
      setBusyUserId(null)
    }
  }

  function chooseUpload(kind: GroupImageKind, file: File) {
    setImageMenu(null)
    setExistingPicker(null)
    if (kind === 'avatar') {
      coverEditor.cancel()
      avatarEditor.start(file, false)
    } else {
      avatarEditor.cancel()
      coverEditor.start(file, false)
    }
  }

  async function chooseExisting(photo: SocialPhoto, kind: GroupImageKind) {
    try {
      const response = await fetch(photo.media.url, { credentials: 'include' })
      if (!response.ok) throw new Error('Fetch failed')
      const blob = await response.blob()
      const extension = blob.type.split('/')[1] || 'jpg'
      const file = new File([blob], `fakebook-group.${extension}`, { type: blob.type || 'image/jpeg' })
      if (kind === 'avatar') {
        coverEditor.cancel()
        avatarEditor.start(file, true, { contentId: photo.contentId, mediaId: photo.media.id })
      } else {
        avatarEditor.cancel()
        coverEditor.start(file, true, { contentId: photo.contentId, mediaId: photo.media.id })
      }
      setExistingPicker(null)
    } catch {
      setError(t('existingPhotoLoadError'))
    }
  }

  async function saveCroppedImage(kind: GroupImageKind) {
    if (!group) return
    const editor = kind === 'avatar' ? avatarEditor : coverEditor
    const target = editor.target
    if (!target || editor.busy) return
    editor.setBusy(true)
    let uploads: MediaUpload[] = []
    let persisted = false
    try {
      const cropped = await editor.createCroppedFile(kind === 'avatar' ? 1024 : 1600, kind === 'avatar' ? 1 : 16 / 6)
      uploads = await api.uploadMediaFiles(target.fromExisting ? [cropped] : [target.file, cropped])
      const originalUpload = target.fromExisting ? null : uploads[0]
      const croppedUpload = uploads[uploads.length - 1]
      const updated = kind === 'avatar'
        ? await socialApi.changeGroupAvatar(group.id, croppedUpload.url, originalUpload?.url ?? null)
        : await socialApi.changeGroupBackground(group.id, croppedUpload.url, originalUpload?.url ?? null)
      if (!updated) throw new Error('Missing update')
      persisted = true
      setGroup(updated)
      editor.clear()
      await Promise.allSettled([loadPosts(), loadMedia()])
    } catch {
      if (!persisted) await Promise.allSettled(uploads.map((item) => api.cancelPendingMedia(item)))
      setError(t('groupImageUpdateError'))
    } finally {
      editor.setBusy(false)
    }
  }

  if (loading) return <GroupProfileSkeleton />
  if (!group) return <main className="group-profile-page"><div className="card state-card"><h2>{t('groupUnavailable')}</h2><p>{error}</p><button type="button" className="btn-soft" onClick={onBack}>{t('back')}</button></div></main>

  const participant = membership.isMember || membership.isAdmin
  const groupMemberCount = group.memberCount ?? allPeople.length
  const canDeleteGroup = membership.isAdmin && groupMemberCount === 1
  const coverImageUrl = coverEditor.target?.previewUrl ?? group.backgroundUrl
  const coverBackgroundStyle = coverImageUrl ? { backgroundImage: `url(${coverImageUrl})` } : undefined
  const coverAmbientStyle = { '--profile-cover-ambient-color': coverAmbientColor } as CSSProperties
  return <>
    <main ref={groupPageRef} className="profile-destination self-profile-page group-profile-page">
      <section className="profile-cover-card self-profile-cover-card group-profile-hero">
        <div className="self-profile-cover-ambient group-profile-cover-ambient" style={coverAmbientStyle} aria-hidden="true" />
        <div className="self-profile-header-shell group-profile-hero-shell">
          <div className={`profile-cover group-profile-cover${coverEditor.target ? ' is-editing-cover' : ''}`} style={coverEditor.target ? undefined : coverBackgroundStyle}>
            {coverEditor.target && <div
              ref={coverEditor.previewRef}
              className="self-profile-cover-preview"
              role="group"
              aria-label={t('cropBackground')}
              tabIndex={0}
              onPointerDown={coverEditor.beginDrag}
              onPointerMove={coverEditor.moveDrag}
              onPointerUp={coverEditor.endDrag}
              onPointerCancel={coverEditor.endDrag}
              onKeyDown={coverEditor.moveWithKeyboard}
            ><img src={coverEditor.target.previewUrl} alt="" draggable={false} style={coverEditor.imageStyle} onLoad={(event) => coverEditor.onImageLoad(event.currentTarget)} /></div>}
            {membership.isAdmin && <div className={`self-profile-cover-action${coverEditor.target ? ' editing' : ''}`} ref={coverActionRef}>
              {coverEditor.target ? <div className="self-profile-cover-edit-controls">
                <button type="button" className="cover-edit-icon" aria-label={t('storyZoomIn')} disabled={coverEditor.busy || coverEditor.zoom >= 3} onClick={() => coverEditor.changeZoom(.2)}><Icon name="plus" size={17} /></button>
                <button type="button" className="cover-edit-icon" aria-label={t('storyZoomOut')} disabled={coverEditor.busy || coverEditor.zoom <= 1} onClick={() => coverEditor.changeZoom(-.2)}><span aria-hidden="true">−</span></button>
                <button type="button" className="cover-edit-cancel" disabled={coverEditor.busy} onClick={coverEditor.cancel}>{t('cancel')}</button>
                <button type="button" className="cover-edit-confirm" disabled={coverEditor.busy} onClick={() => void saveCroppedImage('background')}><Icon name="check" size={16} />{coverEditor.busy ? t('uploading') : t('confirm')}</button>
              </div> : <button type="button" className="self-profile-edit-cover" aria-haspopup="menu" aria-expanded={imageMenu === 'background'} onClick={() => setImageMenu((current) => current === 'background' ? null : 'background')}><GroupCoverCameraIcon />{group.backgroundUrl ? t('editCoverPhoto') : t('addCoverPhoto')}</button>}
              {!coverEditor.target && imageMenu === 'background' && <AnchoredMenuPortal anchor={coverActionRef.current} className="self-profile-cover-menu" matchAnchorWidth onRequestClose={() => setImageMenu(null)}><button type="button" role="menuitem" onClick={() => { setExistingPicker('background'); setImageMenu(null) }}><GroupCoverPhotoIcon />{t('chooseGroupCover')}</button><button type="button" role="menuitem" onClick={() => { setImageMenu(null); coverUploadInputRef.current?.click() }}><GroupCoverUploadIcon />{t('uploadPhoto')}</button></AnchoredMenuPortal>}
              <input ref={coverUploadInputRef} className="self-profile-cover-file-input group-profile-cover-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) chooseUpload('background', file); event.currentTarget.value = '' }} />
            </div>}
          </div>
          <div className="profile-destination-header group-profile-identity-row">
            <div className={`self-profile-avatar-wrap no-story group-profile-avatar-shell${avatarEditor.target ? ' editing-avatar' : ''}`}>
              {avatarEditor.target ? <div
                ref={avatarEditor.previewRef}
                className="self-profile-avatar-preview"
                role="group"
                aria-label={t('cropAvatar')}
                tabIndex={0}
                onPointerDown={avatarEditor.beginDrag}
                onPointerMove={avatarEditor.moveDrag}
                onPointerUp={avatarEditor.endDrag}
                onPointerCancel={avatarEditor.endDrag}
                onKeyDown={avatarEditor.moveWithKeyboard}
              ><img src={avatarEditor.target.previewUrl} alt="" draggable={false} style={avatarEditor.imageStyle} onLoad={(event) => avatarEditor.onImageLoad(event.currentTarget)} /></div> : <Avatar name={group.name} src={group.avatarUrl} size={156} />}
              {membership.isAdmin && !avatarEditor.target && <div className="self-profile-avatar-action" ref={avatarActionRef}><button type="button" className="self-profile-avatar-camera" aria-label={t('changeGroupAvatar')} aria-haspopup="menu" aria-expanded={imageMenu === 'avatar'} onClick={() => setImageMenu((current) => current === 'avatar' ? null : 'avatar')}><GroupCoverCameraIcon /></button>{imageMenu === 'avatar' && <AnchoredMenuPortal anchor={avatarActionRef.current} align="start" className="self-profile-cover-menu self-profile-avatar-menu" onRequestClose={() => setImageMenu(null)}><button type="button" role="menuitem" onClick={() => { setExistingPicker('avatar'); setImageMenu(null) }}><GroupCoverPhotoIcon />{t('chooseGroupAvatar')}</button><button type="button" role="menuitem" onClick={() => { setImageMenu(null); avatarUploadInputRef.current?.click() }}><GroupCoverUploadIcon />{t('uploadPhoto')}</button></AnchoredMenuPortal>}<input ref={avatarUploadInputRef} className="self-profile-cover-file-input self-profile-avatar-file-input group-profile-avatar-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) chooseUpload('avatar', file); event.currentTarget.value = '' }} /></div>}
            </div>
            <div className="profile-destination-title group-profile-title"><h1>{group.name}</h1><p className="self-profile-summary-line group-profile-summary-line"><PostPrivacyIcon privacy={group.privacy === 0 ? 0 : 2} group size={15} />{group.privacy === 0 ? t('publicGroup') : t('privateGroup')}<i>·</i>{t('membersCount', { count: groupMemberCount })}</p><GroupMemberStack people={visiblePeople} onNavigate={onNavigate} />{membership.isAdmin && avatarEditor.target && <div className="self-profile-cover-edit-controls self-profile-avatar-edit-controls">
              <button type="button" className="cover-edit-icon" aria-label={t('storyZoomIn')} disabled={avatarEditor.busy || avatarEditor.zoom >= 3} onClick={() => avatarEditor.changeZoom(.2)}><Icon name="plus" size={17} /></button>
              <button type="button" className="cover-edit-icon" aria-label={t('storyZoomOut')} disabled={avatarEditor.busy || avatarEditor.zoom <= 1} onClick={() => avatarEditor.changeZoom(-.2)}><span aria-hidden="true">−</span></button>
              <button type="button" className="cover-edit-cancel" disabled={avatarEditor.busy} onClick={avatarEditor.cancel}>{t('cancel')}</button>
              <button type="button" className="cover-edit-confirm" disabled={avatarEditor.busy} onClick={() => void saveCroppedImage('avatar')}><Icon name="check" size={16} />{avatarEditor.busy ? t('uploading') : t('confirm')}</button>
            </div>}</div>
            <div className="self-profile-header-actions group-profile-header-actions">
              {!participant && <button type="button" className={membership.joinRequestPending ? 'btn-soft group-profile-membership-button requested' : 'btn-primary group-profile-membership-button'} disabled={busy} onClick={() => void membershipAction(membership.joinRequestPending ? 'cancel' : 'join')}><GroupMembershipIcon badge={membership.joinRequestPending ? 'arrow' : 'plus'} />{t(membership.joinRequestPending ? 'joinRequested' : 'joinGroupLong')}</button>}
              {!participant && <button type="button" className="btn-soft group-profile-share-button" onClick={() => void shareGroup()}><Icon name="share" size={17} />{t('shareGroupAction')}</button>}
              {participant && <button type="button" className="btn-primary group-profile-invite-button" onClick={() => setInviteOpen(true)}><GroupInvitePlusIcon />{t('invite')}</button>}
              {participant && <button type="button" className="btn-soft group-profile-share-button" onClick={() => void shareGroup()}><Icon name="share" size={17} />{t('shareGroupAction')}</button>}
              {participant && (membership.isAdmin
                ? <button type="button" className="btn-soft group-profile-management-status" aria-label={t('manageGroup')} aria-haspopup="menu" aria-expanded={groupActionMenuAnchor != null} disabled={busy} onClick={(event) => { const anchor = event.currentTarget; setGroupActionMenuAnchor((current) => current ? null : anchor) }}><GroupAdminCrownIcon />{t('manageGroup')}</button>
                : <button type="button" className="btn-soft group-profile-membership-button joined" aria-label={t('joined')}><GroupMembershipIcon badge="check" />{t('joined')}</button>)}
              {participant && membership.isAdmin && groupActionMenuAnchor && <AnchoredMenuPortal anchor={groupActionMenuAnchor} align="start" className="visitor-profile-action-menu group-profile-action-menu" onRequestClose={() => setGroupActionMenuAnchor(null)}>
                <button type="button" role="menuitem" onClick={() => { setGroupActionMenuAnchor(null); setEditOpen(true) }}><Icon name="edit" size={18} />{t('editGroup')}</button>
                <button type="button" role="menuitem" onClick={() => { setGroupActionMenuAnchor(null); setTab('people') }}><GroupMembersIcon className="group-profile-menu-members-icon" size={18} />{t('manageGroupMembers')}</button>
                {!canDeleteGroup && <button type="button" role="menuitem" disabled={busy} onClick={() => { setGroupActionMenuAnchor(null); void membershipAction('leave') }}><Icon name="logout" size={18} />{t('leaveGroup')}</button>}
                {canDeleteGroup && <button type="button" role="menuitem" className="danger" disabled={busy} onClick={() => void deleteOwnedGroup()}><Icon name="trash" size={18} />{t('deleteGroup')}</button>}
              </AnchoredMenuPortal>}
              {participant && <div className="visitor-profile-action-menu-host group-profile-action-menu-host">
                <button type="button" className="btn-soft self-profile-header-chevron" aria-label={t('more')} aria-haspopup={membership.isAdmin ? undefined : 'menu'} aria-expanded={membership.isAdmin ? undefined : groupActionMenuAnchor != null} disabled={busy} onClick={membership.isAdmin ? undefined : (event) => { const anchor = event.currentTarget; setGroupActionMenuAnchor((current) => current ? null : anchor) }}><GroupHeaderChevronIcon /></button>
                {!membership.isAdmin && groupActionMenuAnchor && <AnchoredMenuPortal anchor={groupActionMenuAnchor} className="visitor-profile-action-menu group-profile-action-menu" onRequestClose={() => setGroupActionMenuAnchor(null)}>
                  <button type="button" role="menuitem" disabled={busy} onClick={() => { setGroupActionMenuAnchor(null); void membershipAction('leave') }}><Icon name="logout" size={18} />{t('leaveGroup')}</button>
                </AnchoredMenuPortal>}
              </div>}
            </div>
          </div>
          <nav className="profile-tabs self-profile-tabs group-profile-tabs"><button type="button" className={`self-profile-tab-option${tab === 'discussion' ? ' active' : ''}`} onClick={() => setTab('discussion')}>{t('groupDiscussion')}</button><button type="button" className={`self-profile-tab-option${tab === 'about' ? ' active' : ''}`} onClick={() => setTab('about')}>{t('profileTabAbout')}</button><button type="button" className={`self-profile-tab-option${tab === 'people' ? ' active' : ''}`} onClick={() => setTab('people')}>{t('people')}</button><button type="button" className={`self-profile-tab-option${tab === 'media' ? ' active' : ''}`} onClick={() => setTab('media')}>{t('mediaFiles')}</button><button type="button" className="self-profile-tab-more" aria-label={t('more')} onClick={() => undefined}><Icon name="more" size={20} /></button></nav>
          <nav ref={profileWidthRulerRef} className="profile-tabs self-profile-tabs group-profile-width-ruler" aria-hidden="true"><button type="button" tabIndex={-1} className="self-profile-tab-option">{t('profileTabAll')}</button><button type="button" tabIndex={-1} className="self-profile-tab-option">{t('profileTabAbout')}</button><button type="button" tabIndex={-1} className="self-profile-tab-option">{t('profileTabPhotos')}</button><button type="button" tabIndex={-1} className="self-profile-tab-option">{t('profileTabFriends')}</button><button type="button" tabIndex={-1} className="self-profile-tab-option">{t('profileTabReels')}</button><button type="button" tabIndex={-1} className="self-profile-tab-option">{t('profileTabGroups')}</button></nav>
        </div>
      </section>

      {error && <p className="inline-alert group-profile-alert">{error}</p>}
      {tab === 'discussion' && <div ref={groupContentGridRef} className="profile-destination-grid self-profile-destination-grid tab-posts group-profile-main discussion group-profile-content-grid">
        <section ref={groupPostColumnRef} className="profile-post-list group-profile-post-column">
          {participant && viewer && <PostComposer variant="group" userId={viewer.id} displayName={viewer.displayName} avatarUrl={viewer.avatarUrl} isVerified={viewer.isVerified} friends={eligibleTagPeople} groupId={group.id} groupName={group.name} groupAvatarUrl={group.avatarUrl} groupPrivacy={group.privacy} onCreated={(post) => setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])} />}
          <GroupPostViewTools filter={postFilter} view={postView} manageMode={manageMode} onFilterChange={setPostFilter} onViewChange={setPostView} onManageToggle={() => setManageMode((value) => !value)} />
          {!membership.canViewPosts ? <div className="card state-card"><h2>{t('privateGroup')}</h2><p>{t('joinToSeePosts')}</p></div> : postsLoading && posts.length === 0 ? <div className="card state-card"><span className="spinner" /></div> : posts.length === 0 ? <div className="card state-card"><h2>{t('groupFeedEmpty')}</h2><p>{t('groupFeedEmptyDesc')}</p></div> : filteredPosts.length === 0 ? <div className="card state-card"><h2>{t('profileNoPosts')}</h2><p>{t('groupFeedEmptyDesc')}</p></div> : postView === 'grid' ? <div className="self-profile-post-months">{groupPostMonthGroups.map((month) => <section className="card self-profile-post-month" key={month.id}><h3>{month.label}</h3><div className="self-profile-post-grid">{month.posts.map((post) => <ProfilePostGridCard key={post.id} post={post} locale={locale} groupPrivacy onOpenDetail={() => setGroupDetailPostId(post.id)} onOpenMedia={(item: ProfileGridMediaTarget) => setPhotoViewer({ contentId: item.contentId, media: { id: item.mediaId, type: item.mediaType, url: item.mediaUrl } })} />)}</div></section>)}</div> : filteredPosts.map((post) => <GatewayPostCard key={post.id} post={post} locale={locale} viewerId={userId} onNavigate={onNavigate} groupContextId={group.id} viewerCanModerateGroupPosts={membership.isAdmin} />)}
          {postView === 'list' && postsHaveMore && <button type="button" className="btn-soft group-profile-load-more" disabled={postsLoading || !postCursor} onClick={() => void loadPosts(postCursor, true)}>{postsLoading ? t('loadingMore') : t('seeMore')}</button>}
        </section>
        <aside ref={groupInfoColumnRef} className="self-profile-left-column group-profile-info-column"><GroupAboutCard group={group} locale={locale} admin={membership.isAdmin} compact onEdit={() => setEditOpen(true)} /><GroupPeoplePreview people={visiblePeople} count={groupMemberCount} onNavigate={onNavigate} onOpen={() => setTab('people')} /><GroupMediaPreview media={media} hasMore={mediaHaveMore} onOpenTab={() => setTab('media')} onOpenMedia={(item) => setPhotoViewer(item)} /></aside>
      </div>}

      {tab === 'about' && <div className="profile-destination-grid self-profile-destination-grid tab-about group-profile-main group-profile-feed-width-tab"><section className="profile-post-list group-profile-post-column"><GroupAboutCard group={group} locale={locale} admin={membership.isAdmin} onEdit={() => setEditOpen(true)} /></section></div>}

      {tab === 'people' && <div className={`profile-destination-grid self-profile-destination-grid tab-people group-profile-main people${membership.isAdmin ? ' has-requests' : ''}`}>
        <section className="card group-profile-people-directory"><header><div><h2>{t('people')}</h2><p>{t('groupMemberSummary', { members: group.memberCount ?? allPeople.length, admins: group.adminCount })}</p></div>{membership.isAdmin && <button type="button" className="btn-primary sm" onClick={() => setInviteOpen(true)}><Icon name="userPlus" size={16} />{t('addPeople')}</button>}</header>{peopleLoading ? <div className="state-card"><span className="spinner" /></div> : <><section><h3>{t('groupAdmins')}<span>{admins.length}</span></h3><div className="group-profile-person-grid">{admins.map((person) => <GroupPersonCard key={person.id} person={person} currentUserId={userId} isAdmin viewerIsAdmin={membership.isAdmin} relationship={relationships[person.id] ?? EMPTY_RELATIONSHIP} busy={busyUserId === person.id} onNavigate={onNavigate} onRelationshipAction={(item, action) => void relationshipAction(item, action)} onGroupAction={(item, action) => void groupPersonAction(item, action)} />)}</div></section><section><h3>{t('groupMembers')}<span>{memberOnly.length}</span></h3><div className="group-profile-person-grid">{memberOnly.map((person) => <GroupPersonCard key={person.id} person={person} currentUserId={userId} isAdmin={false} viewerIsAdmin={membership.isAdmin} relationship={relationships[person.id] ?? EMPTY_RELATIONSHIP} busy={busyUserId === person.id} onNavigate={onNavigate} onRelationshipAction={(item, action) => void relationshipAction(item, action)} onGroupAction={(item, action) => void groupPersonAction(item, action)} />)}</div></section></>}
        </section>
        {membership.isAdmin && <aside className="card group-profile-requests"><header><h2>{t('joinRequests')}</h2><span>{requests.length}</span></header>{requests.length === 0 ? <p className="muted">{t('noJoinRequestsDesc')}</p> : requests.map((profile) => <article key={profile.id}><button type="button" onClick={() => onNavigate(`/profile/${profile.id}`)}><Avatar name={profile.displayName} src={profile.avatarUrl} size={48} /><span><strong>{profile.displayName}</strong><small>{t('friendsCount', { count: profile.friendCount })}</small></span></button><div><button type="button" className="btn-primary sm" disabled={busyUserId === profile.id} onClick={() => void reviewRequest(profile.id, true)}>{t('approve')}</button><button type="button" className="btn-soft sm" disabled={busyUserId === profile.id} onClick={() => void reviewRequest(profile.id, false)}>{t('decline')}</button></div></article>)}</aside>}
      </div>}

      {tab === 'media' && <div className="profile-destination-grid self-profile-destination-grid tab-media group-profile-main single"><section className="profile-post-list"><section className="card group-profile-media-tab"><header><div><h2>{t('mediaFiles')}</h2><p>{t('groupMediaCount', { count: filteredMedia.length })}</p></div></header><nav><button type="button" className={mediaFilter === 'all' ? 'active' : ''} onClick={() => setMediaFilter('all')}>{t('profileMediaAll')}</button><button type="button" className={mediaFilter === 'photos' ? 'active' : ''} onClick={() => setMediaFilter('photos')}>{t('photos')}</button><button type="button" className={mediaFilter === 'videos' ? 'active' : ''} onClick={() => setMediaFilter('videos')}>{t('videos')}</button></nav>{!membership.canViewPosts ? <p className="muted">{t('joinToSeePosts')}</p> : mediaLoading && media.length === 0 ? <div className="state-card"><span className="spinner" /></div> : filteredMedia.length === 0 ? <p className="muted group-profile-empty-media">{t('photosEmpty')}</p> : <div className="group-profile-media-grid">{filteredMedia.map((item) => <button type="button" key={`${item.contentId}-${item.media.id}`} onClick={() => setPhotoViewer(item)}>{item.media.type === 1 ? <><video src={item.media.url} muted playsInline preload="metadata" /><span><Icon name="play" size={22} /></span></> : <img src={item.media.url} alt="" loading="lazy" />}</button>)}</div>}{mediaHaveMore && <button type="button" className="btn-soft group-profile-load-more" disabled={mediaLoading || !mediaCursor} onClick={() => void loadMedia(mediaCursor, true)}>{mediaLoading ? t('loadingMore') : t('seeMore')}</button>}</section></section></div>}
    </main>

    {groupDetailPostId && <Suspense fallback={<div className="modal-backdrop content-modal-backdrop shared-detail-loading" role="presentation"><span className="spinner" /></div>}><ContentDetailOverlay viewerId={userId} contentId={groupDetailPostId} onClose={() => setGroupDetailPostId(null)} onNavigate={onNavigate} onOpenImage={(detailPost, item) => {
      if (detailPost.__typename === 'ReelDetail') return
      setPhotoViewer({ contentId: detailPost.id, media: item })
    }} /></Suspense>}
    {editOpen && <GroupEditModal group={group} onClose={() => setEditOpen(false)} onUpdated={setGroup} />}
    {inviteOpen && <GroupInviteModal groupId={group.id} viewerId={userId} excludedIds={new Set(allPeople.map((person) => person.id))} onClose={() => setInviteOpen(false)} />}
    {existingPicker && <ExistingGroupPhotoPicker photos={imageCandidates} kind={existingPicker} onClose={() => setExistingPicker(null)} onSelect={(photo) => void chooseExisting(photo, existingPicker)} />}
    {photoViewer && <Suspense fallback={<div className="modal-backdrop"><span className="spinner" /></div>}><PostPhotoViewer viewerId={userId} contentId={photoViewer.contentId} initialMediaId={photoViewer.media.id} initialMediaUrl={photoViewer.media.url} onClose={() => setPhotoViewer(null)} onNavigate={onNavigate} /></Suspense>}
  </>
}

function GroupInviteModal({ groupId, viewerId, excludedIds, onClose }: { groupId: string; viewerId: string; excludedIds: Set<string>; onClose: () => void }) {
  const { t } = useI18n()
  const [people, setPeople] = useState<SocialProfile[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [invited, setInvited] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    socialApi.getRelationProfiles(viewerId, 0, 200).then((items) => { if (active) setPeople(items.filter((person) => !excludedIds.has(person.id))) }).catch(() => { if (active) setError(t('friendsLoadError')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [excludedIds, t, viewerId])
  const visible = people.filter((person) => person.displayName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0, 50)
  async function invite(person: SocialProfile) {
    setBusyId(person.id)
    try {
      if (!await socialApi.inviteGroupUser(groupId, person.id)) throw new Error('Rejected')
      setInvited((current) => new Set(current).add(person.id))
    } catch {
      setError(t('groupInviteError'))
    } finally {
      setBusyId(null)
    }
  }
  return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="modal group-profile-invite-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><header className="modal-head"><h2>{t('addPeople')}</h2><button type="button" className="group-profile-modal-close" onClick={onClose}><Icon name="close" size={21} /></button></header><label className="group-profile-invite-search"><Icon name="search" size={18} /><input autoFocus value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder={t('searchFriends')} /></label><div className="group-profile-invite-list">{loading ? <span className="spinner" /> : visible.map((person) => <article key={person.id}><Avatar name={person.displayName} src={person.avatarUrl} size={46} /><strong>{person.displayName}</strong><button type="button" className={invited.has(person.id) ? 'btn-soft sm' : 'btn-primary sm'} disabled={busyId === person.id || invited.has(person.id)} onClick={() => void invite(person)}>{invited.has(person.id) ? t('invited') : t('invite')}</button></article>)}</div>{error && <p className="form-error">{error}</p>}<footer className="modal-foot"><button type="button" className="btn-primary" onClick={onClose}>{t('done')}</button></footer></section></div>
}
