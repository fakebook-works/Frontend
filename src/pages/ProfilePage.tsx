import { lazy, Suspense, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { api } from '../api/client'
import { searchLocations, type LocationSuggestion } from '../api/locationSearch'
import type { GatewayPost, GatewayStory, StoryBucket } from '../api/gatewayTypes'
import type { MediaUpload } from '../api/types'
import { socialApi, type ProfileRelationshipState, type SocialContent, type SocialGroup, type SocialPhoto, type SocialProfile } from '../api/social'
import { searchApi } from '../api/search'
import { Avatar } from '../components/Avatar'
import { AnchoredMenuPortal } from '../components/AnchoredMenuPortal'
import { FriendPersonActionGlyph } from '../components/FriendPeopleGlyph'
import { Icon } from '../components/Icon'
import { PostPrivacyIcon } from '../components/PostPrivacyIcon'
import { ProfilePostGridCard, ProfilePostGridIcon, ProfilePostListIcon } from '../components/ProfilePostGrid'
import { SharedStoryMiniPreview } from '../components/SharedStoryMiniPreview'
import { StoryMediaPreview } from '../components/StoryMediaPreview'
import { VerifiedBadge } from '../components/VerifiedBadge'
import type { PostPhotoViewerMediaEntry } from '../components/PostPhotoViewer'
import { useI18n } from '../i18n'
import { cropImageFile } from '../lib/imageCrop'
import { forgetOwnUnseenStory, reconcileOwnUnseenStories, rememberOwnUnseenStory } from '../lib/ownStoryUnseen'
import { decodePostContent } from '../lib/postContent'
import { groupProfilePostsByMonth } from '../lib/profilePostGrid'
import { gatewayReelToSocialContent } from '../lib/reelEntry'
import { contentOverlayHref, reelOverlayHref } from '../lib/overlayRoutes'
import { decodeStoryContent } from '../lib/storyContent'
import { useInlineImageCrop } from '../lib/useInlineImageCrop'
import { useImageAmbientColor } from '../lib/useImageAmbientColor'
import { useProfileColumnScroll } from '../lib/useProfileColumnScroll'
import { GatewayPostCard, PostComposer } from './GatewayHomePage'
import { birthDateBounds, isAllowedBirthDate } from './birthDate'

const StoryViewerPage = lazy(() => import('../components/StoryViewerPage').then((module) => ({ default: module.StoryViewerPage })))
const StoryCreatorModal = lazy(() => import('../components/StoryCreatorModal').then((module) => ({ default: module.StoryCreatorModal })))
const PostPhotoViewer = lazy(() => import('../components/PostPhotoViewer').then((module) => ({ default: module.PostPhotoViewer })))

const EMPTY_RELATIONSHIP: ProfileRelationshipState = {
  friendship: 'none',
  isFollowing: false,
  followsViewer: false,
  isBlocked: false,
  isBlockedBy: false,
}

type ProfileTab = 'posts' | 'about' | 'friends' | 'photos' | 'reels' | 'groups'
type ProfilePostFilter = 'all' | 'media' | 'text'
type ProfilePostView = 'list' | 'grid'

interface CoverEditTarget {
  file: File
  fromExisting: boolean
  previewUrl: string
}

interface CoverPreviewPlacement {
  width: number
  height: number
  shiftX: number
  shiftY: number
  maxShiftX: number
  maxShiftY: number
}

export interface ProfileMediaViewerState {
  contentId: string
  mediaId: string
  mediaUrl: string
  initialPlaybackTime?: number
  initialPost?: GatewayPost
  entries: PostPhotoViewerMediaEntry[]
  unavailableAuthor?: GatewayPost['author']
}

export interface ProfileMediaViewerOpenOptions {
  update?: boolean
}

const UNAVAILABLE_POST_DETAIL_CODES = new Set([
  'FORBIDDEN',
  'NOT_FOUND',
  'CONTENT_NOT_FOUND',
  'POST_NOT_FOUND',
  'CONTENT_UNAVAILABLE',
  'PRIVACY_DENIED',
])

function isUnavailablePostDetailError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { status?: unknown; code?: unknown }
  if (candidate.status === 403 || candidate.status === 404) return true
  return typeof candidate.code === 'string' && UNAVAILABLE_POST_DETAIL_CODES.has(candidate.code.toUpperCase())
}

async function loadAllProfileFeedPosts(userId: string): Promise<GatewayPost[]> {
  const posts: GatewayPost[] = []
  let cursor: string | null = null
  for (let pageIndex = 0; pageIndex < 20; pageIndex++) {
    const page = await socialApi.getProfilePosts(userId, 40, cursor)
    posts.push(...page.items.filter((post) => post.__typename === 'FeedPostDetail'))
    if (!page.hasNextPage || !page.endCursor) break
    cursor = page.endCursor
  }
  return [...new Map(posts.map((post) => [post.id, post])).values()]
}

function buildProfileMediaEntries(posts: GatewayPost[]): PostPhotoViewerMediaEntry[] {
  return posts.flatMap((post) => post.__typename === 'ReelDetail'
    ? []
    : post.media.filter((media) => media.type === 0 || media.type === 1).map((media) => ({ post, media })))
}

function profilePhotoPreviewCornerClass(index: number, total: number) {
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

function clampCoverValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getCoverPreviewPlacement(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
): CoverPreviewPlacement | null {
  if (imageWidth <= 0 || imageHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) return null
  const scale = Math.max(viewportWidth / imageWidth, viewportHeight / imageHeight) * zoom
  const width = imageWidth * scale
  const height = imageHeight * scale
  const maxShiftX = Math.max(0, (width - viewportWidth) / 2)
  const maxShiftY = Math.max(0, (height - viewportHeight) / 2)
  return {
    width,
    height,
    shiftX: -(clampCoverValue(offsetX, -100, 100) / 100) * maxShiftX,
    shiftY: -(clampCoverValue(offsetY, -100, 100) / 100) * maxShiftY,
    maxShiftX,
    maxShiftY,
  }
}

function storyMedia(story: GatewayStory) {
  return story.__typename === 'NormalStory' ? story.media[0] ?? null : story.sharedSource.media
}

function formatProfileBirthDate(value: string | null, locale: string) {
  if (!value) return null
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

type ProfileZodiac = {
  id: 'capricorn' | 'aquarius' | 'pisces' | 'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo' | 'virgo' | 'libra' | 'scorpio' | 'sagittarius'
  symbol: string
}

function getProfileZodiac(value: string | null): ProfileZodiac | null {
  if (!value) return null
  const [, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null

  const signs: Record<ProfileZodiac['id'], ProfileZodiac> = {
    capricorn: { id: 'capricorn', symbol: '♑' },
    aquarius: { id: 'aquarius', symbol: '♒' },
    pisces: { id: 'pisces', symbol: '♓' },
    aries: { id: 'aries', symbol: '♈' },
    taurus: { id: 'taurus', symbol: '♉' },
    gemini: { id: 'gemini', symbol: '♊' },
    cancer: { id: 'cancer', symbol: '♋' },
    leo: { id: 'leo', symbol: '♌' },
    virgo: { id: 'virgo', symbol: '♍' },
    libra: { id: 'libra', symbol: '♎' },
    scorpio: { id: 'scorpio', symbol: '♏' },
    sagittarius: { id: 'sagittarius', symbol: '♐' },
  }
  const monthSigns: Array<[number, ProfileZodiac['id'], ProfileZodiac['id']]> = [
    [19, 'capricorn', 'aquarius'],
    [18, 'aquarius', 'pisces'],
    [20, 'pisces', 'aries'],
    [19, 'aries', 'taurus'],
    [20, 'taurus', 'gemini'],
    [20, 'gemini', 'cancer'],
    [22, 'cancer', 'leo'],
    [22, 'leo', 'virgo'],
    [22, 'virgo', 'libra'],
    [22, 'libra', 'scorpio'],
    [21, 'scorpio', 'sagittarius'],
    [21, 'sagittarius', 'capricorn'],
  ]
  const [lastDay, before, after] = monthSigns[month - 1]
  return signs[day <= lastDay ? before : after]
}

function ProfileSkeletonBlock({ className = '' }: { className?: string }) {
  return <span className={`profile-skeleton-block${className ? ` ${className}` : ''}`} aria-hidden="true" />
}

function ProfilePageSkeleton() {
  const { t } = useI18n()
  return <main className="profile-destination self-profile-page profile-page-skeleton" aria-busy="true" aria-label={t('loading')}>
    <section className="self-profile-cover-card profile-skeleton-hero">
      <ProfileSkeletonBlock className="profile-skeleton-cover" />
      <div className="profile-skeleton-identity">
        <ProfileSkeletonBlock className="profile-skeleton-avatar" />
        <div className="profile-skeleton-title-lines">
          <ProfileSkeletonBlock className="profile-skeleton-name" />
          <ProfileSkeletonBlock className="profile-skeleton-meta" />
          <ProfileSkeletonBlock className="profile-skeleton-meta short" />
        </div>
        <div className="profile-skeleton-actions"><ProfileSkeletonBlock /><ProfileSkeletonBlock /><ProfileSkeletonBlock /></div>
      </div>
      <div className="profile-skeleton-tabs">{Array.from({ length: 7 }, (_, index) => <ProfileSkeletonBlock key={index} />)}</div>
    </section>
    <div className="profile-destination-grid self-profile-destination-grid tab-posts profile-skeleton-content">
      <aside className="self-profile-left-column profile-skeleton-left">
        <section className="card profile-skeleton-side-card"><ProfileSkeletonBlock className="heading" />{Array.from({ length: 5 }, (_, index) => <ProfileSkeletonBlock className="line" key={index} />)}</section>
        <section className="card profile-skeleton-side-card compact"><ProfileSkeletonBlock className="heading" /><ProfileSkeletonBlock className="feature" /></section>
        <section className="card profile-skeleton-side-card"><ProfileSkeletonBlock className="heading" /><div className="profile-skeleton-square-grid">{Array.from({ length: 6 }, (_, index) => <ProfileSkeletonBlock key={index} />)}</div></section>
      </aside>
      <section className="profile-post-list profile-skeleton-posts">
        <section className="card profile-skeleton-composer"><ProfileSkeletonBlock className="avatar" /><ProfileSkeletonBlock className="input" /><div>{Array.from({ length: 3 }, (_, index) => <ProfileSkeletonBlock key={index} />)}</div></section>
        <section className="card profile-skeleton-tools"><ProfileSkeletonBlock className="title" /><div><ProfileSkeletonBlock /><ProfileSkeletonBlock /></div><footer><ProfileSkeletonBlock /><ProfileSkeletonBlock /></footer></section>
        {Array.from({ length: 2 }, (_, index) => <section className="card profile-skeleton-post" key={index}><header><ProfileSkeletonBlock className="avatar" /><div><ProfileSkeletonBlock /><ProfileSkeletonBlock /></div></header><ProfileSkeletonBlock className="line" /><ProfileSkeletonBlock className="media" /></section>)}
      </section>
    </div>
  </main>
}

type ProfileAboutEditableField = 'bio' | 'location' | 'birthDate' | 'gender'
type ProfileAboutEditTarget = ProfileAboutEditableField | 'all'

function ProfileAboutPanel({ profile, canEdit }: { profile: SocialProfile; canEdit: boolean }) {
  const { t, locale } = useI18n()
  const [current, setCurrent] = useState(profile)
  const [editTarget, setEditTarget] = useState<ProfileAboutEditTarget | null>(null)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [location, setLocation] = useState(profile.location ?? '')
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? '')
  const [gender, setGender] = useState(profile.gender === 'male' ? 'male' : 'female')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([])
  const [locationSuggestionsLoading, setLocationSuggestionsLoading] = useState(false)
  const [locationSuggestionsError, setLocationSuggestionsError] = useState(false)
  const [locationQueryTouched, setLocationQueryTouched] = useState(false)
  const [locationActiveIndex, setLocationActiveIndex] = useState(-1)
  const [genderMenuOpen, setGenderMenuOpen] = useState(false)
  const birthDateInputRef = useRef<HTMLInputElement>(null)
  const locationListboxId = useId()
  const dateBounds = useMemo(() => birthDateBounds(), [])

  useEffect(() => {
    setCurrent(profile)
    setBio(profile.bio ?? '')
    setLocation(profile.location ?? '')
    setBirthDate(profile.birthDate ?? '')
    setGender(profile.gender === 'male' ? 'male' : 'female')
    setGenderMenuOpen(false)
    setEditTarget(null)
  }, [profile])

  useEffect(() => {
    if ((editTarget !== 'location' && editTarget !== 'all') || !locationQueryTouched || location.trim().length < 3) {
      setLocationSuggestions([])
      setLocationSuggestionsLoading(false)
      setLocationSuggestionsError(false)
      setLocationActiveIndex(-1)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLocationSuggestionsLoading(true)
      setLocationSuggestionsError(false)
      searchLocations(location, controller.signal).then((items) => {
        if (controller.signal.aborted) return
        setLocationSuggestions(items)
        setLocationActiveIndex(-1)
      }).catch((requestError: unknown) => {
        if (controller.signal.aborted || (requestError instanceof DOMException && requestError.name === 'AbortError')) return
        setLocationSuggestions([])
        setLocationSuggestionsError(true)
      }).finally(() => {
        if (!controller.signal.aborted) setLocationSuggestionsLoading(false)
      })
    }, 380)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [editTarget, location, locationQueryTouched])

  function beginEdit(target: ProfileAboutEditTarget) {
    setBio(current.bio ?? '')
    setLocation(current.location ?? '')
    setBirthDate(current.birthDate ?? '')
    setGender(current.gender === 'male' ? 'male' : 'female')
    setError(null)
    setLocationQueryTouched(false)
    setLocationSuggestions([])
    setLocationSuggestionsError(false)
    setLocationActiveIndex(-1)
    setGenderMenuOpen(false)
    setEditTarget(target)
  }

  function cancel() {
    setEditTarget(null)
    setError(null)
    setBio(current.bio ?? '')
    setLocation(current.location ?? '')
    setBirthDate(current.birthDate ?? '')
    setGender(current.gender === 'male' ? 'male' : 'female')
    setLocationQueryTouched(false)
    setLocationSuggestions([])
    setLocationSuggestionsError(false)
    setLocationActiveIndex(-1)
    setGenderMenuOpen(false)
  }

  function removeValue(target: ProfileAboutEditableField | 'all') {
    if (target === 'all' || target === 'bio') setBio('')
    if (target === 'all' || target === 'location') setLocation('')
    if (target === 'all' || target === 'birthDate') setBirthDate('')
  }

  const changed = bio.trim() !== (current.bio ?? '').trim()
    || location.trim() !== (current.location ?? '').trim()
    || birthDate !== (current.birthDate ?? '')
    || gender !== (current.gender === 'male' ? 'male' : 'female')
  const birthDateInvalid = Boolean(birthDate) && !isAllowedBirthDate(birthDate)

  async function save() {
    if (!changed || busy) return
    if (birthDateInvalid) {
      setError(t('birthDateAgeError'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const updated = await socialApi.updateProfile(current.id, {
        name: current.displayName,
        bio: bio.trim(),
        location: location.trim(),
        birthdate: birthDate,
        gender: gender === 'male',
      })
      if (!updated) throw new Error('Missing profile update')
      const merged: SocialProfile = { ...current, ...updated, email: current.email }
      setCurrent(merged)
      setEditTarget(null)
      setGenderMenuOpen(false)
      window.dispatchEvent(new CustomEvent('fakebook:profile-updated', { detail: merged }))
    } catch {
      setError(t('profileUpdateError'))
    } finally {
      setBusy(false)
    }
  }

  const created = current.createdAt && !Number.isNaN(new Date(current.createdAt).getTime())
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(current.createdAt))
    : current.createdAt || t('notAvailable')
  const editingAll = editTarget === 'all'

  function editorActions(target: ProfileAboutEditableField | 'all', placement: 'header' | 'inline') {
    const removable = target === 'bio'
    const removeDisabled = busy || (target === 'bio' && !bio.trim()) || (target === 'location' && !location.trim()) || (target === 'birthDate' && !birthDate) || (target === 'all' && !bio.trim() && !location.trim() && !birthDate)
    return <div className={`profile-about-edit-actions ${placement}`}>
      {removable && <button type="button" className="profile-about-remove" disabled={removeDisabled} onClick={() => removeValue(target)}>{t('remove')}</button>}
      <span className="profile-about-commit-actions"><button type="button" className="profile-about-cancel" disabled={busy} onClick={cancel}>{t('cancel')}</button><button type="button" className="profile-about-save" disabled={busy || !changed || birthDateInvalid} onClick={() => void save()}>{busy ? t('saving') : t('save')}</button></span>
    </div>
  }

  function chooseLocation(suggestion: LocationSuggestion) {
    setLocation(suggestion.value)
    setLocationQueryTouched(false)
    setLocationSuggestions([])
    setLocationActiveIndex(-1)
  }

  function handleLocationKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setLocationQueryTouched(false)
      setLocationSuggestions([])
      setLocationActiveIndex(-1)
      return
    }
    if (locationSuggestions.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setLocationActiveIndex((currentIndex) => event.key === 'ArrowDown'
        ? (currentIndex + 1) % locationSuggestions.length
        : currentIndex <= 0 ? locationSuggestions.length - 1 : currentIndex - 1)
      return
    }
    if (event.key === 'Enter' && locationActiveIndex >= 0) {
      event.preventDefault()
      chooseLocation(locationSuggestions[locationActiveIndex])
    }
  }

  function openBirthDatePicker() {
    const input = birthDateInputRef.current
    if (!input) return
    input.focus()
    try {
      if (typeof input.showPicker === 'function') input.showPicker()
      else input.click()
    } catch {
      input.click()
    }
  }

  function fieldEditor(field: ProfileAboutEditableField) {
    const autoFocus = editTarget === field || (editingAll && field === 'bio')
    const locationPopoverOpen = locationQueryTouched && location.trim().length >= 3
    const hasLocationOptions = locationPopoverOpen && !locationSuggestionsLoading && !locationSuggestionsError && locationSuggestions.length > 0
    const birthDateErrorId = `${locationListboxId}-birth-date-error`
    const control = field === 'bio' ? <textarea autoFocus={autoFocus} rows={2} maxLength={500} value={bio} onChange={(event) => setBio(event.target.value)} aria-label={t('bio')} spellCheck={false} data-gramm="false" data-gramm_editor="false" />
      : field === 'location' ? <div className="profile-about-location-field" onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setLocationQueryTouched(false)
          setLocationSuggestions([])
          setLocationActiveIndex(-1)
        }
      }}><input
          autoFocus={autoFocus}
          role="combobox"
          value={location}
          maxLength={160}
          onChange={(event) => { setLocation(event.target.value); setLocationQueryTouched(true); setLocationActiveIndex(-1) }}
          onFocus={() => { if (location.trim().length >= 3) setLocationQueryTouched(true) }}
          onKeyDown={handleLocationKeyDown}
          aria-label={t('location')}
          aria-autocomplete="list"
          aria-expanded={locationPopoverOpen}
          aria-controls={hasLocationOptions ? locationListboxId : undefined}
          aria-activedescendant={hasLocationOptions && locationActiveIndex >= 0 ? `${locationListboxId}-option-${locationActiveIndex}` : undefined}
          autoComplete="off"
          spellCheck={false}
        />{locationPopoverOpen && <div className="profile-about-location-results">{locationSuggestionsLoading ? <div className="profile-about-location-state" role="status" aria-label={t('loading')}><span className="spinner" /></div> : locationSuggestionsError ? <p role="status">{t('locationSuggestionsError')}</p> : locationSuggestions.length > 0 ? <><div className="profile-about-location-options" id={locationListboxId} role="listbox" aria-label={t('locationSuggestions')}>{locationSuggestions.map((suggestion, index) => <button type="button" id={`${locationListboxId}-option-${index}`} role="option" aria-selected={locationActiveIndex === index} key={suggestion.id} onMouseEnter={() => setLocationActiveIndex(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseLocation(suggestion)}><span><ProfileLocationIcon /></span><span><strong>{suggestion.label}</strong>{suggestion.detail && <small>{suggestion.detail}</small>}</span></button>)}</div><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{t('locationDataAttribution')}</a></> : <p role="status">{t('noLocationSuggestions')}</p>}</div>}</div>
        : field === 'birthDate' ? <div className="profile-about-date-field"><input ref={birthDateInputRef} autoFocus={autoFocus} type="date" min={dateBounds.min} max={dateBounds.max} value={birthDate} onChange={(event) => { setBirthDate(event.target.value); setError(null) }} aria-label={t('birthDate')} aria-invalid={birthDateInvalid || undefined} aria-describedby={birthDateInvalid ? birthDateErrorId : undefined} /><button type="button" className="profile-about-date-trigger" aria-label={t('chooseBirthDate')} onClick={openBirthDatePicker}><ProfileDateInputIcon /></button>{birthDateInvalid && <p id={birthDateErrorId} role="alert">{t('birthDateAgeError')}</p>}</div>
          : <div className={`profile-about-select-field${genderMenuOpen ? ' open' : ''}`} onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setGenderMenuOpen(false)
          }} onKeyDown={(event) => {
            if (event.key === 'Escape') setGenderMenuOpen(false)
          }}><button type="button" className="profile-about-select-trigger" autoFocus={autoFocus} aria-label={t('profileGenderTitle')} aria-haspopup="listbox" aria-expanded={genderMenuOpen} onClick={() => setGenderMenuOpen((open) => !open)}><span>{t(gender === 'male' ? 'genderMale' : 'genderFemale')}</span><ProfileSelectChevronIcon /></button>{genderMenuOpen && <div className="profile-about-gender-options" role="listbox" aria-label={t('profileGenderTitle')}>{(['male', 'female'] as const).map((value) => <button type="button" key={value} role="option" aria-selected={gender === value} onClick={() => { setGender(value); setGenderMenuOpen(false) }}><span>{t(value === 'male' ? 'genderMale' : 'genderFemale')}</span>{gender === value && <ProfileOptionCheckIcon />}</button>)}</div>}</div>
    return <div className={`profile-about-inline-editor${editingAll ? ' editing-all' : ''}`}>
      {control}
      {!editingAll && editorActions(field, 'inline')}
    </div>
  }

  return <section className={`card profile-about-panel${editTarget ? ' editing' : ''}`}>
    <header className="self-profile-section-head"><h2>{t('profileTabAbout')}</h2>{canEdit && editTarget === null && <button type="button" className="self-profile-section-action" onClick={() => beginEdit('all')}>{t('edit')}</button>}{canEdit && editingAll && editorActions('all', 'header')}</header>
    <div className="profile-about-details">
      <div className="profile-about-column">
        <article><h3>{t('bio')}</h3>{editTarget === 'bio' || editingAll ? fieldEditor('bio') : <div className="profile-about-detail-value"><span><ProfileBioIcon /></span><p className="profile-preserve-newlines">{current.bio || t('notAvailable')}</p>{canEdit && editTarget === null && <button type="button" className="profile-about-detail-edit" aria-label={`${t('edit')} ${t('bio')}`} onClick={() => beginEdit('bio')}><ProfileInfoEditIcon /></button>}</div>}</article>
        <article><h3>{t('profileJoinDate')}</h3><div className="profile-about-detail-value"><span><Icon name="clock" size={25} /></span><p>{created}</p></div></article>
        <article><h3>{t('profileContact')}</h3><div className="profile-about-detail-value"><span><ProfileEmailIcon /></span><p>{current.email ? <a className="profile-about-email" href={`mailto:${current.email}`}>{current.email}</a> : t('notAvailable')}</p></div></article>
      </div>
      <div className="profile-about-column">
        <article><h3>{t('location')}</h3>{editTarget === 'location' || editingAll ? fieldEditor('location') : <div className="profile-about-detail-value"><span><ProfileLocationIcon /></span><p>{current.location || t('notAvailable')}</p>{canEdit && editTarget === null && <button type="button" className="profile-about-detail-edit" aria-label={`${t('edit')} ${t('location')}`} onClick={() => beginEdit('location')}><ProfileInfoEditIcon /></button>}</div>}</article>
        <article><h3>{t('birthDate')}</h3>{editTarget === 'birthDate' || editingAll ? fieldEditor('birthDate') : <div className="profile-about-detail-value"><span><ProfileZodiacIcon zodiac={getProfileZodiac(current.birthDate)} /></span><p>{current.birthDate ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${current.birthDate}T00:00:00`)) : t('notAvailable')}</p>{canEdit && editTarget === null && <button type="button" className="profile-about-detail-edit" aria-label={`${t('edit')} ${t('birthDate')}`} onClick={() => beginEdit('birthDate')}><ProfileInfoEditIcon /></button>}</div>}</article>
        <article><h3>{t('profileGenderTitle')}</h3>{editTarget === 'gender' || editingAll ? fieldEditor('gender') : <div className="profile-about-detail-value"><span><ProfileGenderIcon gender={current.gender} /></span><p>{t(current.gender === 'male' ? 'genderMale' : current.gender === 'female' ? 'genderFemale' : current.gender === 'custom' ? 'genderCustom' : 'genderPreferNot')}</p>{canEdit && editTarget === null && <button type="button" className="profile-about-detail-edit" aria-label={`${t('edit')} ${t('profileGenderTitle')}`} onClick={() => beginEdit('gender')}><ProfileInfoEditIcon /></button>}</div>}</article>
      </div>
    </div>
    {error && <p className="form-error profile-about-error" role="alert">{error}</p>}
  </section>
}

export function ProfilePage({ profile, loading, error, canEdit, viewerId, initialTab, embedded = false, onEdit, onNavigate, onOpenReel, onOpenPhoto, onMessage }: { profile: SocialProfile | null; loading: boolean; error: string | null; canEdit: boolean; viewerId: string; initialTab?: ProfileTab; embedded?: boolean; onEdit: () => void; onNavigate: (path: string) => void; onOpenReel?: (ownerId: string, reelId: string, reel?: SocialContent) => void; onOpenPhoto?: (viewer: ProfileMediaViewerState, options?: ProfileMediaViewerOpenOptions) => void; onMessage: (profileId: string) => Promise<void> }) {
  const { t, locale } = useI18n()
  const [posts, setPosts] = useState<GatewayPost[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [postsLoadingMore, setPostsLoadingMore] = useState(false)
  const [postsUnavailable, setPostsUnavailable] = useState(false)
  const [postsMoreError, setPostsMoreError] = useState(false)
  const [postCursor, setPostCursor] = useState<string | null>(null)
  const [postsHaveMore, setPostsHaveMore] = useState(false)
  const [tab, setTab] = useState<ProfileTab>(() => initialTab ?? 'posts')
  const [profileFriends, setProfileFriends] = useState<SocialProfile[]>([])
  const [profileFriendMutualCounts, setProfileFriendMutualCounts] = useState<Record<string, number>>({})
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [photos, setPhotos] = useState<SocialPhoto[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [photosHaveMore, setPhotosHaveMore] = useState(false)
  const [profileGroups, setProfileGroups] = useState<SocialGroup[]>([])
  const [profileManagedGroups, setProfileManagedGroups] = useState<SocialGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupsLoaded, setGroupsLoaded] = useState(false)
  const [groupsUnavailable, setGroupsUnavailable] = useState(false)
  const [myStories, setMyStories] = useState<StoryBucket | null>(null)
  const [homeStoryBuckets, setHomeStoryBuckets] = useState<StoryBucket[]>([])
  const [storyCreatorOpen, setStoryCreatorOpen] = useState(false)
  const [storyViewerOpen, setStoryViewerOpen] = useState(false)
  const [profileMediaViewer, setProfileMediaViewer] = useState<ProfileMediaViewerState | null>(null)
  const [postFilter, setPostFilter] = useState<ProfilePostFilter>('all')
  const [postView, setPostView] = useState<ProfilePostView>('list')
  const [manageMode, setManageMode] = useState(false)
  const [relationship, setRelationship] = useState<ProfileRelationshipState>(EMPTY_RELATIONSHIP)
  const [relationshipLoading, setRelationshipLoading] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [coverMenuOpen, setCoverMenuOpen] = useState(false)
  const [coverPickerOpen, setCoverPickerOpen] = useState(false)
  const [coverCandidates, setCoverCandidates] = useState<SocialPhoto[]>([])
  const [coverCandidatesLoading, setCoverCandidatesLoading] = useState(false)
  const [coverPickerError, setCoverPickerError] = useState<string | null>(null)
  const [coverCropTarget, setCoverCropTarget] = useState<CoverEditTarget | null>(null)
  const [coverZoom, setCoverZoom] = useState(1)
  const [coverOffset, setCoverOffset] = useState({ x: 0, y: 0 })
  const [coverImageSize, setCoverImageSize] = useState({ width: 0, height: 0 })
  const [coverViewportSize, setCoverViewportSize] = useState({ width: 0, height: 0 })
  const [coverSaving, setCoverSaving] = useState(false)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [avatarViewMenuOpen, setAvatarViewMenuOpen] = useState(false)
  const [avatarViewBusy, setAvatarViewBusy] = useState(false)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [avatarCandidates, setAvatarCandidates] = useState<SocialPhoto[]>([])
  const [avatarCandidatesLoading, setAvatarCandidatesLoading] = useState(false)
  const [avatarPickerError, setAvatarPickerError] = useState<string | null>(null)
  const coverActionRef = useRef<HTMLDivElement>(null)
  const coverUploadInputRef = useRef<HTMLInputElement>(null)
  const coverPickerRequestRef = useRef(0)
  const coverPreviewRef = useRef<HTMLDivElement>(null)
  const coverDragRef = useRef<{ pointerId: number; clientX: number; clientY: number; offsetX: number; offsetY: number } | null>(null)
  const coverSavePendingRef = useRef(false)
  const avatarActionRef = useRef<HTMLDivElement>(null)
  const avatarViewMenuRef = useRef<HTMLDivElement>(null)
  const avatarUploadInputRef = useRef<HTMLInputElement>(null)
  const avatarPickerRequestRef = useRef(0)
  const avatarSavePendingRef = useRef(false)
  const locallyViewedStoryIdsRef = useRef<Set<string>>(new Set())
  const avatarEditor = useInlineImageCrop(profile?.id)
  const profilePageRef = useRef<HTMLElement>(null)
  const profileTabsRef = useRef<HTMLElement>(null)
  const profileFirstTabRef = useRef<HTMLButtonElement>(null)
  const profileGroupsTabRef = useRef<HTMLButtonElement>(null)
  const profileContentGridRef = useRef<HTMLDivElement>(null)
  const profileInfoColumnRef = useRef<HTMLElement>(null)
  const profilePostColumnRef = useRef<HTMLElement>(null)
  const profilePostSentinelRef = useRef<HTMLDivElement>(null)
  const publishProfileMediaViewer = (viewer: ProfileMediaViewerState, options?: ProfileMediaViewerOpenOptions) => {
    if (onOpenPhoto) {
      onOpenPhoto(viewer, options)
      return
    }
    setProfileMediaViewer(viewer)
  }
  const postsRequestSequenceRef = useRef(0)
  const postsLoadMoreBusyRef = useRef(false)
  const coverPreviewPlacement = useMemo(() => getCoverPreviewPlacement(
    coverImageSize.width,
    coverImageSize.height,
    coverViewportSize.width,
    coverViewportSize.height,
    coverZoom,
    coverOffset.x,
    coverOffset.y,
  ), [coverImageSize, coverOffset, coverViewportSize, coverZoom])

  useEffect(() => {
    if (embedded) return
    document.documentElement.classList.add('profile-page-scroll')
    document.body.classList.add('profile-page-scroll')
    return () => {
      document.documentElement.classList.remove('profile-page-scroll')
      document.body.classList.remove('profile-page-scroll')
    }
  }, [embedded])

  useProfileColumnScroll({
    active: tab === 'posts' && !loading && profile != null,
    pageRef: profilePageRef,
    firstColumnRef: profileInfoColumnRef,
    secondColumnRef: profilePostColumnRef,
    resetKey: profile?.id ?? '',
  })

  useLayoutEffect(() => {
    if (loading || !profile) return
    const tabs = profileTabsRef.current
    const firstTab = profileFirstTabRef.current
    const groupsTab = profileGroupsTabRef.current
    const grid = profileContentGridRef.current
    if (!tabs || !firstTab || !groupsTab || !grid) return

    let disposed = false
    const alignColumnsToTabs = () => {
      if (disposed) return
      if (window.innerWidth <= 980) {
        grid.style.removeProperty('--self-profile-left-column-width')
        return
      }
      const firstRect = firstTab.getBoundingClientRect()
      const groupsRect = groupsTab.getBoundingClientRect()
      const gridRect = grid.getBoundingClientRect()
      const measuredWidth = groupsRect.right - gridRect.left
      const tabSpan = groupsRect.right - firstRect.left
      if (measuredWidth <= 0 || tabSpan <= 0 || gridRect.width <= 0) return
      const columnGap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0
      const maxWidth = Math.max(0, gridRect.width - columnGap - 280)
      const alignedWidth = Math.min(measuredWidth, maxWidth)
      grid.style.setProperty('--self-profile-left-column-width', `${Math.round(alignedWidth * 100) / 100}px`)
    }

    alignColumnsToTabs()
    window.addEventListener('resize', alignColumnsToTabs)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(alignColumnsToTabs)
    observer?.observe(tabs)
    observer?.observe(firstTab)
    observer?.observe(groupsTab)
    observer?.observe(grid)
    void document.fonts?.ready.then(alignColumnsToTabs)
    return () => {
      disposed = true
      window.removeEventListener('resize', alignColumnsToTabs)
      observer?.disconnect()
      grid.style.removeProperty('--self-profile-left-column-width')
    }
  }, [loading, locale, profile])


  useEffect(() => {
    setTab(initialTab ?? 'posts')
  }, [initialTab, profile?.id])

  useEffect(() => {
    setPostFilter('all')
    setPostView('list')
    setManageMode(false)
    setProfileFriends([])
    setProfileFriendMutualCounts({})
    setPhotos([])
    setProfileGroups([])
    setProfileManagedGroups([])
    setGroupsLoading(false)
    setGroupsLoaded(false)
    setGroupsUnavailable(false)
    setMyStories(null)
    setHomeStoryBuckets([])
    setStoryViewerOpen(false)
    setProfileMediaViewer(null)
    setCoverMenuOpen(false)
    setCoverPickerOpen(false)
    setCoverCandidates([])
    setCoverPickerError(null)
    setCoverCropTarget(null)
    setCoverZoom(1)
    setCoverOffset({ x: 0, y: 0 })
    setCoverImageSize({ width: 0, height: 0 })
    setCoverSaving(false)
    setAvatarMenuOpen(false)
    setAvatarViewMenuOpen(false)
    setAvatarViewBusy(false)
    setAvatarPickerOpen(false)
    setAvatarCandidates([])
    setAvatarPickerError(null)
    coverPickerRequestRef.current += 1
    avatarPickerRequestRef.current += 1
    locallyViewedStoryIdsRef.current = new Set()
  }, [profile?.id])

  useEffect(() => {
    const previewUrl = coverCropTarget?.previewUrl
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [coverCropTarget?.previewUrl])

  useLayoutEffect(() => {
    if (!coverCropTarget || !coverPreviewRef.current) return
    const preview = coverPreviewRef.current
    const updateViewport = () => {
      const bounds = preview.getBoundingClientRect()
      setCoverViewportSize({ width: bounds.width, height: bounds.height })
    }
    updateViewport()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateViewport)
      return () => window.removeEventListener('resize', updateViewport)
    }
    const observer = new ResizeObserver(updateViewport)
    observer.observe(preview)
    return () => observer.disconnect()
  }, [coverCropTarget])

  useEffect(() => {
    if (!coverCropTarget || coverSaving) return
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCoverCropTarget(null)
    }
    document.addEventListener('keydown', cancelOnEscape)
    return () => document.removeEventListener('keydown', cancelOnEscape)
  }, [coverCropTarget, coverSaving])

  const loadProfilePosts = useCallback(async (cursor: string | null = null, append = false) => {
    if (!profile?.id || (append && postsLoadMoreBusyRef.current)) return
    const requestSequence = ++postsRequestSequenceRef.current
    if (append) {
      postsLoadMoreBusyRef.current = true
      setPostsLoadingMore(true)
    } else {
      postsLoadMoreBusyRef.current = false
      setPostsLoading(true)
      setPostCursor(null)
      setPostsHaveMore(false)
    }
    setPostsUnavailable(false)
    setPostsMoreError(false)
    try {
      const page = await socialApi.getProfilePosts(profile.id, 20, cursor)
      if (requestSequence !== postsRequestSequenceRef.current) return
      setPosts((current) => append
        ? [...new Map([...current, ...page.items].map((post) => [post.id, post])).values()]
        : page.items)
      setPostCursor(page.endCursor)
      setPostsHaveMore(page.hasNextPage && Boolean(page.endCursor))
    } catch {
      if (requestSequence !== postsRequestSequenceRef.current) return
      if (append) setPostsMoreError(true)
      else setPostsUnavailable(true)
    } finally {
      if (requestSequence === postsRequestSequenceRef.current) {
        setPostsLoading(false)
        setPostsLoadingMore(false)
        postsLoadMoreBusyRef.current = false
      }
    }
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.id) {
      postsRequestSequenceRef.current += 1
      postsLoadMoreBusyRef.current = false
      setPosts([])
      setPostCursor(null)
      setPostsHaveMore(false)
      return
    }
    void loadProfilePosts()
    return () => {
      postsRequestSequenceRef.current += 1
      postsLoadMoreBusyRef.current = false
    }
  }, [loadProfilePosts, profile?.id])

  useEffect(() => {
    const sentinel = profilePostSentinelRef.current
    if (tab !== 'posts' || !sentinel || postsLoading || postsLoadingMore || postsMoreError || !postsHaveMore || !postCursor || posts.length === 0 || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void loadProfilePosts(postCursor, true)
    }, { rootMargin: '520px 0px', threshold: 0.01 })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadProfilePosts, postCursor, posts.length, postsHaveMore, postsLoading, postsLoadingMore, postsMoreError, tab])

  useEffect(() => {
    if (!profile?.id || canEdit) {
      setRelationship(EMPTY_RELATIONSHIP)
      return
    }
    let active = true
    setRelationshipLoading(true)
    setActionError(null)
    socialApi.getProfileRelationshipState(viewerId, profile.id).then((state) => active && setRelationship(state)).catch(() => active && setActionError(t('relationshipLoadError'))).finally(() => active && setRelationshipLoading(false))
    return () => { active = false }
  }, [canEdit, profile?.id, t, viewerId])

  useEffect(() => {
    if (!profile?.id) return
    let active = true
    setFriendsLoading(true)
    void (async () => {
      try {
        const items = canEdit
          ? await socialApi.getFriendProfilesWithMutualCounts(profile.id, 100)
          : await socialApi.getProfileFriends(profile.id, 100)
        if (!active) return
        setProfileFriends(items.map((item) => item.profile))
        setProfileFriendMutualCounts(Object.fromEntries(items.map((item) => [item.profile.id, item.mutualFriendCount])))
      } catch {
        try {
          if (!canEdit) throw new Error('Target profile friend read failed')
          const fallbackProfiles = await socialApi.getRelationProfiles(profile.id, 0, 100)
          if (!active) return
          setProfileFriends(fallbackProfiles)
          setProfileFriendMutualCounts({})
        } catch {
          if (!active) return
          setProfileFriends([])
          setProfileFriendMutualCounts({})
          setActionError(t('friendsLoadError'))
        }
      } finally {
        if (active) setFriendsLoading(false)
      }
    })()
    return () => { active = false }
  }, [canEdit, profile?.id, t])

  const loadPhotos = useCallback(async (cursor: string | null = null, append = false, limit = 60) => {
    if (!profile?.id) return
    setPhotosLoading(true)
    try {
      const page = await socialApi.getUserPhotos(profile.id, limit, cursor)
      setPhotos((current) => append ? [...current, ...page.items] : page.items)
      setPhotosHaveMore(page.hasNextPage)
    } catch {
      if (!append) setPhotos([])
    } finally {
      setPhotosLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    if (photos.length > 0) return
    void loadPhotos(null, false, 9)
  }, [loadPhotos, photos.length])

  useEffect(() => {
    if (tab !== 'groups' || !profile?.id || groupsLoaded) return
    let active = true
    setGroupsLoading(true)
    setGroupsUnavailable(false)
    Promise.allSettled([
      canEdit ? socialApi.getMemberGroups(profile.id, 60) : socialApi.getProfileMemberGroups(profile.id, 60),
      canEdit ? socialApi.getAdminGroups(profile.id, 60) : socialApi.getProfileAdminGroups(profile.id, 60),
    ]).then(([joinedResult, managedResult]) => {
      if (!active) return
      setProfileGroups(joinedResult.status === 'fulfilled' ? joinedResult.value.items : [])
      setProfileManagedGroups(managedResult.status === 'fulfilled' ? managedResult.value.items : [])
      setGroupsUnavailable(joinedResult.status === 'rejected' && managedResult.status === 'rejected')
      setGroupsLoaded(true)
    }).finally(() => active && setGroupsLoading(false))
    return () => { active = false }
  }, [canEdit, groupsLoaded, profile?.id, tab])

  useEffect(() => {
    if (!canEdit || !profile?.id) {
      setMyStories(null)
      return
    }
    let active = true
    api.myStories(profile.id).then((bucket) => {
      if (!active) return
      if (!bucket) {
        reconcileOwnUnseenStories(profile.id, [])
        setMyStories(null)
        return
      }
      const locallyUnseen = reconcileOwnUnseenStories(profile.id, bucket.stories.map((story) => story.id))
      const unseenCount = Math.max(Number(bucket.unseenCount ?? 0), locallyUnseen.size)
      setMyStories({ ...bucket, hasUnseen: bucket.hasUnseen || unseenCount > 0, unseenCount })
    }).catch(() => active && setMyStories(null))
    return () => { active = false }
  }, [canEdit, profile?.id])

  useEffect(() => {
    const canLoadStories = Boolean(profile?.id) && (canEdit || relationship.friendship === 'friend' || relationship.isFollowing)
    if (!canLoadStories) {
      setHomeStoryBuckets([])
      return
    }
    let active = true
    void (async () => {
      const buckets: StoryBucket[] = []
      let cursor: string | null = null
      for (let pageIndex = 0; pageIndex < 20; pageIndex++) {
        const page = await api.homeStories(viewerId, 50, cursor)
        buckets.push(...page.items)
        if (!page.hasNextPage || !page.endCursor) break
        cursor = page.endCursor
      }
      if (!active) return
      setHomeStoryBuckets([...new Map(buckets.map((bucket) => [bucket.author.id, bucket])).values()])
    })().catch(() => { if (active) setHomeStoryBuckets([]) })
    return () => { active = false }
  }, [canEdit, profile?.id, relationship.friendship, relationship.isFollowing, viewerId])

  const filteredPosts = useMemo(() => posts.filter((post) =>
    post.__typename === 'FeedPostDetail' || post.__typename === 'ReelDetail').filter((post) => {
    const sharedMedia = post.__typename === 'FeedPostDetail' ? post.sharedSource?.media ?? [] : []
    const hasMedia = post.media.length > 0 || sharedMedia.length > 0
    return postFilter === 'all' || (postFilter === 'media' ? hasMedia : !hasMedia)
  }), [postFilter, posts])
  const profilePostMonthGroups = useMemo(() => groupProfilePostsByMonth(filteredPosts, locale), [filteredPosts, locale])

  async function friendAction(action: 'send' | 'cancel' | 'accept' | 'reject' | 'unfriend') {
    if (!profile) return
    setBusyAction(action)
    setActionError(null)
    try {
      const success = action === 'send'
        ? await socialApi.sendFriendRequest(viewerId, profile.id)
        : action === 'cancel'
          ? await socialApi.cancelFriendRequest(viewerId, profile.id)
          : action === 'accept'
            ? await socialApi.acceptFriendRequest(profile.id, viewerId)
            : action === 'reject'
              ? await socialApi.rejectFriendRequest(profile.id, viewerId)
              : await socialApi.unfriend(viewerId, profile.id)
      if (!success) throw new Error('Action rejected')
      setRelationship((current) => ({
        ...current,
        friendship: action === 'send' ? 'outgoing' : action === 'accept' ? 'friend' : 'none',
        isFollowing: action === 'accept' ? false : current.isFollowing,
      }))
    } catch {
      setActionError(t('friendActionError'))
    } finally {
      setBusyAction(null)
    }
  }

  async function followAction() {
    if (!profile) return
    const next = !relationship.isFollowing
    setBusyAction('follow')
    setActionError(null)
    try {
      const success = next
        ? await socialApi.followUser(viewerId, profile.id)
        : await socialApi.unfollowUser(viewerId, profile.id)
      if (!success) throw new Error('Action rejected')
      setRelationship((current) => ({ ...current, isFollowing: next }))
    } catch {
      setActionError(t('followActionError'))
    } finally {
      setBusyAction(null)
    }
  }

  async function messageAction() {
    if (!profile) return
    setBusyAction('message')
    setActionError(null)
    try {
      await onMessage(profile.id)
    } catch {
      setActionError(t('messageActionError'))
    } finally {
      setBusyAction(null)
    }
  }

  async function blockAction() {
    if (!profile) return
    const next = !relationship.isBlocked
    setBusyAction('block')
    setActionError(null)
    try {
      const success = next
        ? await socialApi.blockUser(viewerId, profile.id)
        : await socialApi.unblockUser(viewerId, profile.id)
      if (!success) throw new Error('Action rejected')
      setRelationship((current) => ({
        ...current,
        isBlocked: next,
        friendship: next ? 'none' : current.friendship,
        isFollowing: next ? false : current.isFollowing,
      }))
    } catch {
      setActionError(t('blockActionError'))
    } finally {
      setBusyAction(null)
    }
  }

  function startCoverEdit(file: File, fromExisting: boolean) {
    if (avatarEditor.busy) return
    coverPickerRequestRef.current += 1
    avatarEditor.cancel()
    setCoverMenuOpen(false)
    setCoverPickerOpen(false)
    setCoverZoom(1)
    setCoverOffset({ x: 0, y: 0 })
    setCoverImageSize({ width: 0, height: 0 })
    setActionError(null)
    setCoverCropTarget({ file, fromExisting, previewUrl: URL.createObjectURL(file) })
  }

  function cancelCoverEdit() {
    if (coverSaving) return
    coverDragRef.current = null
    setCoverCropTarget(null)
    setCoverZoom(1)
    setCoverOffset({ x: 0, y: 0 })
    setCoverImageSize({ width: 0, height: 0 })
  }

  function beginCoverDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (coverSaving) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    coverDragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: coverOffset.x,
      offsetY: coverOffset.y,
    }
    event.currentTarget.classList.add('dragging')
  }

  function moveCoverDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = coverDragRef.current
    if (!drag || drag.pointerId !== event.pointerId || !coverPreviewPlacement) return
    const deltaX = event.clientX - drag.clientX
    const deltaY = event.clientY - drag.clientY
    setCoverOffset({
      x: coverPreviewPlacement.maxShiftX > .01
        ? clampCoverValue(drag.offsetX - deltaX / coverPreviewPlacement.maxShiftX * 100, -100, 100)
        : drag.offsetX,
      y: coverPreviewPlacement.maxShiftY > .01
        ? clampCoverValue(drag.offsetY - deltaY / coverPreviewPlacement.maxShiftY * 100, -100, 100)
        : drag.offsetY,
    })
  }

  function endCoverDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (coverDragRef.current?.pointerId !== event.pointerId) return
    coverDragRef.current = null
    event.currentTarget.classList.remove('dragging')
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function moveCoverWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (coverSaving || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const amount = event.shiftKey ? 12 : 4
    setCoverOffset((current) => ({
      x: clampCoverValue(current.x + (event.key === 'ArrowLeft' ? amount : event.key === 'ArrowRight' ? -amount : 0), -100, 100),
      y: clampCoverValue(current.y + (event.key === 'ArrowUp' ? amount : event.key === 'ArrowDown' ? -amount : 0), -100, 100),
    }))
  }

  function changeCoverZoom(delta: number) {
    setCoverZoom((current) => Math.round(clampCoverValue(current + delta, 1, 3) * 100) / 100)
  }

  function startAvatarEdit(file: File, fromExisting: boolean, source: { contentId: string; mediaId: string } | null = null) {
    if (coverSaving) return
    avatarPickerRequestRef.current += 1
    cancelCoverEdit()
    setAvatarMenuOpen(false)
    setAvatarViewMenuOpen(false)
    setAvatarPickerOpen(false)
    setActionError(null)
    avatarEditor.start(file, fromExisting, source)
  }

  async function openAvatarPicker() {
    if (!profile) return
    const requestId = ++avatarPickerRequestRef.current
    setAvatarMenuOpen(false)
    setAvatarViewMenuOpen(false)
    setAvatarPickerOpen(true)
    setAvatarCandidatesLoading(true)
    setAvatarPickerError(null)
    try {
      const page = await socialApi.getMyFeedPhotoCandidates(60)
      if (requestId !== avatarPickerRequestRef.current) return
      setAvatarCandidates(page.items)
    } catch {
      if (requestId !== avatarPickerRequestRef.current) return
      setAvatarCandidates([])
      setAvatarPickerError(t('profileMediaLoadError'))
    } finally {
      if (requestId === avatarPickerRequestRef.current) setAvatarCandidatesLoading(false)
    }
  }

  async function chooseExistingAvatar(photo: SocialPhoto) {
    const requestId = ++avatarPickerRequestRef.current
    setAvatarCandidatesLoading(true)
    setAvatarPickerError(null)
    try {
      const response = await fetch(photo.media.url, { credentials: 'include' })
      if (!response.ok) throw new Error('Could not fetch media')
      const blob = await response.blob()
      if (requestId !== avatarPickerRequestRef.current) return
      const extension = blob.type.split('/')[1] || 'jpg'
      startAvatarEdit(
        new File([blob], `fakebook-avatar.${extension}`, { type: blob.type || 'image/jpeg' }),
        true,
        { contentId: photo.contentId, mediaId: photo.media.id },
      )
    } catch {
      if (requestId === avatarPickerRequestRef.current) setAvatarPickerError(t('existingPhotoLoadError'))
    } finally {
      if (requestId === avatarPickerRequestRef.current) setAvatarCandidatesLoading(false)
    }
  }

  async function openProfileAvatarViewer() {
    if (!profile?.avatarUrl || avatarViewBusy) return
    setAvatarViewMenuOpen(false)
    setAvatarViewBusy(true)
    const standaloneMedia = { id: `profile-avatar-${profile.id}`, type: 0, url: profile.avatarUrl }
    const unavailableAuthor: GatewayPost['author'] = {
      id: profile.id,
      name: profile.displayName,
      avatar: profile.avatarUrl,
      isVerified: Boolean(profile.isVerified),
    }
    const openStandalone = (unavailableContentId?: string) => publishProfileMediaViewer({
      contentId: unavailableContentId ?? `profile-avatar-${profile.id}`,
      mediaId: standaloneMedia.id,
      mediaUrl: standaloneMedia.url,
      entries: [{ post: null, media: standaloneMedia }],
      unavailableAuthor,
    })
    try {
      const source = await socialApi.getProfileAvatarSource(profile.id)
      if (source) {
        let detail: GatewayPost | null
        try {
          detail = await api.postDetail(source.contentId)
        } catch (error) {
          if (isUnavailablePostDetailError(error)) {
            openStandalone(source.contentId)
            return
          }
          openStandalone()
          return
        }
        if (!detail) {
          openStandalone(source.contentId)
          return
        }
        const sourceMedia = detail?.__typename !== 'ReelDetail'
          ? detail?.media.find((media) => media.id === source.mediaId && media.type === 0)
          : null
        if (detail && sourceMedia) {
          const initialEntries = buildProfileMediaEntries([detail])
          const selected = initialEntries.find((entry) => entry.media.id === source.mediaId)
          if (!selected) {
            openStandalone()
            return
          }
          const initialViewer: ProfileMediaViewerState = {
            contentId: detail.id,
            mediaId: selected.media.id,
            mediaUrl: selected.media.url,
            initialPost: detail,
            entries: initialEntries,
          }
          publishProfileMediaViewer(initialViewer)
          void loadAllProfileFeedPosts(profile.id).then((feedPosts) => {
            const entries = buildProfileMediaEntries(feedPosts)
            if (entries.length === 0) return
            if (onOpenPhoto) {
              publishProfileMediaViewer({ ...initialViewer, entries }, { update: true })
              return
            }
            setProfileMediaViewer((current) => current &&
              current.contentId === detail.id &&
              current.mediaId === selected.media.id
              ? { ...current, entries }
              : current)
          }).catch(() => undefined)
          return
        }
      }
      openStandalone(source?.contentId ?? `profile-avatar-${profile.id}`)
    } catch {
      openStandalone()
    } finally {
      setAvatarViewBusy(false)
    }
  }

  async function openProfileMediaViewer(item: { contentId: string; mediaId: string; mediaUrl: string; mediaType: number }, suppliedEntries?: PostPhotoViewerMediaEntry[]) {
    let entries = suppliedEntries ?? []
    if (entries.length === 0) {
      const knownPost = posts.find((post) => post.id === item.contentId && post.__typename !== 'ReelDetail')
      if (knownPost) entries = buildProfileMediaEntries([knownPost])
    }
    const immediateSelection = entries.find((entry) => entry.media.id === item.mediaId || (entry.post?.id === item.contentId && entry.media.url === item.mediaUrl))
    if (immediateSelection) {
      const initialViewer: ProfileMediaViewerState = {
        contentId: immediateSelection.post?.id ?? item.contentId,
        mediaId: immediateSelection.media.id,
        mediaUrl: immediateSelection.media.url,
        initialPost: immediateSelection.post ?? undefined,
        entries,
      }
      publishProfileMediaViewer(initialViewer)
      if (!suppliedEntries?.length && profile) {
        void loadAllProfileFeedPosts(profile.id).then((feedPosts) => {
          const enrichedEntries = buildProfileMediaEntries(feedPosts)
          if (enrichedEntries.length === 0) return
          if (onOpenPhoto) publishProfileMediaViewer({ ...initialViewer, entries: enrichedEntries }, { update: true })
          else setProfileMediaViewer((current) => current && current.contentId === initialViewer.contentId && current.mediaId === initialViewer.mediaId ? { ...current, entries: enrichedEntries } : current)
        }).catch(() => undefined)
      }
      return
    }
    try {
      if (entries.length === 0 && profile) entries = buildProfileMediaEntries(await loadAllProfileFeedPosts(profile.id))
      let selected = entries.find((entry) => entry.media.id === item.mediaId || (entry.post?.id === item.contentId && entry.media.url === item.mediaUrl))
      if (!selected) {
        const detail = await api.postDetail(item.contentId)
        if (detail && detail.__typename !== 'ReelDetail') {
          const detailEntries = buildProfileMediaEntries([detail])
          entries = [...entries.filter((entry) => entry.post?.id !== detail.id), ...detailEntries]
          selected = detailEntries.find((entry) => entry.media.id === item.mediaId || entry.media.url === item.mediaUrl) ?? detailEntries[0]
        }
      }
      if (selected) {
        publishProfileMediaViewer({
          contentId: selected.post?.id ?? item.contentId,
          mediaId: selected.media.id,
          mediaUrl: selected.media.url,
          initialPost: selected.post ?? undefined,
          entries,
        })
        return
      }
    } catch {
      // A visible media URL can still be viewed without inventing post metadata.
    }
    const standaloneMedia = { id: item.mediaId, type: item.mediaType, url: item.mediaUrl }
    publishProfileMediaViewer({
      contentId: item.contentId,
      mediaId: standaloneMedia.id,
      mediaUrl: standaloneMedia.url,
      entries: [{ post: null, media: standaloneMedia }],
    })
  }

  async function saveCroppedAvatar() {
    if (!profile || !avatarEditor.target || avatarEditor.busy || avatarSavePendingRef.current) return
    avatarSavePendingRef.current = true
    const target = avatarEditor.target
    let uploads: MediaUpload[] = []
    let persisted = false
    avatarEditor.setBusy(true)
    setActionError(null)
    try {
      const cropped = await avatarEditor.createCroppedFile(1024, 1)
      uploads = await api.uploadMediaFiles(target.fromExisting ? [cropped] : [target.file, cropped])
      const originalUpload = target.fromExisting ? null : uploads[0]
      const croppedUpload = uploads[uploads.length - 1]
      const updated = target.source
        ? await socialApi.changeUserAvatar(profile.id, croppedUpload.url, originalUpload?.url ?? null, 0, target.source)
        : await socialApi.changeUserAvatar(profile.id, croppedUpload.url, originalUpload?.url ?? null, 0)
      if (!updated) throw new Error('Profile avatar update failed')
      persisted = true
      avatarEditor.clear()
      setActionError(null)
      window.dispatchEvent(new CustomEvent('fakebook:profile-updated', { detail: updated }))
      if (originalUpload) {
        void loadProfilePosts()
      }
    } catch {
      if (!persisted) await Promise.allSettled(uploads.map((item) => api.cancelPendingMedia(item)))
      setActionError(t('imageCropError'))
    } finally {
      avatarSavePendingRef.current = false
      avatarEditor.setBusy(false)
    }
  }

  async function openCoverPicker() {
    if (!profile) return
    const requestId = ++coverPickerRequestRef.current
    setCoverMenuOpen(false)
    setCoverPickerOpen(true)
    setCoverCandidatesLoading(true)
    setCoverPickerError(null)
    try {
      const page = await socialApi.getMyFeedPhotoCandidates(60)
      if (requestId !== coverPickerRequestRef.current) return
      setCoverCandidates(page.items)
    } catch {
      if (requestId !== coverPickerRequestRef.current) return
      setCoverCandidates([])
      setCoverPickerError(t('profileMediaLoadError'))
    } finally {
      if (requestId === coverPickerRequestRef.current) setCoverCandidatesLoading(false)
    }
  }

  async function chooseExistingCover(photo: SocialPhoto) {
    const requestId = ++coverPickerRequestRef.current
    setCoverCandidatesLoading(true)
    setCoverPickerError(null)
    try {
      const response = await fetch(photo.media.url, { credentials: 'include' })
      if (!response.ok) throw new Error('Could not fetch media')
      const blob = await response.blob()
      if (requestId !== coverPickerRequestRef.current) return
      const extension = blob.type.split('/')[1] || 'jpg'
      startCoverEdit(new File([blob], `fakebook-cover.${extension}`, { type: blob.type || 'image/jpeg' }), true)
    } catch {
      if (requestId === coverPickerRequestRef.current) setCoverPickerError(t('existingPhotoLoadError'))
    } finally {
      if (requestId === coverPickerRequestRef.current) setCoverCandidatesLoading(false)
    }
  }

  async function saveCroppedCover() {
    if (!profile || !coverCropTarget || coverSaving || coverSavePendingRef.current) return
    coverSavePendingRef.current = true
    const target = coverCropTarget
    let uploads: MediaUpload[] = []
    let persisted = false
    setCoverSaving(true)
    setActionError(null)
    try {
      const bounds = coverPreviewRef.current?.getBoundingClientRect()
      const aspect = bounds && bounds.width > 0 && bounds.height > 0 ? bounds.width / bounds.height : 16 / 6
      const cropped = await cropImageFile(target.file, aspect, coverZoom, coverOffset.x, coverOffset.y, 1600)
      uploads = await api.uploadMediaFiles(target.fromExisting ? [cropped] : [target.file, cropped])
      const originalUpload = target.fromExisting ? null : uploads[0]
      const croppedUpload = uploads[uploads.length - 1]
      const updated = await socialApi.changeUserBackground(profile.id, croppedUpload.url, originalUpload?.url ?? null, 0)
      if (!updated) throw new Error('Profile cover update failed')
      persisted = true
      setCoverCropTarget(null)
      setActionError(null)
      window.dispatchEvent(new CustomEvent('fakebook:profile-updated', { detail: updated }))
      if (originalUpload) {
        void loadProfilePosts()
      }
    } catch {
      if (!persisted) await Promise.allSettled(uploads.map((item) => api.cancelPendingMedia(item)))
      setActionError(t('imageCropError'))
    } finally {
      coverSavePendingRef.current = false
      coverDragRef.current = null
      setCoverSaving(false)
    }
  }

  const coverAmbientColor = useImageAmbientColor(coverCropTarget?.previewUrl ?? profile?.backgroundUrl)

  if (loading) return <ProfilePageSkeleton />
  if (!profile) return <main className="profile-destination"><div className="card state-card"><h2>{t('profileUnavailable')}</h2><p>{error || t('profileLoadError')}</p></div></main>

  const openReelViewer = (ownerId: string, reelId: string, reel?: SocialContent) => {
    if (onOpenReel) onOpenReel(ownerId, reelId, reel)
    else onNavigate(reelOverlayHref(reelId, 'profile', ownerId))
  }

  const activeProfileId = profile.id
  const canViewProfileStories = canEdit || relationship.friendship === 'friend' || relationship.isFollowing
  const profileStoryBucket = canViewProfileStories
    ? canEdit
      ? myStories
      : homeStoryBuckets.find((bucket) => bucket.author.id === profile.id) ?? null
    : null
  const storyViewerBuckets = profileStoryBucket
    ? [profileStoryBucket, ...homeStoryBuckets.filter((bucket) => bucket.author.id !== profileStoryBucket.author.id)]
    : []
  const storyRingClass = !profileStoryBucket?.stories.length
    ? 'no-story'
    : profileStoryBucket.hasUnseen || Number(profileStoryBucket.unseenCount ?? 0) > 0
      ? 'has-unseen-story'
      : 'has-seen-story'
  const avatarViewMenuAvailable = Boolean(profileStoryBucket?.stories.length || profile.avatarUrl || canEdit)

  function markProfileStoryViewed(storyId: string) {
    if (locallyViewedStoryIdsRef.current.has(storyId)) return
    locallyViewedStoryIdsRef.current = new Set(locallyViewedStoryIdsRef.current).add(storyId)
    if (canEdit) {
      if (!forgetOwnUnseenStory(activeProfileId, storyId)) return
      setMyStories((current) => {
        if (!current?.stories.some((story) => story.id === storyId)) return current
        const unseenCount = Math.max(0, Number(current.unseenCount ?? 0) - 1)
        return { ...current, unseenCount, hasUnseen: unseenCount > 0 }
      })
      return
    }
    setHomeStoryBuckets((current) => current.map((bucket) => {
      if (!bucket.stories.some((story) => story.id === storyId)) return bucket
      const unseenCount = Math.max(0, Number(bucket.unseenCount ?? (bucket.hasUnseen ? bucket.stories.length : 0)) - 1)
      return { ...bucket, unseenCount, hasUnseen: unseenCount > 0 }
    }))
  }

  const coverStyle = profile.backgroundUrl ? { backgroundImage: `url(${profile.backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined
  const coverAmbientStyle = { '--profile-cover-ambient-color': coverAmbientColor } as CSSProperties
  const coverPreviewImageStyle = coverPreviewPlacement ? {
    width: `${coverPreviewPlacement.width}px`,
    height: `${coverPreviewPlacement.height}px`,
    transform: `translate(calc(-50% + ${coverPreviewPlacement.shiftX}px), calc(-50% + ${coverPreviewPlacement.shiftY}px))`,
  } : undefined
  const profileStats = [
    { id: 'friends', count: profile.friendCount, label: t('profileFriendStat', { count: profile.friendCount }) },
    { id: 'followers', count: profile.followerCount, label: t('profileFollowerStat', { count: profile.followerCount }) },
    { id: 'following', count: profile.followingCount, label: t('profileFollowingStat', { count: profile.followingCount }) },
  ].filter((item) => item.count > 0)
  const profileBirthDate = formatProfileBirthDate(profile.birthDate, locale)
  const profileZodiac = getProfileZodiac(profile.birthDate)
  const profileGender = profile.gender === 'male'
    ? t('genderMale')
    : profile.gender === 'female'
      ? t('genderFemale')
      : profile.gender === 'custom'
        ? t('genderCustom')
        : t('genderPreferNot')

  return <>
    <main ref={profilePageRef} className={`profile-destination self-profile-page${tab === 'posts' ? ' profile-columns-scroll-active' : ''}${canEdit ? '' : ' visitor-profile-page'}${embedded ? ' embedded-profile-page' : ''}`}>
      <section className="profile-cover-card self-profile-cover-card">
        <div className="self-profile-cover-ambient" style={coverAmbientStyle} aria-hidden="true" />
        <div className="self-profile-header-shell">
          <div className={`profile-cover${coverCropTarget ? ' is-editing-cover' : ''}`} style={coverStyle}>
            {canEdit && coverCropTarget && <div
              ref={coverPreviewRef}
              className="self-profile-cover-preview"
              role="group"
              aria-label={t('cropBackground')}
              tabIndex={0}
              onPointerDown={beginCoverDrag}
              onPointerMove={moveCoverDrag}
              onPointerUp={endCoverDrag}
              onPointerCancel={endCoverDrag}
              onKeyDown={moveCoverWithKeyboard}
            ><img src={coverCropTarget.previewUrl} alt="" draggable={false} style={coverPreviewImageStyle} onLoad={(event) => setCoverImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} /></div>}
            {canEdit && <div className={`self-profile-cover-action${coverCropTarget ? ' editing' : ''}`} ref={coverActionRef}>
              {coverCropTarget ? <div className="self-profile-cover-edit-controls">
                <button type="button" className="cover-edit-icon" aria-label={t('storyZoomIn')} disabled={coverSaving || coverZoom >= 3} onClick={() => changeCoverZoom(.2)}><Icon name="plus" size={17} /></button>
                <button type="button" className="cover-edit-icon" aria-label={t('storyZoomOut')} disabled={coverSaving || coverZoom <= 1} onClick={() => changeCoverZoom(-.2)}><span aria-hidden="true">−</span></button>
                <button type="button" className="cover-edit-cancel" disabled={coverSaving} onClick={cancelCoverEdit}>{t('cancel')}</button>
                <button type="button" className="cover-edit-confirm" disabled={coverSaving} onClick={() => void saveCroppedCover()}><Icon name="check" size={16} />{coverSaving ? t('uploading') : t('confirm')}</button>
              </div> : <button type="button" className="self-profile-edit-cover" aria-haspopup="menu" aria-expanded={coverMenuOpen} onClick={() => setCoverMenuOpen((open) => !open)}><ProfileCoverCameraIcon />{t(profile.backgroundUrl ? 'profileEditCover' : 'profileAddCover')}</button>}
              {!coverCropTarget && coverMenuOpen && <AnchoredMenuPortal anchor={coverActionRef.current} className="self-profile-cover-menu" matchAnchorWidth onRequestClose={() => setCoverMenuOpen(false)}>
                <button type="button" role="menuitem" onClick={() => void openCoverPicker()}><ProfileCoverPhotoIcon />{t('profileChooseCover')}</button>
                <button type="button" role="menuitem" onClick={() => { setCoverMenuOpen(false); coverUploadInputRef.current?.click() }}><ProfileCoverUploadIcon />{t('profileUploadCover')}</button>
              </AnchoredMenuPortal>}
              <input ref={coverUploadInputRef} className="self-profile-cover-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  startCoverEdit(file, false)
                }
                event.currentTarget.value = ''
              }} />
            </div>}
          </div>
          <div className="profile-destination-header">
            <div ref={avatarViewMenuRef} className={`self-profile-avatar-wrap ${storyRingClass}${avatarEditor.target ? ' editing-avatar' : ''}${canEdit ? '' : ' visitor-profile-avatar-wrap'}`}>
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
              ><img src={avatarEditor.target.previewUrl} alt="" draggable={false} style={avatarEditor.imageStyle} onLoad={(event) => avatarEditor.onImageLoad(event.currentTarget)} /></div> : avatarViewMenuAvailable ? <>
                <button type="button" className="self-profile-avatar-view-trigger" aria-label={t('profileAvatarOptions')} aria-haspopup="menu" aria-expanded={avatarViewMenuOpen} disabled={avatarViewBusy} onClick={() => { setAvatarMenuOpen(false); setAvatarViewMenuOpen((open) => !open) }}><Avatar name={profile.displayName} src={profile.avatarUrl} size={138} /></button>
                {avatarViewMenuOpen && <AnchoredMenuPortal anchor={avatarViewMenuRef.current} align="start" className="self-profile-cover-menu self-profile-avatar-view-menu" onRequestClose={() => setAvatarViewMenuOpen(false)}>
                  {Boolean(profileStoryBucket?.stories.length) && <button type="button" role="menuitem" onClick={() => { setAvatarViewMenuOpen(false); setStoryViewerOpen(true) }}><ProfileViewStoryIcon />{t('profileViewStory')}</button>}
                  {profile.avatarUrl && <button type="button" role="menuitem" disabled={avatarViewBusy} onClick={() => void openProfileAvatarViewer()}><ProfileViewAvatarIcon />{t('profileViewAvatar')}</button>}
                  {canEdit && <button type="button" role="menuitem" onClick={() => void openAvatarPicker()}><ProfileCoverPhotoIcon />{t('profileChooseAvatar')}</button>}
                  {canEdit && <button type="button" role="menuitem" onClick={() => { setAvatarViewMenuOpen(false); avatarUploadInputRef.current?.click() }}><ProfileCoverUploadIcon />{t('profileUploadAvatar')}</button>}
                </AnchoredMenuPortal>}
              </> : <Avatar name={profile.displayName} src={profile.avatarUrl} size={138} />}
              {canEdit && !avatarEditor.target && <div className="self-profile-avatar-action" ref={avatarActionRef}>
                <button type="button" className="self-profile-avatar-camera" aria-label={t('profileEditAvatar')} aria-haspopup="menu" aria-expanded={avatarMenuOpen} onClick={() => { setAvatarViewMenuOpen(false); setAvatarMenuOpen((open) => !open) }}><ProfileCoverCameraIcon /></button>
                {avatarMenuOpen && <AnchoredMenuPortal anchor={avatarActionRef.current} align="start" className="self-profile-cover-menu self-profile-avatar-menu" onRequestClose={() => setAvatarMenuOpen(false)}>
                  <button type="button" role="menuitem" onClick={() => void openAvatarPicker()}><ProfileCoverPhotoIcon />{t('profileChooseAvatar')}</button>
                  <button type="button" role="menuitem" onClick={() => { setAvatarMenuOpen(false); setAvatarViewMenuOpen(false); avatarUploadInputRef.current?.click() }}><ProfileCoverUploadIcon />{t('profileUploadAvatar')}</button>
                </AnchoredMenuPortal>}
                <input ref={avatarUploadInputRef} className="self-profile-cover-file-input self-profile-avatar-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) startAvatarEdit(file, false)
                  event.currentTarget.value = ''
                }} />
              </div>}
            </div>
            <div className="profile-destination-title">
              <h1>{profile.displayName}<VerifiedBadge verified={profile.isVerified} size={24} marginLeft={2} /></h1>
              <div className="self-profile-summary-copy">
                {profileStats.length > 0 && <div className="self-profile-summary-line self-profile-stats">{profileStats.map((item) => <span key={item.id}>{item.label}</span>)}</div>}
                {!canEdit && relationship.followsViewer && <p className="self-profile-summary-line visitor-profile-follows-you">{t('followsYou')}</p>}
                {profile.bio && <p className="self-profile-summary-line self-profile-detail-line"><ProfileBioIcon /><span className="profile-preserve-newlines">{profile.bio}</span></p>}
                {profile.location && <p className="self-profile-summary-line self-profile-detail-line"><Icon className="self-profile-summary-icon" name="location" size={15} /><span>{profile.location}</span></p>}
              </div>
              {canEdit && avatarEditor.target && <div className="self-profile-cover-edit-controls self-profile-avatar-edit-controls">
                <button type="button" className="cover-edit-icon" aria-label={t('storyZoomIn')} disabled={avatarEditor.busy || avatarEditor.zoom >= 3} onClick={() => avatarEditor.changeZoom(.2)}><Icon name="plus" size={17} /></button>
                <button type="button" className="cover-edit-icon" aria-label={t('storyZoomOut')} disabled={avatarEditor.busy || avatarEditor.zoom <= 1} onClick={() => avatarEditor.changeZoom(-.2)}><span aria-hidden="true">−</span></button>
                <button type="button" className="cover-edit-cancel" disabled={avatarEditor.busy} onClick={avatarEditor.cancel}>{t('cancel')}</button>
                <button type="button" className="cover-edit-confirm" disabled={avatarEditor.busy} onClick={() => void saveCroppedAvatar()}><Icon name="check" size={16} />{avatarEditor.busy ? t('uploading') : t('confirm')}</button>
              </div>}
            </div>
            {canEdit ? <div className="self-profile-header-actions">
              <button type="button" className="btn-primary" onClick={() => setStoryCreatorOpen(true)}><ProfileAddStoryIcon />{t('profileAddStory')}</button>
              <button type="button" className="btn-soft" onClick={onEdit}><Icon name="edit" size={17} />{t('profileEditPage')}</button>
              <button type="button" className="btn-soft self-profile-header-chevron" aria-label={t('more')} onClick={() => undefined}><ProfileHeaderChevronIcon /></button>
            </div> : <ProfileActions profile={profile} relationship={relationship} loading={relationshipLoading} busyAction={busyAction} onFriend={friendAction} onFollow={followAction} onBlock={blockAction} onMessage={messageAction} />}
          </div>
          {actionError && <p className="inline-alert profile-action-error">{actionError}</p>}
          <nav ref={profileTabsRef} className="profile-tabs self-profile-tabs">
            <button ref={profileFirstTabRef} type="button" className={`self-profile-tab-option${tab === 'posts' ? ' active' : ''}`} onClick={() => setTab('posts')}>{t('profileTabAll')}</button>
            <button type="button" className={`self-profile-tab-option${tab === 'about' ? ' active' : ''}`} onClick={() => setTab('about')}>{t('profileTabAbout')}</button>
            <button type="button" className={`self-profile-tab-option${tab === 'photos' ? ' active' : ''}`} onClick={() => setTab('photos')}>{t('profileTabPhotos')}</button>
            <button type="button" className={`self-profile-tab-option${tab === 'friends' ? ' active' : ''}`} onClick={() => setTab('friends')}>{t('profileTabFriends')}</button>
            <button type="button" className={`self-profile-tab-option${tab === 'reels' ? ' active' : ''}`} onClick={() => setTab('reels')}>{t('profileTabReels')}</button>
            <button ref={profileGroupsTabRef} type="button" className={`self-profile-tab-option${tab === 'groups' ? ' active' : ''}`} onClick={() => setTab('groups')}>{t('profileTabGroups')}</button>
            {canEdit
              ? <button type="button" className="self-profile-tab-more" aria-label={t('more')} onClick={() => undefined}><Icon name="more" size={20} /></button>
              : <ProfileMoreActions relationship={relationship} busyAction={busyAction} onBlock={blockAction} />}
          </nav>
        </div>
      </section>

      <div ref={profileContentGridRef} className={`profile-destination-grid self-profile-destination-grid tab-${tab}`}>
        {tab === 'posts' && <aside ref={profileInfoColumnRef} className="self-profile-left-column">
          <section className="card self-profile-side-card self-profile-intro-card">
            <div className="self-profile-info-section">
              <header><h2>{t('profilePersonalInfo')}</h2>{canEdit && <button type="button" aria-label={t('editDetails')} onClick={() => setTab('about')}><ProfileInfoEditIcon /></button>}</header>
              <div className="self-profile-info-rows">
                {profile.location && <p className="prominent"><ProfileLocationIcon /><span>{t('livesIn', { location: profile.location })}</span></p>}
                {profileBirthDate && <p className="prominent"><ProfileZodiacIcon zodiac={profileZodiac} /><span>{t('profileBornLabel')} <time dateTime={profile.birthDate ?? undefined}>{profileBirthDate}</time></span></p>}
                <p className="prominent"><ProfileGenderIcon gender={profile.gender} /><span>{profileGender}</span></p>
              </div>
            </div>
            <div className="self-profile-info-section">
              <header><h2>{t('profileContactInfo')}</h2>{canEdit && <button type="button" aria-label={t('editDetails')} onClick={() => setTab('about')}><ProfileInfoEditIcon /></button>}</header>
              <div className="self-profile-info-rows"><p><ProfileEmailIcon />{profile.email ? <a href={`mailto:${profile.email}`}>{profile.email}</a> : <span>{t('notAvailable')}</span>}</p></div>
            </div>
          </section>

          <section className="card self-profile-side-card self-profile-featured-card">
            <header><h2>{t('profileFeatured')}</h2></header>
            {profileStoryBucket?.stories.length ? <div className="self-profile-featured-list">{profileStoryBucket.stories.slice(0, 3).map((story) => <ProfileStoryTile key={story.id} story={story} onOpen={() => setStoryViewerOpen(true)} />)}</div> : canEdit ? <button type="button" className="self-profile-featured-empty" onClick={() => setStoryCreatorOpen(true)}>{t('profileAddFeatured')}</button> : <p className="self-profile-featured-unavailable muted">{t('noStories')}</p>}
          </section>

          <section className="card self-profile-side-card self-profile-friends-card">
            <header><div><h2>{t('friends')}</h2><small>{t('profileFriendStat', { count: profile.friendCount })}</small></div><button type="button" onClick={() => setTab('friends')}>{t('profileViewAllFriends')}</button></header>
            {friendsLoading ? <div className="self-profile-side-loading"><span className="spinner" /></div> : profileFriends.length > 0 ? <div className="self-profile-friend-preview">{profileFriends.slice(0, 9).map((friend) => <button type="button" key={friend.id} onClick={() => onNavigate(`/profile/${friend.id}`)}><Avatar name={friend.displayName} src={friend.avatarUrl} size={96} /><strong>{friend.displayName}</strong>{(profileFriendMutualCounts[friend.id] ?? 0) > 0 && <small>{t('mutualFriendsCount', { count: profileFriendMutualCounts[friend.id] })}</small>}</button>)}</div> : <p className="self-profile-side-private muted">{t('friendListEmpty')}</p>}
          </section>

          <section className="card self-profile-side-card self-profile-photos-card">
            <header><div><h2>{t('photos')}</h2><small>{t(photosHaveMore ? 'profilePhotoStatMore' : 'profilePhotoStat', { count: photos.length })}</small></div><button type="button" onClick={() => setTab('photos')}>{t('profileSeeAllPhotos')}</button></header>
            {photosLoading && photos.length === 0 ? <div className="self-profile-side-loading"><span className="spinner" /></div> : <div className="self-profile-photo-preview">{photos.slice(0, 9).map((photo, index, previewPhotos) => <button type="button" className={profilePhotoPreviewCornerClass(index, previewPhotos.length)} key={`${photo.contentId}-${photo.media.id}`} onClick={() => void openProfileMediaViewer({ contentId: photo.contentId, mediaId: photo.media.id, mediaUrl: photo.media.url, mediaType: photo.media.type })}><img src={photo.media.url} alt="" loading="lazy" /></button>)}</div>}
          </section>
        </aside>}

        <section ref={profilePostColumnRef} className="profile-post-list">
          {tab === 'posts' && canEdit && <PostComposer variant="profile" userId={profile.id} displayName={profile.displayName} avatarUrl={profile.avatarUrl} isVerified={profile.isVerified} friends={profileFriends} onNavigate={onNavigate} onCreated={(post) => setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])} />}
          {tab === 'posts' && <section className="card self-profile-post-tools">
            <header><h2>{t('profilePostsTitle')}</h2><div><details><summary><ProfilePostFilterIcon />{t('profilePostFilters')}</summary><div>{(['all', 'media', 'text'] as ProfilePostFilter[]).map((filter) => <button type="button" key={filter} className={postFilter === filter ? 'active' : ''} onClick={() => setPostFilter(filter)}>{t(filter === 'all' ? 'profileAllPosts' : filter === 'media' ? 'profileMediaPosts' : 'profileTextPosts')}</button>)}</div></details>{canEdit && <button type="button" className={manageMode ? 'active' : ''} onClick={() => setManageMode((value) => !value)}><ProfilePostManageIcon />{t(manageMode ? 'done' : 'profileManagePosts')}</button>}</div></header>
            {canEdit && manageMode && <p>{t('profileManagePostsHint')}</p>}
            <div className="self-profile-post-view-tabs"><button type="button" className={postView === 'list' ? 'active' : ''} onClick={() => setPostView('list')}><ProfilePostListIcon /><span>{t('profileListView')}</span></button><button type="button" className={postView === 'grid' ? 'active' : ''} onClick={() => setPostView('grid')}><ProfilePostGridIcon /><span>{t('profileGridView')}</span></button></div>
          </section>}

          {tab === 'posts' && (postsLoading ? <div className="card state-card"><span className="spinner" /></div> : filteredPosts.length > 0 ? postView === 'grid' ? <div className="self-profile-post-months">{profilePostMonthGroups.map((group) => <section className="card self-profile-post-month" key={group.id}><h3>{group.label}</h3><div className="self-profile-post-grid">{group.posts.map((post) => <ProfilePostGridCard key={post.id} post={post} locale={locale} onOpenDetail={() => onNavigate(contentOverlayHref(post.id))} onOpenMedia={(item) => void openProfileMediaViewer(item)} onOpenReel={post.__typename === 'ReelDetail' ? () => openReelViewer(profile.id, post.id, gatewayReelToSocialContent(post)) : undefined} />)}</div></section>)}</div> : filteredPosts.map((post) => <GatewayPostCard key={post.id} post={post} locale={locale} viewerId={viewerId} onNavigate={onNavigate} onOpenReel={(reel) => openReelViewer(profile.id, reel.id, gatewayReelToSocialContent(reel))} />) : <div className="card state-card"><h2>{postsUnavailable ? t('unableToLoad') : t('profileNoPosts')}</h2><p>{postsUnavailable ? t('profilePostsLoadError') : canEdit ? t('yourPostsEmpty') : t('userPostsEmpty', { name: profile.displayName.split(' ')[0] })}</p></div>)}
          {tab === 'posts' && posts.length > 0 && (postsHaveMore || postsLoadingMore || postsMoreError) && <div ref={profilePostSentinelRef} className="profile-posts-auto-loader" aria-live="polite">
            {postsLoadingMore && <span className="spinner" aria-label={t('loadingMore')} />}
            {postsMoreError && <button type="button" className="btn-soft" disabled={!postCursor} onClick={() => void loadProfilePosts(postCursor, true)}>{t('tryAgain')}</button>}
          </div>}
          {tab === 'about' && <ProfileAboutPanel profile={profile} canEdit={canEdit} />}
          {tab === 'friends' && <ProfileConnectionsTab profile={profile} viewerId={viewerId} canManage={canEdit} onNavigate={onNavigate} />}
          {tab === 'photos' && <ProfileMediaTab profile={profile} canEdit={canEdit} friends={profileFriends} onOpenMedia={(item, entries) => void openProfileMediaViewer(item, entries)} onPostCreated={(post) => setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])} />}
          {tab === 'reels' && <ProfileReelsTab profile={profile} canEdit={canEdit} friends={profileFriends} onOpenReel={openReelViewer} onCreated={(post) => setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])} />}
          {tab === 'groups' && <ProfileGroupsTab groups={profileGroups} managedGroups={profileManagedGroups} loading={groupsLoading} unavailable={groupsUnavailable} canManage={canEdit} onNavigate={onNavigate} />}
        </section>
      </div>
    </main>

    {canEdit && storyCreatorOpen && <Suspense fallback={<div className="modal-backdrop"><span className="spinner" /></div>}><StoryCreatorModal open authorId={profile.id} onClose={() => setStoryCreatorOpen(false)} onCreated={(story) => {
      rememberOwnUnseenStory(profile.id, story.id)
      setMyStories((current) => ({
        author: { id: profile.id, name: profile.displayName, avatar: profile.avatarUrl ?? '', isVerified: Boolean(profile.isVerified) },
        latestCreate: story.create,
        hasUnseen: true,
        unseenCount: Math.max(1, (current?.unseenCount ?? 0) + 1),
        stories: [story, ...(current?.stories ?? []).filter((item) => item.id !== story.id)],
      }))
    }} /></Suspense>}
    {storyViewerOpen && profileStoryBucket && <Suspense fallback={<div className="story-viewer-backdrop"><span className="spinner" /></div>}><StoryViewerPage buckets={storyViewerBuckets} initialBucketId={profile.id} viewerId={viewerId} onClose={() => setStoryViewerOpen(false)} onNavigate={onNavigate} onViewed={markProfileStoryViewed} onCreateStory={canEdit ? () => { setStoryViewerOpen(false); setStoryCreatorOpen(true) } : undefined} onStoryDeleted={canEdit ? (storyId) => {
      const wasUnseen = forgetOwnUnseenStory(activeProfileId, storyId)
      setMyStories((current) => {
        if (!current) return null
        const stories = current.stories.filter((story) => story.id !== storyId)
        if (stories.length === 0) return null
        if (!wasUnseen) return { ...current, stories, latestCreate: stories[0].create }
        const unseenCount = Math.max(0, Number(current.unseenCount ?? 0) - 1)
        return { ...current, stories, latestCreate: stories[0].create, unseenCount, hasUnseen: unseenCount > 0 }
      })
    } : undefined} /></Suspense>}
    {profileMediaViewer && !onOpenPhoto && <Suspense fallback={<div className="post-photo-viewer"><span className="spinner" /></div>}><PostPhotoViewer viewerId={viewerId} contentId={profileMediaViewer.contentId} initialMediaId={profileMediaViewer.mediaId} initialMediaUrl={profileMediaViewer.mediaUrl} initialPlaybackTime={profileMediaViewer.initialPlaybackTime} initialPost={profileMediaViewer.initialPost} mediaEntries={profileMediaViewer.entries} unavailableAuthor={profileMediaViewer.unavailableAuthor} onClose={() => setProfileMediaViewer(null)} onNavigate={onNavigate} onMessage={onMessage} /></Suspense>}
    {canEdit && coverPickerOpen && <ProfileImagePhotoPicker kind="cover" images={coverCandidates} loading={coverCandidatesLoading} error={coverPickerError} onClose={() => { coverPickerRequestRef.current += 1; setCoverCandidatesLoading(false); setCoverPickerOpen(false) }} onSelect={(photo) => void chooseExistingCover(photo)} />}
    {canEdit && avatarPickerOpen && <ProfileImagePhotoPicker kind="avatar" images={avatarCandidates} loading={avatarCandidatesLoading} error={avatarPickerError} onClose={() => { avatarPickerRequestRef.current += 1; setAvatarCandidatesLoading(false); setAvatarPickerOpen(false) }} onSelect={(photo) => void chooseExistingAvatar(photo)} />}
  </>
}

type ProfileMediaFilter = 'all' | 'photos' | 'videos'
type ProfileConnectionSection = 'friends' | 'following' | 'followers'

interface ProfileMediaItem {
  id: string
  contentId: string
  mediaId: string
  type: number
  url: string
  createdAt: string
}

interface ProfileMediaData {
  items: ProfileMediaItem[]
  entries: PostPhotoViewerMediaEntry[]
}

async function loadProfileMediaData(userId: string): Promise<ProfileMediaData> {
  const photoItems: ProfileMediaItem[] = []
  const collectPhotos = async () => {
    let cursor: string | null = null
    for (let pageIndex = 0; pageIndex < 6; pageIndex++) {
      const page = await socialApi.getUserPhotos(userId, 60, cursor)
      photoItems.push(...page.items.map((item) => ({
        id: `${item.contentId}:${item.media.id}`,
        contentId: item.contentId,
        mediaId: item.media.id,
        type: 0,
        url: item.media.url,
        createdAt: item.createdAt,
      })))
      if (!page.hasNextPage || !page.endCursor) break
      cursor = page.endCursor
    }
  }

  const [, posts] = await Promise.all([collectPhotos(), loadAllProfileFeedPosts(userId)])
  const entries = buildProfileMediaEntries(posts)
  const videoItems = entries.flatMap((entry) => entry.post && entry.media.type === 1 ? [{
    id: `${entry.post.id}:${entry.media.id}`,
    contentId: entry.post.id,
    mediaId: entry.media.id,
    type: 1,
    url: entry.media.url,
    createdAt: entry.post.create,
  }] : [])
  const unique = new Map<string, ProfileMediaItem>()
  for (const item of [...photoItems, ...videoItems]) unique.set(item.id, item)
  const items = [...unique.values()].sort((left, right) => {
    const timeDifference = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    return Number.isFinite(timeDifference) && timeDifference !== 0 ? timeDifference : right.id.localeCompare(left.id)
  })
  return { items, entries }
}

function ProfileMediaTab({ profile, canEdit, friends, onOpenMedia, onPostCreated }: { profile: SocialProfile; canEdit: boolean; friends: SocialProfile[]; onOpenMedia: (item: { contentId: string; mediaId: string; mediaUrl: string; mediaType: number }, entries: PostPhotoViewerMediaEntry[]) => void; onPostCreated: (post: GatewayPost) => void }) {
  const { t } = useI18n()
  const [filter, setFilter] = useState<ProfileMediaFilter>('all')
  const [items, setItems] = useState<ProfileMediaItem[]>([])
  const [viewerEntries, setViewerEntries] = useState<PostPhotoViewerMediaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [composerRequest, setComposerRequest] = useState(0)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await loadProfileMediaData(profile.id)
      setItems(data.items)
      setViewerEntries(data.entries)
    } catch {
      setItems([])
      setViewerEntries([])
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [profile.id])

  useEffect(() => { void reload() }, [reload])
  const filteredItems = items.filter((item) => filter === 'all' || (filter === 'photos' ? item.type === 0 : item.type === 1))

  async function setAsProfileImage(item: ProfileMediaItem, kind: 'avatar' | 'cover') {
    setBusyId(item.id)
    try {
      const updated = kind === 'avatar'
        ? await socialApi.changeUserAvatar(
            profile.id,
            item.url,
            null,
            0,
            { contentId: item.contentId, mediaId: item.mediaId },
          )
        : await socialApi.changeUserBackground(profile.id, item.url, null, 0)
      if (updated) window.dispatchEvent(new CustomEvent('fakebook:profile-updated', { detail: updated }))
      setMenuId(null)
      setMenuAnchor(null)
    } finally {
      setBusyId(null)
    }
  }

  function handleCreated(post: GatewayPost) {
    onPostCreated(post)
    const additions = post.media.map((media) => ({
      id: `${post.id}:${media.id}`,
      contentId: post.id,
      mediaId: media.id,
      type: media.type,
      url: media.url,
      createdAt: post.create,
    }))
    setItems((current) => [...additions, ...current.filter((item) => !additions.some((addition) => addition.id === item.id))])
    if (post.__typename !== 'ReelDetail') {
      const additionsForViewer = buildProfileMediaEntries([post])
      setViewerEntries((current) => [...additionsForViewer, ...current.filter((entry) => !additionsForViewer.some((addition) => addition.post?.id === entry.post?.id && addition.media.id === entry.media.id))])
    }
  }

  return <section className="card self-profile-collection-card self-profile-media-tab">
    <header className="self-profile-collection-head self-profile-section-head"><h2>{t('photos')}</h2>{canEdit && <button type="button" className="self-profile-section-action" onClick={() => setComposerRequest((value) => value + 1)}>{t('profileAddPhotoVideo')}</button>}</header>
    <nav className="self-profile-collection-tabs" aria-label={t('photos')}>
      {(['all', 'photos', 'videos'] as ProfileMediaFilter[]).map((value) => <button type="button" key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{t(value === 'all' ? 'profileMediaAll' : value === 'photos' ? 'photos' : 'videos')}</button>)}
    </nav>
    {loading ? <div className="self-profile-collection-state"><span className="spinner" /></div> : error ? <div className="self-profile-collection-state muted">{t('profileMediaLoadError')}</div> : filteredItems.length === 0 ? <div className="self-profile-collection-state muted">{t('photosEmpty')}</div> : <div className="self-profile-media-grid">{filteredItems.map((item) => <article key={item.id}>
      <button type="button" className="self-profile-media-open" onClick={() => onOpenMedia({ contentId: item.contentId, mediaId: item.mediaId, mediaUrl: item.url, mediaType: item.type }, viewerEntries)}>{item.type === 1 ? <><video src={item.url} muted playsInline preload="metadata" /><span className="self-profile-media-play"><Icon name="play" size={20} /></span></> : <img src={item.url} alt="" loading="lazy" />}</button>
      {canEdit && item.type === 0 && <div className="self-profile-media-edit" data-profile-media-menu={item.id}><button type="button" aria-label={t('edit')} onClick={(event) => { const nextOpen = menuId !== item.id; setMenuId(nextOpen ? item.id : null); setMenuAnchor(nextOpen ? event.currentTarget : null) }}><Icon name="edit" size={16} /></button>{menuId === item.id && <AnchoredMenuPortal anchor={menuAnchor} className="self-profile-media-menu-popover" onRequestClose={() => { setMenuId(null); setMenuAnchor(null) }}><button type="button" role="menuitem" disabled={busyId === item.id} onClick={() => void setAsProfileImage(item, 'avatar')}><Icon name="user" size={18} />{t('profileSetAsAvatar')}</button><button type="button" role="menuitem" disabled={busyId === item.id} onClick={() => void setAsProfileImage(item, 'cover')}><Icon name="photo" size={18} />{t('profileSetAsCover')}</button></AnchoredMenuPortal>}</div>}
    </article>)}</div>}
    {canEdit && <PostComposer triggerOnly externalOpenRequest={composerRequest} variant="profile" userId={profile.id} displayName={profile.displayName} avatarUrl={profile.avatarUrl} isVerified={profile.isVerified} friends={friends} onCreated={handleCreated} />}
  </section>
}

function ProfileConnectionsTab({ profile, viewerId, canManage, onNavigate }: { profile: SocialProfile; viewerId: string; canManage: boolean; onNavigate: (path: string) => void }) {
  const { t } = useI18n()
  const [section, setSection] = useState<ProfileConnectionSection>('friends')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Array<{ profile: SocialProfile; mutualFriendCount: number }>>([])
  const [loading, setLoading] = useState(true)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [unfollowedIds, setUnfollowedIds] = useState<Set<string>>(() => new Set())
  const [requestedIds, setRequestedIds] = useState<Set<string>>(() => new Set())
  const mutualCountsRef = useRef(new Map<string, number>())
  const sections: Array<{ id: ProfileConnectionSection; label: string }> = [
    { id: 'friends', label: t('profileAllFriends') },
    ...(canManage && profile.followingCount > 0 ? [{ id: 'following' as const, label: t('following') }] : []),
    ...(canManage && profile.followerCount > 0 ? [{ id: 'followers' as const, label: t('profileFollowers') }] : []),
  ]

  useEffect(() => {
    setQuery('')
    setMenuId(null)
    setMenuAnchor(null)
  }, [section])

  useEffect(() => {
    if (canManage) return
    setSection('friends')
    let active = true
    setLoading(true)
    socialApi.getProfileFriends(profile.id, 200).then((connections) => {
      if (active) setItems(connections)
    }).catch(() => {
      if (active) setItems([])
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [canManage, profile.id])

  useEffect(() => {
    if (!canManage) return
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      const request = query
        ? searchApi.searchProfileConnections(section, query, 1, 100).then((profiles) => profiles.map((connectionProfile) => ({
          profile: connectionProfile,
          mutualFriendCount: mutualCountsRef.current.get(connectionProfile.id) ?? 0,
        })))
        : socialApi.getProfileConnections(profile.id, section, 200).then((connections) => {
          if (section === 'friends') mutualCountsRef.current = new Map(connections.map((item) => [item.profile.id, item.mutualFriendCount]))
          return connections
        })
      request.then((value) => {
        if (active) setItems(value)
      }).catch(() => {
        if (active) setItems([])
      }).finally(() => {
        if (active) setLoading(false)
      })
    }, query ? 220 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [canManage, profile.id, query, section])

  const visibleItems = useMemo(() => {
    if (canManage || !query.trim()) return items
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return items.filter(({ profile: itemProfile }) =>
      itemProfile.displayName.toLocaleLowerCase().includes(normalizedQuery) ||
      itemProfile.username.toLocaleLowerCase().includes(normalizedQuery))
  }, [canManage, items, query])

  const closeMenu = () => {
    setMenuId(null)
    setMenuAnchor(null)
  }

  async function removeFriend(targetId: string) {
    if (!canManage) return
    setBusyId(targetId)
    try {
      if (await socialApi.unfriend(viewerId, targetId)) setItems((current) => current.filter((item) => item.profile.id !== targetId))
      closeMenu()
    } finally { setBusyId(null) }
  }
  async function block(targetId: string) {
    if (!canManage) return
    setBusyId(targetId)
    try {
      if (await socialApi.blockUser(viewerId, targetId)) setItems((current) => current.filter((item) => item.profile.id !== targetId))
      closeMenu()
    } finally { setBusyId(null) }
  }
  async function toggleFollowing(targetId: string) {
    if (!canManage) return
    setBusyId(targetId)
    try {
      const currentlyFollowing = !unfollowedIds.has(targetId)
      const success = currentlyFollowing ? await socialApi.unfollowUser(viewerId, targetId) : await socialApi.followUser(viewerId, targetId)
      if (success) setUnfollowedIds((current) => {
        const next = new Set(current)
        if (currentlyFollowing) next.add(targetId)
        else next.delete(targetId)
        return next
      })
    } finally { setBusyId(null) }
  }
  async function addFriend(targetId: string) {
    if (!canManage) return
    setBusyId(targetId)
    try {
      if (await socialApi.sendFriendRequest(viewerId, targetId)) setRequestedIds((current) => new Set(current).add(targetId))
      closeMenu()
    } finally { setBusyId(null) }
  }

  return <section className="card self-profile-collection-card self-profile-connections-tab">
    <header className="self-profile-collection-head self-profile-section-head"><h2>{t('friends')}</h2><div className="self-profile-section-actions"><label className="self-profile-connections-search"><ProfileTabSearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search')} /></label>{canManage && <><button type="button" className="self-profile-section-action" onClick={() => onNavigate('/friends/incoming')}>{t('friendRequests')}</button><button type="button" className="self-profile-section-action" onClick={() => onNavigate('/friends/suggestions')}>{t('profileFindFriends')}</button></>}</div></header>
    <nav className="self-profile-collection-tabs" aria-label={t('friends')}>{sections.map((item) => <button type="button" key={item.id} className={section === item.id ? 'active' : ''} onClick={() => setSection(item.id)}>{item.label}</button>)}</nav>
    {loading ? <div className="self-profile-collection-state"><span className="spinner" /></div> : visibleItems.length === 0 ? <div className="self-profile-collection-state muted">{query ? t('noSearchResults') : t('friendListEmpty')}</div> : <div className="self-profile-connections-grid">{visibleItems.map((item) => {
      const person = item.profile
      const isUnfollowed = unfollowedIds.has(person.id)
      return <article key={person.id}>
        <button type="button" className="self-profile-connection-person" onClick={() => onNavigate(`/profile/${person.id}`)}><Avatar name={person.displayName} src={person.avatarUrl} size={72} /><span><strong><span className="self-profile-result-name-text">{person.displayName}</span><VerifiedBadge verified={person.isVerified} size={13} /></strong>{section === 'friends' && item.mutualFriendCount > 0 && <small>{t('mutualFriendsCount', { count: item.mutualFriendCount })}</small>}</span></button>
        {canManage && (section === 'following' ? <button type="button" className={isUnfollowed ? 'self-profile-follow-toggle follow' : 'self-profile-follow-toggle'} disabled={busyId === person.id} onClick={() => void toggleFollowing(person.id)}>{t(isUnfollowed ? 'follow' : 'following')}</button> : <div className="self-profile-connection-menu" data-profile-connection-menu={person.id}><button type="button" aria-label={t('more')} aria-haspopup="menu" aria-expanded={menuId === person.id} onClick={(event) => { const nextOpen = menuId !== person.id; setMenuId(nextOpen ? person.id : null); setMenuAnchor(nextOpen ? event.currentTarget : null) }}><Icon name="more" size={18} /></button>{menuId === person.id && <AnchoredMenuPortal anchor={menuAnchor} className="self-profile-cover-menu self-profile-connection-menu-popover" onRequestClose={closeMenu}>{section === 'friends' ? <button type="button" role="menuitem" disabled={busyId === person.id} onClick={() => void removeFriend(person.id)}><FriendPersonActionGlyph action="remove" />{t('removeFriend')}</button> : <button type="button" role="menuitem" disabled={busyId === person.id || requestedIds.has(person.id)} onClick={() => void addFriend(person.id)}><FriendPersonActionGlyph action={requestedIds.has(person.id) ? 'request-sent' : 'add'} />{t(requestedIds.has(person.id) ? 'requestSent' : 'addFriend')}</button>}<button type="button" role="menuitem" disabled={busyId === person.id} onClick={() => void block(person.id)}><FriendPersonActionGlyph action="block" />{t('block')}</button></AnchoredMenuPortal>}</div>)}
      </article>
    })}</div>}
  </section>
}

function ProfileGroupsTab({ groups, managedGroups, loading, unavailable, canManage, onNavigate }: { groups: SocialGroup[]; managedGroups: SocialGroup[]; loading: boolean; unavailable: boolean; canManage: boolean; onNavigate: (path: string) => void }) {
  const { t } = useI18n()
  const [section, setSection] = useState<'joined' | 'managed'>('joined')
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const managedIds = useMemo(() => new Set(managedGroups.map((group) => group.id)), [managedGroups])
  const sectionGroups = section === 'managed' ? managedGroups : groups.filter((group) => !managedIds.has(group.id))
  const visibleGroups = normalizedQuery
    ? sectionGroups.filter((group) => group.name.toLocaleLowerCase().includes(normalizedQuery))
    : sectionGroups

  return <section className="card self-profile-collection-card self-profile-groups-tab">
    <header className="self-profile-collection-head self-profile-section-head"><h2>{t('groups')}</h2><div className="self-profile-section-actions"><label className="self-profile-connections-search"><ProfileTabSearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search')} /></label>{canManage && <><button type="button" className="self-profile-section-action" onClick={() => onNavigate('/groups')}>{t('profileGroupInvitations')}</button><button type="button" className="self-profile-section-action" onClick={() => onNavigate('/groups')}>{t('profileFindGroups')}</button></>}</div></header>
    <nav className="self-profile-collection-tabs" aria-label={t('groups')}><button type="button" className={section === 'joined' ? 'active' : ''} onClick={() => setSection('joined')}>{t('profileJoinedGroupsTab')}</button><button type="button" className={section === 'managed' ? 'active' : ''} onClick={() => setSection('managed')}>{t('profileManagedGroupsTab')}</button></nav>
    {loading ? <div className="self-profile-collection-state"><span className="spinner" /></div> : visibleGroups.length === 0 ? <div className="self-profile-collection-state muted">{unavailable ? t('groupsLoadError') : normalizedQuery ? t('noSearchResults') : t(section === 'managed' ? 'managedGroupsEmpty' : 'joinedGroupsEmpty')}</div> : <div className="self-profile-connections-grid self-profile-group-results-grid">{visibleGroups.map((group) => <article key={group.id}><button type="button" className="self-profile-connection-person self-profile-group-result" onClick={() => onNavigate(`/groups/${group.id}`)}><Avatar name={group.name} src={group.avatarUrl} size={72} className="group-square-avatar" /><span><strong><span className="self-profile-result-name-text">{group.name}</span></strong><small className="self-profile-group-meta"><span className="self-profile-group-privacy"><PostPrivacyIcon privacy={group.privacy === 0 ? 0 : 1} group={group.privacy !== 0} size={15} />{group.privacy === 0 ? t('groupPublicVisibility') : t('groupPrivateVisibility')}</span><b className="groups-meta-separator" aria-hidden="true">·</b><span>{group.memberCount == null ? t('groupResult') : t('membersCount', { count: group.memberCount })}</span></small></span></button></article>)}</div>}
  </section>
}

function ProfileTabSearchIcon() {
  return <svg className="self-profile-tab-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="10.35" cy="10.35" r="6.55" /><path d="m15.25 15.25 3.35 3.35" /></svg>
}

async function loadProfileReelItems(userId: string, mode: 'own' | 'saved'): Promise<SocialContent[]> {
  const reels: SocialContent[] = []
  let cursor: string | null = null
  for (let pageIndex = 0; pageIndex < 8; pageIndex++) {
    if (mode === 'own') {
      const page = await socialApi.getProfileReels(userId, 25, cursor)
      reels.push(...page.items)
      if (!page.hasNextPage || !page.endCursor) break
      cursor = page.endCursor
    } else {
      const page = await socialApi.getSavedContent(30, cursor)
      reels.push(...page.items.flatMap((item) => item.kind === 'reel' ? [item.reel] : []))
      if (!page.hasNextPage || !page.endCursor) break
      cursor = page.endCursor
    }
  }
  return [...new Map(reels.map((reel) => [reel.id, reel])).values()]
}

function ProfileReelsTab({ profile, canEdit, friends, onOpenReel, onCreated }: { profile: SocialProfile; canEdit: boolean; friends: SocialProfile[]; onOpenReel: (ownerId: string, reelId: string, reel?: SocialContent) => void; onCreated: (post: GatewayPost) => void }) {
  const { t } = useI18n()
  const [mode, setMode] = useState<'own' | 'saved'>('own')
  const [items, setItems] = useState<SocialContent[]>([])
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [reelOpenRequest, setReelOpenRequest] = useState(0)

  useEffect(() => {
    if (!canEdit && mode === 'saved') setMode('own')
  }, [canEdit, mode])

  useEffect(() => {
    let active = true
    setLoading(true)
    loadProfileReelItems(profile.id, mode).then(async (reels) => {
      if (!active) return
      setItems(reels)
      try {
        const counts = await socialApi.getContentViewCounts(reels.map((reel) => reel.id))
        if (active) setViewCounts(counts)
      } catch {
        if (active) setViewCounts({})
      }
    }).catch(() => {
      if (active) setItems([])
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [mode, profile.id])

  function addCreatedReel(createdReel: GatewayPost) {
    if (createdReel.__typename === 'ReelDetail') {
      setMode('own')
      const reel: SocialContent = {
        id: createdReel.id,
        type: createdReel.type,
        content: createdReel.content,
        privacy: createdReel.privacy,
        createdAt: createdReel.create,
        authorId: createdReel.author.id,
        media: createdReel.media,
        aspectRatio: createdReel.aspectRatio,
        focalPointX: createdReel.focalPointX,
        focalPointY: createdReel.focalPointY,
        author: {
          id: createdReel.author.id,
          username: profile.username,
          displayName: createdReel.author.name,
          avatarUrl: createdReel.author.avatar || null,
          isVerified: createdReel.author.isVerified,
        },
        mentions: createdReel.mentions,
      }
      setItems((current) => [reel, ...current.filter((item) => item.id !== reel.id)])
      setViewCounts((current) => ({ ...current, [reel.id]: current[reel.id] ?? 0 }))
    }
    onCreated(createdReel)
  }

  return <>
    <section className="card self-profile-collection-card self-profile-reels-tab">
    <header className="self-profile-collection-head self-profile-section-head"><h2>{t('profileTabReels')}</h2>{canEdit && <button type="button" className="self-profile-section-action" onPointerEnter={() => { void import('../components/CreateReelModal') }} onFocus={() => { void import('../components/CreateReelModal') }} onClick={() => setReelOpenRequest((request) => request + 1)}>{t('profileCreateReel')}</button>}</header>
    <nav className="self-profile-collection-tabs" aria-label={t('profileTabReels')}><button type="button" className={mode === 'own' ? 'active' : ''} onClick={() => setMode('own')}>{canEdit ? t('profileYourReels') : t('profileUserReels', { name: profile.displayName })}</button>{canEdit && <button type="button" className={mode === 'saved' ? 'active' : ''} onClick={() => setMode('saved')}>{t('profileSavedReels')}</button>}</nav>
    {loading ? <div className="self-profile-collection-state"><span className="spinner" /></div> : items.length === 0 ? <div className="self-profile-collection-state muted">{t('profileNoReels')}</div> : <div className="self-profile-reels-grid">{items.map((reel) => {
      const media = reel.media[0]
      return <button type="button" key={reel.id} onClick={() => onOpenReel(mode === 'own' ? profile.id : reel.authorId, reel.id, reel)}>{media ? media.type === 1 ? <video src={media.url} muted playsInline preload="metadata" /> : <img src={media.url} alt="" loading="lazy" /> : <span>{decodePostContent(reel.content).text}</span>}<small><Icon name="eye" size={17} />{viewCounts[reel.id] ?? 0}</small></button>
    })}</div>}
    </section>
    {canEdit && <PostComposer variant="profile" triggerOnly externalReelOpenRequest={reelOpenRequest} userId={profile.id} displayName={profile.displayName} avatarUrl={profile.avatarUrl} isVerified={profile.isVerified} friends={friends} onCreated={addCreatedReel} />}
  </>
}

function ProfileCoverCameraIcon() {
  return <svg className="self-profile-cover-camera-icon" width="19" height="19" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M8.25 4.1h7.5l1.65 2H20a2.4 2.4 0 0 1 2.4 2.4v9.1A2.4 2.4 0 0 1 20 20H4a2.4 2.4 0 0 1-2.4-2.4V8.5A2.4 2.4 0 0 1 4 6.1h2.6l1.65-2Z" fill="currentColor" />
    <circle cx="12" cy="13" r="4.7" fill="var(--profile-camera-lens, #fff)" />
    <circle cx="12" cy="13" r="2.65" fill="currentColor" />
  </svg>
}

function ProfileViewStoryIcon() {
  return <svg className="profile-avatar-menu-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M3.25 5.25c2.85-1.1 5.75-.7 8.75 1.15v13.1c-3-1.85-5.9-2.25-8.75-1.15V5.25Z" /><path d="M20.75 5.25C17.9 4.15 15 4.55 12 6.4v13.1c3-1.85 5.9-2.25 8.75-1.15V5.25Z" /></svg>
}

function ProfileViewAvatarIcon() {
  return <svg className="profile-avatar-menu-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="3.4" y="2.8" width="17.2" height="18.4" rx="5" /><circle cx="12" cy="9" r="2.5" /><path d="M7.65 17.1c.55-2.45 2-3.65 4.35-3.65s3.8 1.2 4.35 3.65" /></svg>
}

function ProfileInfoEditIcon() {
  return <svg className="self-profile-info-edit-icon" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M5.15 18.85 6.2 15.5l9.35-9.35a2.02 2.02 0 0 1 2.86 0l.18.18a2.02 2.02 0 0 1 0 2.86l-9.35 9.35-3.38.98" /><path d="m13.9 7.8 3.05 3.05M6.2 15.5l3.04 3.04" /></svg>
}

function ProfileDateInputIcon() {
  return <svg className="profile-about-date-icon" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="3.15" y="4.35" width="17.7" height="16.45" rx="3.35" /><path d="M7.35 2.85v3.5M16.65 2.85v3.5M3.45 9.05h17.1" /><path d="M7.35 12.1h2.2v2.2h-2.2zM11 12.1h2.2v2.2H11zM14.65 12.1h2.2v2.2h-2.2zM7.35 15.75h2.2v2.2h-2.2zM11 15.75h2.2v2.2H11z" fill="currentColor" stroke="none" /></svg>
}

function ProfileSelectChevronIcon() {
  return <svg className="profile-about-select-chevron" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.15" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m7.25 9.5 4.75 4.75 4.75-4.75" /></svg>
}

function ProfileOptionCheckIcon() {
  return <svg className="profile-about-option-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m5.5 12.25 4.05 4.05L18.7 7.2" /></svg>
}

function ProfileBioIcon() {
  return <svg className="self-profile-summary-icon self-profile-bio-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="3.25" y="4.5" width="17.5" height="15" rx="2.75" /><circle cx="8.5" cy="9.75" r="2.05" /><path d="M5.7 15.6c.4-2.05 1.35-3.05 2.8-3.05s2.4 1 2.8 3.05M14 9h3.2M14 13h3.2" /></svg>
}

function ProfileLocationIcon() {
  return <svg className="self-profile-info-icon" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 21s7-6.55 7-12a7 7 0 1 0-14 0c0 5.45 7 12 7 12Z" /><circle cx="12" cy="9" r="2.35" /></svg>
}

function ProfileZodiacIcon({ zodiac }: { zodiac: ProfileZodiac | null }) {
  return <svg className="self-profile-info-icon self-profile-zodiac-icon" data-zodiac={zodiac?.id ?? 'unknown'} width="25" height="25" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><text x="12" y="12.5" fill="currentColor" fontFamily="'Segoe UI Symbol', 'Apple Symbols', sans-serif" fontSize="19" fontWeight="600" textAnchor="middle" dominantBaseline="middle">{zodiac?.symbol ?? '✦'}</text></svg>
}

function ProfileGenderIcon({ gender }: { gender: SocialProfile['gender'] }) {
  const variant = gender === 'female' ? 'female' : gender === 'male' ? 'male' : 'neutral'
  if (variant === 'female') return <svg className="self-profile-info-icon self-profile-gender-icon female" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4.5" /><path d="M12 12.5V21M8.5 17h7" /></svg>
  if (variant === 'male') return <svg className="self-profile-info-icon self-profile-gender-icon male" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="8.8" cy="14.2" r="4.55" /><path d="m12.05 10.95 6.7-6.7M14.5 4.25h4.25V8.5" /></svg>
  return <svg className="self-profile-info-icon self-profile-gender-icon neutral" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="7.5" r="3.4" /><path d="M5.5 20c.45-4.35 2.85-6.6 6.5-6.6s6.05 2.25 6.5 6.6" /></svg>
}

function ProfileEmailIcon() {
  return <svg className="self-profile-info-icon" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="2.75" y="5.25" width="18.5" height="13.5" rx="2.25" /><path d="m4.5 7.25 7.5 5.65 7.5-5.65" /></svg>
}

function ProfilePostFilterIcon() {
  return <svg className="profile-post-filter-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M3.5 7h7.9M16.6 7h3.9M3.5 17h3.9M12.6 17h7.9" /><circle cx="14" cy="7" r="2.3" /><circle cx="10" cy="17" r="2.3" /></svg>
}

function ProfilePostManageIcon() {
  return <svg className="profile-post-manage-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path fillRule="evenodd" clipRule="evenodd" d="M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a9.2 9.2 0 0 0-1.69-.98l-.38-2.65A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42l-.38 2.65a9.2 9.2 0 0 0-1.69.98l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65a7.2 7.2 0 0 0 0 1.96l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.12.22.37.31.6.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65a9.2 9.2 0 0 0 1.69-.98l2.49 1c.23.09.48 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65ZM12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" /></svg>
}

function ProfileCoverPhotoIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="3.25" y="2.75" width="17.5" height="18.5" rx="2.4" /><circle cx="8.25" cy="8" r="1.35" /><path d="m5.6 18 4.2-4.55 2.7 2.55 2.45-2.75 3.45 4.75" /></svg>
}

function ProfileCoverUploadIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 15V3m0 0L7.8 7.25M12 3l4.2 4.25" /><path d="M4 14.5v4.25A2.25 2.25 0 0 0 6.25 21h11.5A2.25 2.25 0 0 0 20 18.75V14.5" /></svg>
}

function ProfileAddStoryIcon() {
  return <svg className="self-profile-add-story-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" /></svg>
}

function ProfileHeaderChevronIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m7 9.5 5 5 5-5" /></svg>
}

function ProfileFriendStatusIcon() {
  return <FriendPersonActionGlyph className="visitor-profile-status-icon" action="check" size={17} />
}

function ProfileCancelRequestIcon() {
  return <FriendPersonActionGlyph className="visitor-profile-status-icon" action="cancel" size={17} />
}

function ProfileImagePhotoPicker({ kind, images, loading, error, onClose, onSelect }: { kind: 'avatar' | 'cover'; images: SocialPhoto[]; loading: boolean; error: string | null; onClose: () => void; onSelect: (photo: SocialPhoto) => void }) {
  const { t } = useI18n()
  const title = t(kind === 'avatar' ? 'profileChooseAvatar' : 'profileChooseCover')
  return <div className="modal-backdrop existing-photo-backdrop" role="presentation" onClick={onClose}><section className="modal existing-photo-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}><header className="modal-head"><div><h2>{title}</h2><p>{t(kind === 'avatar' ? 'chooseAvatarPhotoDesc' : 'chooseBackgroundPhotoDesc')}</p></div><button type="button" className="icon-circle subtle" aria-label={t('close')} onClick={onClose}><Icon name="close" /></button></header>{loading ? <div className="settings-loading"><span className="spinner" /></div> : error ? <p className="form-error existing-photo-state">{error}</p> : images.length > 0 ? <div className="existing-photo-grid">{images.map((photo) => <button type="button" key={`${photo.contentId}-${photo.media.id}`} onClick={() => onSelect(photo)}><img src={photo.media.url} alt="" loading="lazy" /></button>)}</div> : <p className="muted existing-photo-state">{t('photosEmpty')}</p>}</section></div>
}

function ProfileStoryTile({ story, onOpen }: { story: GatewayStory; onOpen: () => void }) {
  const media = storyMedia(story)
  const decoded = story.__typename === 'NormalStory' ? decodeStoryContent(story.content) : null
  return <button type="button" onClick={onOpen}>
    {story.__typename !== 'NormalStory'
      ? <SharedStoryMiniPreview source={story.sharedSource} />
      : media
        ? <><StoryMediaPreview type={media.type} url={media.url} />{decoded?.text && <p className="home-story-caption-preview">{decoded.text}</p>}</>
        : <span className="story-text-preview" style={{ backgroundColor: decoded?.backgroundColor }}>{decoded?.text}</span>}
  </button>
}

function ProfileActions({ profile, relationship, loading, busyAction, onFriend, onFollow, onBlock, onMessage }: { profile: SocialProfile; relationship: ProfileRelationshipState; loading: boolean; busyAction: string | null; onFriend: (action: 'send' | 'cancel' | 'accept' | 'reject' | 'unfriend') => void; onFollow: () => void; onBlock: () => void; onMessage: () => void }) {
  const { t } = useI18n()
  const [menu, setMenu] = useState<'following' | 'friend' | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  useEffect(() => { setMenu(null); setMenuAnchor(null) }, [profile.id, relationship.friendship, relationship.isBlocked, relationship.isFollowing])

  if (loading) return <div className="self-profile-header-actions visitor-profile-header-actions"><span className="spinner" /></div>
  if (relationship.isBlocked || relationship.isBlockedBy) return <div className="self-profile-header-actions visitor-profile-header-actions"><span className="role-pill muted-pill">{t('profileRestricted')}</span></div>

  const busy = busyAction != null
  const followEnabled = profile.privacy === 1
  const messageIsPrimary = relationship.isFollowing || relationship.friendship !== 'none'

  const closeMenu = () => { setMenu(null); setMenuAnchor(null) }
  const relationshipMenu = (kind: 'following' | 'friend') => <AnchoredMenuPortal anchor={menuAnchor} className="visitor-profile-action-menu" onRequestClose={closeMenu}>
    <button type="button" role="menuitem" disabled={busy} onClick={() => {
      closeMenu()
      if (kind === 'following') onFollow()
      else onFriend('unfriend')
    }}><Icon name="userMinus" size={18} />{t(kind === 'following' ? 'profileUnfollow' : 'removeFriend')}</button>
    <button type="button" role="menuitem" disabled={busy} onClick={() => { closeMenu(); onBlock() }}><Icon name="block" size={18} />{t('block')}</button>
  </AnchoredMenuPortal>

  return <div className="self-profile-header-actions visitor-profile-header-actions">
    {followEnabled && relationship.friendship !== 'friend' && (relationship.isFollowing
      ? <div className="visitor-profile-action-menu-host" data-profile-relationship-menu>
        <button type="button" className="btn-soft" aria-haspopup="menu" aria-expanded={menu === 'following'} disabled={busy} onClick={(event) => { const nextOpen = menu !== 'following'; setMenu(nextOpen ? 'following' : null); setMenuAnchor(nextOpen ? event.currentTarget : null) }}><Icon name="bell" size={16} />{t('following')}</button>
        {menu === 'following' && relationshipMenu('following')}
      </div>
      : <button type="button" className="btn-primary" disabled={busy} onClick={onFollow}><Icon name="bell" size={16} />{t('follow')}</button>)}

    {relationship.friendship === 'none' && <button type="button" className="btn-primary" disabled={busy} onClick={() => onFriend('send')}><Icon name="userPlus" size={17} />{t('profileAddFriend')}</button>}
    {relationship.friendship === 'outgoing' && <button type="button" className="btn-soft" disabled={busy} onClick={() => onFriend('cancel')}><ProfileCancelRequestIcon />{t('profileCancelRequest')}</button>}
    {relationship.friendship === 'incoming' && <>
      <button type="button" className="btn-primary" disabled={busy} onClick={() => onFriend('accept')}><ProfileFriendStatusIcon />{t('confirm')}</button>
      <button type="button" className="btn-soft" disabled={busy} onClick={() => onFriend('reject')}>{t('decline')}</button>
    </>}
    {relationship.friendship === 'friend' && <div className="visitor-profile-action-menu-host" data-profile-relationship-menu>
      <button type="button" className="btn-soft" aria-haspopup="menu" aria-expanded={menu === 'friend'} disabled={busy} onClick={(event) => { const nextOpen = menu !== 'friend'; setMenu(nextOpen ? 'friend' : null); setMenuAnchor(nextOpen ? event.currentTarget : null) }}><ProfileFriendStatusIcon />{t('profileFriendsButton')}</button>
      {menu === 'friend' && relationshipMenu('friend')}
    </div>}

    <button type="button" className={messageIsPrimary ? 'btn-primary' : 'btn-soft'} disabled={busy} onClick={onMessage}><Icon name="messenger" size={17} />{t('messageUser')}</button>
  </div>
}

function ProfileMoreActions({ relationship, busyAction, onBlock }: { relationship: ProfileRelationshipState; busyAction: string | null; onBlock: () => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => setOpen(false), [relationship.isBlocked])

  return <div className="visitor-profile-tab-menu">
    <button ref={buttonRef} type="button" className="self-profile-tab-more" aria-label={t('more')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}><Icon name="more" size={20} /></button>
    {open && <AnchoredMenuPortal anchor={buttonRef.current} className="visitor-profile-tab-menu-popover" onRequestClose={() => setOpen(false)}><button type="button" role="menuitem" disabled={busyAction != null || relationship.isBlockedBy} onClick={() => { setOpen(false); onBlock() }}><Icon name="block" size={18} />{t(relationship.isBlocked ? 'unblock' : 'block')}</button></AnchoredMenuPortal>}
  </div>
}
