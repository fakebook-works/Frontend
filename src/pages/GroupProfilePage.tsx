import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, FormEvent } from 'react'
import { api } from '../api/client'
import type { GatewayPost, SharedPostSource } from '../api/gatewayTypes'
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
const ShareModal = lazy(() => import('../components/ContentActions').then((module) => ({ default: module.ShareModal })))

type GroupProfileTab = 'discussion' | 'about' | 'people' | 'media'
type GroupPeopleSection = 'admins' | 'members' | 'requests'
type GroupMediaFilter = 'all' | 'photos' | 'videos'
type GroupPostFilter = 'all' | 'media' | 'text'
type GroupImageKind = 'avatar' | 'background'
type GroupAboutEditTarget = 'description' | 'privacy' | 'all'

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

function GroupAboutEditIcon() {
  return <svg className="self-profile-info-edit-icon" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M5.15 18.85 6.2 15.5l9.35-9.35a2.02 2.02 0 0 1 2.86 0l.18.18a2.02 2.02 0 0 1 0 2.86l-9.35 9.35-3.38.98" /><path d="m13.9 7.8 3.05 3.05M6.2 15.5l3.04 3.04" /></svg>
}

function GroupDescriptionIcon() {
  return <svg className="self-profile-summary-icon self-profile-bio-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="3.25" y="4.5" width="17.5" height="15" rx="2.75" /><circle cx="8.5" cy="9.75" r="2.05" /><path d="M5.7 15.6c.4-2.05 1.35-3.05 2.8-3.05s2.4 1 2.8 3.05M14 9h3.2M14 13h3.2" /></svg>
}

function GroupAboutSelectChevronIcon() {
  return <svg className="profile-about-select-chevron" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.15" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m7.25 9.5 4.75 4.75 4.75-4.75" /></svg>
}

function GroupAboutOptionCheckIcon() {
  return <svg className="profile-about-option-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m5.5 12.25 4.05 4.05L18.7 7.2" /></svg>
}

function GroupAboutCard({ group, locale, admin, compact = false, onUpdated }: { group: SocialGroup; locale: string; admin: boolean; compact?: boolean; onUpdated: (group: SocialGroup) => void }) {
  const { t } = useI18n()
  const [current, setCurrent] = useState(group)
  const [editTarget, setEditTarget] = useState<GroupAboutEditTarget | null>(null)
  const [descriptionValue, setDescriptionValue] = useState(group.bio ?? '')
  const [privacyValue, setPrivacyValue] = useState(group.privacy)
  const [privacyMenuOpen, setPrivacyMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setCurrent(group)
    setDescriptionValue(group.bio ?? '')
    setPrivacyValue(group.privacy)
    setEditTarget(null)
    setPrivacyMenuOpen(false)
  }, [group])

  function beginEdit(target: GroupAboutEditTarget) {
    setDescriptionValue(current.bio ?? '')
    setPrivacyValue(current.privacy)
    setError(null)
    setPrivacyMenuOpen(false)
    setEditTarget(target)
  }

  function cancelEdit() {
    setDescriptionValue(current.bio ?? '')
    setPrivacyValue(current.privacy)
    setError(null)
    setPrivacyMenuOpen(false)
    setEditTarget(null)
  }

  const changed = descriptionValue.trim() !== (current.bio ?? '').trim() || privacyValue !== current.privacy

  async function saveEdit() {
    if (!changed || busy) return
    setBusy(true)
    setError(null)
    try {
      const updated = await socialApi.updateGroup(current.id, { name: current.name, bio: descriptionValue.trim(), privacy: privacyValue })
      if (!updated) throw new Error('Missing group update')
      setCurrent(updated)
      onUpdated(updated)
      setEditTarget(null)
      setPrivacyMenuOpen(false)
    } catch {
      setError(t('updateGroupError'))
    } finally {
      setBusy(false)
    }
  }

  function editorActions(placement: 'header' | 'inline') {
    return <div className={`profile-about-edit-actions ${placement}`}><span className="profile-about-commit-actions"><button type="button" className="profile-about-cancel" disabled={busy} onClick={cancelEdit}>{t('cancel')}</button><button type="button" className="profile-about-save" disabled={busy || !changed} onClick={() => void saveEdit()}>{busy ? t('saving') : t('save')}</button></span></div>
  }

  function descriptionEditor() {
    const editingAll = editTarget === 'all'
    return <div className={`profile-about-inline-editor${editingAll ? ' editing-all' : ''}`}><textarea autoFocus rows={2} maxLength={2000} value={descriptionValue} onChange={(event) => setDescriptionValue(event.target.value)} aria-label={t('groupDescription')} spellCheck={false} data-gramm="false" data-gramm_editor="false" />{!editingAll && editorActions('inline')}</div>
  }

  function privacyEditor() {
    const editingAll = editTarget === 'all'
    return <div className={`profile-about-inline-editor${editingAll ? ' editing-all' : ''}`}><div className={`profile-about-select-field${privacyMenuOpen ? ' open' : ''}`} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPrivacyMenuOpen(false) }} onKeyDown={(event) => { if (event.key === 'Escape') setPrivacyMenuOpen(false) }}><button type="button" className="profile-about-select-trigger" aria-label={t('privacy')} aria-haspopup="listbox" aria-expanded={privacyMenuOpen} onClick={() => setPrivacyMenuOpen((open) => !open)}><span>{t(privacyValue === 0 ? 'publicGroup' : 'privateGroup')}</span><GroupAboutSelectChevronIcon /></button>{privacyMenuOpen && <div className="profile-about-gender-options" role="listbox" aria-label={t('privacy')}>{([0, 1] as const).map((value) => <button type="button" key={value} role="option" aria-selected={privacyValue === value} onClick={() => { setPrivacyValue(value); setPrivacyMenuOpen(false) }}><span>{t(value === 0 ? 'publicGroup' : 'privateGroup')}</span>{privacyValue === value && <GroupAboutOptionCheckIcon />}</button>)}</div>}</div>{!editingAll && editorActions('inline')}</div>
  }

  const compactDetails = <div className="self-profile-info-section group-profile-about-details"><div className="self-profile-info-rows group-profile-about-rows"><p className="group-profile-about-row"><PostPrivacyIcon privacy={group.privacy === 0 ? 0 : 2} group size={25} /><span><strong>{group.privacy === 0 ? t('publicGroup') : t('privateGroup')}</strong><small>{group.privacy === 0 ? t('publicGroupVisibility') : t('privateGroupVisibility')}</small></span></p>
    <p className="group-profile-about-row"><Icon name="eye" size={25} /><span><strong>{t('groupVisibleToPeople')}</strong><small>{t('groupVisibleToPeopleDetail')}</small></span></p>
    <p className="group-profile-about-row"><Icon name="clock" size={25} /><span><strong>{t('groupHistory')}</strong><small>{t('groupCreatedOn', { date: groupDate(group.createdAt, locale) })}</small></span></p></div></div>
  const description = <p className={group.bio ? 'self-profile-bio group-profile-description profile-preserve-newlines' : 'self-profile-bio group-profile-description profile-preserve-newlines muted'}>{group.bio || t('noGroupDescription')}</p>
  if (compact) return <section className="card self-profile-side-card self-profile-intro-card group-profile-about-card compact"><header><h2>{t('about')}</h2></header>{description}{compactDetails}</section>
  const editingAll = editTarget === 'all'
  return <section className={`card profile-about-panel group-profile-about-card group-profile-about-tab${editTarget ? ' editing' : ''}`}>
    <header className="self-profile-section-head"><h2>{t('profileTabAbout')}</h2>{admin && editTarget === null && <button type="button" className="self-profile-section-action" onClick={() => beginEdit('all')}>{t('edit')}</button>}{admin && editingAll && editorActions('header')}</header>
    <div className="profile-about-details">
      <div className="profile-about-column">
        <article><h3>{t('groupDescription')}</h3>{editTarget === 'description' || editingAll ? descriptionEditor() : <div className="profile-about-detail-value"><span><GroupDescriptionIcon /></span><p className="profile-preserve-newlines">{current.bio || t('noGroupDescription')}</p>{admin && editTarget === null && <button type="button" className="profile-about-detail-edit" aria-label={`${t('edit')} ${t('groupDescription')}`} onClick={() => beginEdit('description')}><GroupAboutEditIcon /></button>}</div>}</article>
        <article><h3>{t('privacy')}</h3>{editTarget === 'privacy' || editingAll ? privacyEditor() : <div className="profile-about-detail-value"><span><PostPrivacyIcon privacy={current.privacy === 0 ? 0 : 2} group size={25} /></span><p>{t(current.privacy === 0 ? 'publicGroup' : 'privateGroup')}</p>{admin && editTarget === null && <button type="button" className="profile-about-detail-edit" aria-label={`${t('edit')} ${t('privacy')}`} onClick={() => beginEdit('privacy')}><GroupAboutEditIcon /></button>}</div>}</article>
      </div>
      <div className="profile-about-column">
        <article><h3>{t('profileJoinDate')}</h3><div className="profile-about-detail-value"><span><Icon name="clock" size={25} /></span><p>{groupDate(current.createdAt, locale)}</p></div></article>
        <article><h3>{t('groupVisibleToPeople')}</h3><div className="profile-about-detail-value"><span><Icon name="eye" size={25} /></span><p>{t(current.privacy === 0 ? 'publicGroupVisibility' : 'privateGroupVisibility')}</p></div></article>
      </div>
    </div>
    {error && <p className="form-error profile-about-error" role="alert">{error}</p>}
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

function GroupProfileTabSearchIcon() {
  return <svg className="self-profile-tab-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="10.35" cy="10.35" r="6.55" /><path d="m15.25 15.25 3.35 3.35" /></svg>
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

function GroupPersonCard({ person, currentUserId, isAdmin, viewerIsAdmin, relationship, busy, selfActions, onNavigate, onRelationshipAction, onGroupAction, onSelfAction }: {
  person: UserSummary
  currentUserId: string
  isAdmin: boolean
  viewerIsAdmin: boolean
  relationship: ProfileRelationshipState
  busy: boolean
  selfActions: { canDemote: boolean; canLeave: boolean; canDelete: boolean }
  onNavigate: (path: string) => void
  onRelationshipAction: (person: UserSummary, action: 'friend' | 'unfriend' | 'follow' | 'unfollow' | 'block') => void
  onGroupAction: (person: UserSummary, action: 'promote' | 'demote' | 'remove') => void
  onSelfAction: (person: UserSummary, action: 'demote' | 'leave' | 'delete') => void
}) {
  const { t } = useI18n()
  const self = person.id === currentUserId
  return <article className="group-profile-person-card">
    <button type="button" className="self-profile-connection-person group-profile-person-link" onClick={() => onNavigate(`/profile/${person.id}`)}><span className="group-profile-person-avatar"><Avatar name={person.displayName} src={person.avatarUrl} size={72} /></span><span><strong><span className="self-profile-result-name-text">{person.displayName}</span><VerifiedBadge verified={person.isVerified} /></strong><small className="group-profile-person-role">{isAdmin && <GroupAdminCrownIcon size={14} />}{isAdmin ? t('groupAdmin') : t('groupMember')}</small></span></button>
    <details className="self-profile-connection-menu group-profile-person-actions"><summary aria-label={t('more')}><Icon name="more" size={18} /></summary><div role="menu">{self ? <>{selfActions.canDemote && <button type="button" role="menuitem" disabled={busy} onClick={() => onSelfAction(person, 'demote')}><Icon name="userMinus" size={18} />{t('removeAdmin')}</button>}{selfActions.canLeave && <button type="button" role="menuitem" disabled={busy} onClick={() => onSelfAction(person, 'leave')}><Icon name="logout" size={18} />{t('leaveGroup')}</button>}{selfActions.canDelete && <button type="button" role="menuitem" className="danger-text" disabled={busy} onClick={() => onSelfAction(person, 'delete')}><Icon name="trash" size={18} />{t('deleteGroup')}</button>}</> : <><button type="button" role="menuitem" onClick={() => onNavigate(`/profile/${person.id}`)}><Icon name="user" size={18} />{t('viewProfile')}</button>{relationship.friendship === 'none' && <button type="button" role="menuitem" disabled={busy} onClick={() => onRelationshipAction(person, 'friend')}><Icon name="userPlus" size={18} />{t('addFriend')}</button>}{relationship.friendship === 'outgoing' && <button type="button" role="menuitem" disabled><Icon name="userPlus" size={18} />{t('requestSent')}</button>}{relationship.friendship === 'friend' && <button type="button" role="menuitem" disabled={busy} onClick={() => onRelationshipAction(person, 'unfriend')}><Icon name="userMinus" size={18} />{t('removeFriend')}</button>}{relationship.isFollowing ? <button type="button" role="menuitem" disabled={busy} onClick={() => onRelationshipAction(person, 'unfollow')}><Icon name="userMinus" size={18} />{t('unfollow')}</button> : relationship.friendship !== 'friend' && <button type="button" role="menuitem" disabled={busy} onClick={() => onRelationshipAction(person, 'follow')}><Icon name="userPlus" size={18} />{t('follow')}</button>}{viewerIsAdmin && !isAdmin && <button type="button" role="menuitem" disabled={busy} onClick={() => onGroupAction(person, 'promote')}><Icon name="settings" size={18} />{t('makeAdmin')}</button>}{viewerIsAdmin && isAdmin && <button type="button" role="menuitem" disabled={busy} onClick={() => onGroupAction(person, 'demote')}><Icon name="userMinus" size={18} />{t('removeAdmin')}</button>}{viewerIsAdmin && <button type="button" role="menuitem" className="danger-text" disabled={busy} onClick={() => onGroupAction(person, 'remove')}><Icon name="trash" size={18} />{t('removeMember')}</button>}<button type="button" role="menuitem" className="danger-text" disabled={busy} onClick={() => onRelationshipAction(person, 'block')}><Icon name="block" size={18} />{t('block')}</button></>}</div></details>
  </article>
}

function GroupRequestCard({ profile, busy, onNavigate, onReview }: { profile: UserSummary; busy: boolean; onNavigate: (path: string) => void; onReview: (approved: boolean) => void }) {
  const { t } = useI18n()
  return <article className="group-profile-request-card">
    <button type="button" className="group-profile-request-avatar" aria-label={profile.displayName} onClick={() => onNavigate(`/profile/${profile.id}`)}><Avatar name={profile.displayName} src={profile.avatarUrl} size={72} /></button>
    <div className="group-profile-request-body">
      <button type="button" className="self-profile-connection-person group-profile-request-person" onClick={() => onNavigate(`/profile/${profile.id}`)}><span><strong><span className="self-profile-result-name-text">{profile.displayName}</span><VerifiedBadge verified={profile.isVerified} /></strong></span></button>
      <div className="group-profile-request-actions"><button type="button" className="btn-primary" disabled={busy} onClick={() => onReview(true)}>{t('approve')}</button><button type="button" className="btn-soft" disabled={busy} onClick={() => onReview(false)}>{t('decline')}</button></div>
    </div>
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
  const [requests, setRequests] = useState<UserSummary[]>([])
  const [media, setMedia] = useState<SocialPhoto[]>([])
  const [mediaCursor, setMediaCursor] = useState<string | null>(null)
  const [mediaHaveMore, setMediaHaveMore] = useState(false)
  const [tab, setTab] = useState<GroupProfileTab>('discussion')
  const [peopleSection, setPeopleSection] = useState<GroupPeopleSection>('admins')
  const [peopleQuery, setPeopleQuery] = useState('')
  const [mediaFilter, setMediaFilter] = useState<GroupMediaFilter>('all')
  const [mediaComposerRequest, setMediaComposerRequest] = useState(0)
  const [postFilter, setPostFilter] = useState<GroupPostFilter>('all')
  const [postView, setPostView] = useState<'list' | 'grid'>('list')
  const [manageMode, setManageMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [postsLoading, setPostsLoading] = useState(false)
  const [peopleLoading, setPeopleLoading] = useState(false)
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [mediaLoading, setMediaLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [shareGroupOpen, setShareGroupOpen] = useState(false)
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
  const peopleSectionItems = useMemo<UserSummary[]>(() => peopleSection === 'admins' ? admins : peopleSection === 'members' ? memberOnly : requests, [admins, memberOnly, peopleSection, requests])
  const filteredPeopleSectionItems = useMemo(() => {
    const normalizedQuery = peopleQuery.trim().toLocaleLowerCase()
    if (!normalizedQuery) return peopleSectionItems
    return peopleSectionItems.filter((person) => person.displayName.toLocaleLowerCase().includes(normalizedQuery) || person.username.toLocaleLowerCase().includes(normalizedQuery))
  }, [peopleQuery, peopleSectionItems])
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
      setRequestsLoading(false)
      return
    }
    setRequestsLoading(true)
    try { setRequests(await socialApi.getGroupJoinRequests(groupId)) } catch { setError(t('groupRequestsLoadError')) } finally { setRequestsLoading(false) }
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
    setPeopleSection('admins')
    setPeopleQuery('')
  }, [groupId])
  useEffect(() => { setPeopleQuery('') }, [peopleSection])
  useEffect(() => {
    if (!membership.isAdmin && peopleSection === 'requests') setPeopleSection('admins')
  }, [membership.isAdmin, peopleSection])
  useEffect(() => {
    if (!group || group.privacy === 0 || membership.canViewPosts) {
      setFriendMemberPreview([])
      return
    }
    let active = true
    socialApi.getGroupFriendMembers(group.id, 12).then((people) => {
      if (active) setFriendMemberPreview(people)
    }).catch(() => { if (active) setFriendMemberPreview([]) })
    return () => { active = false }
  }, [group, membership.canViewPosts])
  useEffect(() => {
    if (tab === 'people' && peopleSection === 'requests') void loadRequests()
  }, [loadRequests, peopleSection, tab])
  useEffect(() => { void loadMedia() }, [loadMedia])
  useEffect(() => setGroupActionMenuAnchor(null), [groupId])
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
      if (action === 'join') setMembership((current) => ({ ...current, joinRequestPending: true }))
      else if (action === 'cancel') setMembership((current) => ({ ...current, joinRequestPending: false }))
      else setMembership({ isMember: false, isAdmin: false, joinRequestPending: false, canViewPosts: group.privacy === 0 })
      const [, latestGroup] = await Promise.all([loadPeople(), socialApi.getGroup(group.id).catch(() => null)])
      if (latestGroup) setGroup(latestGroup)
    } catch {
      setError(action === 'leave' ? t('leaveGroupError') : t('joinGroupError'))
    } finally {
      setBusy(false)
    }
  }

  function shareGroup() { setShareGroupOpen(true) }

  async function deleteOwnedGroup() {
    const knownParticipantCount = group
      ? Math.max(allPeople.length, group.memberCount ?? 0, group.adminCount ?? 0)
      : 0
    if (!group || !membership.isAdmin || knownParticipantCount !== 1) return
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
      else if (action === 'demote') {
        setAdmins((current) => current.filter((item) => item.id !== person.id))
        setMembers((current) => uniquePeople([person], current))
        if (person.id === userId) setMembership((current) => ({ ...current, isAdmin: false, isMember: true }))
      }
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
  const knownParticipantCount = Math.max(allPeople.length, group.memberCount ?? 0, group.adminCount ?? 0)
  const canDeleteGroup = membership.isAdmin && knownParticipantCount === 1
  const selfPeopleActions = {
    canDemote: membership.isAdmin && (group.adminCount ?? admins.length) > 1,
    canLeave: participant && knownParticipantCount > 1,
    canDelete: canDeleteGroup,
  }
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
              {!participant && <button type="button" className="btn-soft group-profile-share-button" onClick={shareGroup}><Icon name="share" size={17} />{t('shareGroupAction')}</button>}
              {participant && <button type="button" className="btn-primary group-profile-invite-button" onClick={() => setInviteOpen(true)}><GroupInvitePlusIcon />{t('invite')}</button>}
              {participant && <button type="button" className="btn-soft group-profile-share-button" onClick={shareGroup}><Icon name="share" size={17} />{t('shareGroupAction')}</button>}
              {participant && (membership.isAdmin
                ? <button type="button" className="btn-soft group-profile-management-status" aria-label={t('manageGroup')} aria-haspopup="menu" aria-expanded={groupActionMenuAnchor != null} disabled={busy} onClick={(event) => { const anchor = event.currentTarget; setGroupActionMenuAnchor((current) => current ? null : anchor) }}><GroupAdminCrownIcon />{t('manageGroup')}</button>
                : <button type="button" className="btn-soft group-profile-membership-button joined" aria-label={t('joined')} aria-haspopup="menu" aria-expanded={groupActionMenuAnchor != null} disabled={busy} onClick={(event) => { const anchor = event.currentTarget; setGroupActionMenuAnchor((current) => current ? null : anchor) }}><GroupMembershipIcon badge="check" />{t('joined')}</button>)}
              {participant && !membership.isAdmin && groupActionMenuAnchor && <AnchoredMenuPortal anchor={groupActionMenuAnchor} align="start" className="visitor-profile-action-menu group-profile-action-menu" onRequestClose={() => setGroupActionMenuAnchor(null)}>
                <button type="button" role="menuitem" disabled={busy} onClick={() => { setGroupActionMenuAnchor(null); void membershipAction('leave') }}><Icon name="logout" size={18} />{t('leaveGroup')}</button>
              </AnchoredMenuPortal>}
              {participant && membership.isAdmin && groupActionMenuAnchor && <AnchoredMenuPortal anchor={groupActionMenuAnchor} align="start" className="visitor-profile-action-menu group-profile-action-menu" onRequestClose={() => setGroupActionMenuAnchor(null)}>
                <button type="button" role="menuitem" onClick={() => { setGroupActionMenuAnchor(null); setEditOpen(true) }}><Icon name="edit" size={18} />{t('editGroup')}</button>
                <button type="button" role="menuitem" onClick={() => { setGroupActionMenuAnchor(null); setTab('people') }}><GroupMembersIcon className="group-profile-menu-members-icon" size={18} />{t('manageGroupMembers')}</button>
                {!canDeleteGroup && <button type="button" role="menuitem" disabled={busy} onClick={() => { setGroupActionMenuAnchor(null); void membershipAction('leave') }}><Icon name="logout" size={18} />{t('leaveGroup')}</button>}
                {canDeleteGroup && <button type="button" role="menuitem" className="danger" disabled={busy} onClick={() => void deleteOwnedGroup()}><Icon name="trash" size={18} />{t('deleteGroup')}</button>}
              </AnchoredMenuPortal>}
              {participant && <div className="visitor-profile-action-menu-host group-profile-action-menu-host">
                <button type="button" className="btn-soft self-profile-header-chevron" aria-label={t('more')} disabled={busy} onClick={() => undefined}><GroupHeaderChevronIcon /></button>
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
        <aside ref={groupInfoColumnRef} className="self-profile-left-column group-profile-info-column"><GroupAboutCard group={group} locale={locale} admin={membership.isAdmin} compact onUpdated={setGroup} /><GroupPeoplePreview people={visiblePeople} count={groupMemberCount} onNavigate={onNavigate} onOpen={() => setTab('people')} /><GroupMediaPreview media={media} hasMore={mediaHaveMore} onOpenTab={() => setTab('media')} onOpenMedia={(item) => setPhotoViewer(item)} /></aside>
      </div>}

      {tab === 'about' && <div className="profile-destination-grid self-profile-destination-grid tab-about"><section className="profile-post-list"><GroupAboutCard group={group} locale={locale} admin={membership.isAdmin} onUpdated={setGroup} /></section></div>}

      {tab === 'people' && <div className="profile-destination-grid self-profile-destination-grid tab-friends"><section className="profile-post-list"><section className="card self-profile-collection-card self-profile-connections-tab group-profile-people-directory">
        <header className="self-profile-collection-head self-profile-section-head"><h2>{t('people')}</h2><div className="self-profile-section-actions"><label className="self-profile-connections-search"><GroupProfileTabSearchIcon /><input value={peopleQuery} onChange={(event) => setPeopleQuery(event.target.value)} placeholder={t('search')} /></label>{participant && <button type="button" className="self-profile-section-action" onClick={() => setInviteOpen(true)}>{t(membership.isAdmin ? 'addPeople' : 'invite')}</button>}</div></header>
        <nav className="self-profile-collection-tabs" aria-label={t('people')}><button type="button" className={peopleSection === 'admins' ? 'active' : ''} onClick={() => setPeopleSection('admins')}>{t('groupAdmins')}</button><button type="button" className={peopleSection === 'members' ? 'active' : ''} onClick={() => setPeopleSection('members')}>{t('groupMembers')}</button>{membership.isAdmin && <button type="button" className={peopleSection === 'requests' ? 'active' : ''} onClick={() => setPeopleSection('requests')}>{t('joinRequests')}</button>}</nav>
        {peopleLoading || (peopleSection === 'requests' && requestsLoading) ? <div className="self-profile-collection-state"><span className="spinner" /></div> : filteredPeopleSectionItems.length === 0 ? <div className="self-profile-collection-state muted">{peopleQuery ? t('noSearchResults') : t(peopleSection === 'requests' ? 'noJoinRequestsDesc' : 'noPeopleToShow')}</div> : <div className="self-profile-connections-grid">{filteredPeopleSectionItems.map((person) => peopleSection === 'requests' ? <GroupRequestCard key={person.id} profile={person} busy={busyUserId === person.id} onNavigate={onNavigate} onReview={(approved) => void reviewRequest(person.id, approved)} /> : <GroupPersonCard key={person.id} person={person} currentUserId={userId} isAdmin={peopleSection === 'admins'} viewerIsAdmin={membership.isAdmin} relationship={relationships[person.id] ?? EMPTY_RELATIONSHIP} busy={busyUserId === person.id} selfActions={selfPeopleActions} onNavigate={onNavigate} onRelationshipAction={(item, action) => void relationshipAction(item, action)} onGroupAction={(item, action) => void groupPersonAction(item, action)} onSelfAction={(item, action) => { if (action === 'demote') void groupPersonAction(item, 'demote'); else if (action === 'leave') void membershipAction('leave'); else void deleteOwnedGroup() }} />)}</div>}
      </section></section></div>}

      {tab === 'media' && <div className="profile-destination-grid self-profile-destination-grid tab-photos"><section className="profile-post-list"><section className="card self-profile-collection-card self-profile-media-tab group-profile-media-tab">
        <header className="self-profile-collection-head self-profile-section-head"><h2>{t('mediaFiles')}</h2>{participant && <button type="button" className="self-profile-section-action" onClick={() => setMediaComposerRequest((request) => request + 1)}>{t('profileAddPhotoVideo')}</button>}</header>
        <nav className="self-profile-collection-tabs" aria-label={t('mediaFiles')}><button type="button" className={mediaFilter === 'all' ? 'active' : ''} onClick={() => setMediaFilter('all')}>{t('profileMediaAll')}</button><button type="button" className={mediaFilter === 'photos' ? 'active' : ''} onClick={() => setMediaFilter('photos')}>{t('photos')}</button><button type="button" className={mediaFilter === 'videos' ? 'active' : ''} onClick={() => setMediaFilter('videos')}>{t('videos')}</button></nav>
        {!membership.canViewPosts ? <div className="self-profile-collection-state muted">{t('joinToSeePosts')}</div> : mediaLoading && media.length === 0 ? <div className="self-profile-collection-state"><span className="spinner" /></div> : filteredMedia.length === 0 ? <div className="self-profile-collection-state muted">{t('photosEmpty')}</div> : <div className="self-profile-media-grid">{filteredMedia.map((item) => <article key={`${item.contentId}-${item.media.id}`}><button type="button" className="self-profile-media-open" onClick={() => setPhotoViewer(item)}>{item.media.type === 1 ? <><video src={item.media.url} muted playsInline preload="metadata" /><span className="self-profile-media-play"><Icon name="play" size={20} /></span></> : <img src={item.media.url} alt="" loading="lazy" />}</button></article>)}</div>}
        {mediaHaveMore && <button type="button" className="btn-soft group-profile-load-more" disabled={mediaLoading || !mediaCursor} onClick={() => void loadMedia(mediaCursor, true)}>{mediaLoading ? t('loadingMore') : t('seeMore')}</button>}
        {participant && viewer && <PostComposer triggerOnly externalOpenRequest={mediaComposerRequest} variant="group" userId={viewer.id} displayName={viewer.displayName} avatarUrl={viewer.avatarUrl} isVerified={viewer.isVerified} friends={eligibleTagPeople} groupId={group.id} groupName={group.name} groupAvatarUrl={group.avatarUrl} groupPrivacy={group.privacy} onCreated={(post) => { setPosts((currentPosts) => [post, ...currentPosts.filter((item) => item.id !== post.id)]); void loadMedia() }} />}
      </section></section></div>}
    </main>

    {groupDetailPostId && <Suspense fallback={<div className="modal-backdrop content-modal-backdrop shared-detail-loading" role="presentation"><span className="spinner" /></div>}><ContentDetailOverlay viewerId={userId} contentId={groupDetailPostId} onClose={() => setGroupDetailPostId(null)} onNavigate={onNavigate} onOpenImage={(detailPost, item) => {
      if (detailPost.__typename === 'ReelDetail') return
      setPhotoViewer({ contentId: detailPost.id, media: item })
    }} /></Suspense>}
    {editOpen && <GroupEditModal group={group} onClose={() => setEditOpen(false)} onUpdated={setGroup} />}
    {inviteOpen && <GroupInviteModal groupId={group.id} viewerId={userId} admin={membership.isAdmin} excludedIds={new Set(allPeople.map((person) => person.id))} onClose={() => setInviteOpen(false)} />}
    {existingPicker && <ExistingGroupPhotoPicker photos={imageCandidates} kind={existingPicker} onClose={() => setExistingPicker(null)} onSelect={(photo) => void chooseExisting(photo, existingPicker)} />}
    {photoViewer && <Suspense fallback={<div className="modal-backdrop"><span className="spinner" /></div>}><PostPhotoViewer viewerId={userId} contentId={photoViewer.contentId} initialMediaId={photoViewer.media.id} initialMediaUrl={photoViewer.media.url} onClose={() => setPhotoViewer(null)} onNavigate={onNavigate} /></Suspense>}
    {shareGroupOpen && <Suspense fallback={<div className="modal-backdrop content-modal-backdrop shared-detail-loading" role="presentation"><span className="spinner" /></div>}><ShareModal viewerId={userId} sourceId={group.id} canReshare allowStory={false} initialPreview={{ id: group.id, isAvailable: true, type: 1, content: null, privacy: group.privacy, create: group.createdAt, author: null, media: [], group: { id: group.id, name: group.name, avatar: group.avatarUrl || '', background: group.backgroundUrl || '', privacy: group.privacy, memberCount: group.memberCount ?? 0, viewerIsMember: participant, joinRequestPending: membership.joinRequestPending } } satisfies SharedPostSource} onClose={() => setShareGroupOpen(false)} onShared={() => undefined} onNavigate={onNavigate} /></Suspense>}
  </>
}

function GroupInviteModal({ groupId, viewerId, admin, excludedIds, onClose }: { groupId: string; viewerId: string; admin: boolean; excludedIds: Set<string>; onClose: () => void }) {
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
  return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="modal group-profile-invite-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><header className="modal-head"><h2>{t(admin ? 'addPeople' : 'invitePeople')}</h2><button type="button" className="group-profile-modal-close" onClick={onClose}><Icon name="close" size={21} /></button></header><label className="group-profile-invite-search"><Icon name="search" size={18} /><input autoFocus value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder={t('searchFriends')} /></label><div className="group-profile-invite-list">{loading ? <span className="spinner" /> : visible.map((person) => <article key={person.id}><Avatar name={person.displayName} src={person.avatarUrl} size={46} /><strong>{person.displayName}</strong><button type="button" className={invited.has(person.id) ? 'btn-soft sm' : 'btn-primary sm'} disabled={busyId === person.id || invited.has(person.id)} onClick={() => void invite(person)}>{invited.has(person.id) ? t('invited') : t('invite')}</button></article>)}</div>{error && <p className="form-error">{error}</p>}<footer className="modal-foot"><button type="button" className="btn-primary" onClick={onClose}>{t('done')}</button></footer></section></div>
}
