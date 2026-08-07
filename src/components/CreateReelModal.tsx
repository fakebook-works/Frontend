import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api/client'
import type { GatewayPost } from '../api/gatewayTypes'
import type { MediaUpload } from '../api/types'
import { socialApi } from '../api/social'
import { useI18n } from '../i18n'
import { clampReelFocalPoint, MAX_REEL_ASPECT_RATIO, MAX_REEL_BYTES, MIN_REEL_ASPECT_RATIO, ratioFromSlider, sliderFromRatio } from '../lib/reelPresentation'
import { cropReelVideoFile, ReelCropError } from '../lib/reelCrop'
import { Avatar } from './Avatar'
import { BodyPortal } from './BodyPortal'
import { Icon, ReelIcon } from './Icon'
import { PostPrivacyIcon, type PostPrivacy } from './PostPrivacyIcon'
import { PostVideoPlayer } from './PostVideoPlayer'
import { VerifiedBadge } from './VerifiedBadge'

function ratioLabel(value: number) {
  if (Math.abs(value - MAX_REEL_ASPECT_RATIO) < 0.02) return '16:9'
  if (Math.abs(value - MIN_REEL_ASPECT_RATIO) < 0.02) return '9:16'
  if (Math.abs(value - 1) < 0.02) return '1:1'
  return `${value.toFixed(2)}:1`
}

function isVideoFile(file: File) {
  return file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(file.name)
}

function PrivacyCaret() {
  return <svg className="reel-composer-privacy-caret" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7.2 9.2h9.6c.75 0 1.15.88.64 1.44l-4.72 5.18c-.38.42-1.06.42-1.44 0l-4.72-5.18C6.05 10.08 6.45 9.2 7.2 9.2Z" /></svg>
}

interface CreateReelModalProps {
  userId: string
  displayName: string
  avatarUrl: string | null
  isVerified?: boolean
  onClose: () => void
  onCreated: (post: GatewayPost) => void
}

export default function CreateReelModal({ userId, displayName, avatarUrl, isVerified, onClose, onCreated }: CreateReelModalProps) {
  const { t } = useI18n()
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [sourceRatio, setSourceRatio] = useState<number | null>(null)
  const [cropSlider, setCropSlider] = useState(0)
  const [focalPointX, setFocalPointX] = useState(0.5)
  const [focalPointY, setFocalPointY] = useState(0.5)
  const [cropDragging, setCropDragging] = useState(false)
  const [privacy, setPrivacy] = useState<PostPrivacy>(0)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const privacyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const previewFrameRef = useRef<HTMLDivElement>(null)
  const cropDragRef = useRef<{ pointerId: number; startClientX: number; startClientY: number; startFocalX: number; startFocalY: number; overflowX: number; overflowY: number; moved: boolean } | null>(null)
  const suppressPreviewClickRef = useRef(false)
  const aspectRatio = useMemo(() => ratioFromSlider(cropSlider), [cropSlider])
  const privacyOptions: Array<{ value: PostPrivacy; label: string }> = [
    { value: 0, label: t('privacyPublic') },
    { value: 1, label: t('privacyFriendsFollowers') },
    { value: 2, label: t('privacyFriends') },
    { value: 3, label: t('privacyOnlyMe') },
  ]
  const privacyLabel = privacyOptions.find((option) => option.value === privacy)?.label ?? t('privacyPublic')

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!privacyRef.current?.contains(event.target as Node)) setPrivacyOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (privacyOpen) setPrivacyOpen(false)
      else if (!busy) onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [busy, onClose, privacyOpen])

  function chooseFile(nextFile: File | null) {
    setError(null)
    if (!nextFile) return
    if (!isVideoFile(nextFile)) {
      setError(t('reelVideoOnly'))
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    if (nextFile.size > MAX_REEL_BYTES) {
      setError(t('reelVideoTooLarge'))
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(nextFile)
    setPreviewUrl(URL.createObjectURL(nextFile))
    setSourceRatio(null)
    setCropSlider(0)
    setFocalPointX(0.5)
    setFocalPointY(0.5)
  }

  function beginCropDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!previewUrl || !sourceRatio || busy || event.button !== 0) return
    if ((event.target as Element).closest('.post-video-controls')) return
    const frame = previewFrameRef.current
    if (!frame) return
    const rect = frame.getBoundingClientRect()
    const renderedWidth = sourceRatio > aspectRatio ? rect.height * sourceRatio : rect.width
    const renderedHeight = sourceRatio < aspectRatio ? rect.width / sourceRatio : rect.height
    const overflowX = Math.max(0, renderedWidth - rect.width)
    const overflowY = Math.max(0, renderedHeight - rect.height)
    if (overflowX < 0.5 && overflowY < 0.5) return
    frame.setPointerCapture?.(event.pointerId)
    cropDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFocalX: focalPointX,
      startFocalY: focalPointY,
      overflowX,
      overflowY,
      moved: false,
    }
    setCropDragging(true)
    event.preventDefault()
  }

  function moveCrop(event: React.PointerEvent<HTMLDivElement>) {
    const drag = cropDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const deltaX = event.clientX - drag.startClientX
    const deltaY = event.clientY - drag.startClientY
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) drag.moved = true
    if (drag.overflowX >= 0.5) setFocalPointX(clampReelFocalPoint(drag.startFocalX - (deltaX / drag.overflowX)))
    if (drag.overflowY >= 0.5) setFocalPointY(clampReelFocalPoint(drag.startFocalY - (deltaY / drag.overflowY)))
    event.preventDefault()
  }

  function endCropDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = cropDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    suppressPreviewClickRef.current = drag.moved
    cropDragRef.current = null
    previewFrameRef.current?.releasePointerCapture?.(event.pointerId)
    setCropDragging(false)
    if (drag.moved) window.setTimeout(() => { suppressPreviewClickRef.current = false }, 0)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!file || busy) return
    setBusy(true)
    setError(null)
    let uploaded: MediaUpload | null = null
    let persisted = false
    try {
      // Export the selected frame before uploading.  The backend still receives
      // the normal authenticated Upload Server request, but it now receives a
      // real cropped video instead of the original file plus display metadata.
      const croppedFile = await cropReelVideoFile(file, { aspectRatio, focalPointX, focalPointY })
      uploaded = await api.uploadMedia(croppedFile)
      const created = await socialApi.createReel(userId, {
        content: content.trim(),
        privacy,
        aspectRatio,
        focalPointX,
        focalPointY,
        media: { type: 1, url: uploaded.url },
      })
      persisted = true
      const optimisticPost: GatewayPost = {
        __typename: 'ReelDetail',
        id: created.id,
        type: created.type || 4,
        content: created.content,
        privacy,
        create: created.createdAt || new Date().toISOString(),
        aspectRatio,
        focalPointX,
        focalPointY,
        author: {
          id: userId,
          name: displayName,
          avatar: avatarUrl ?? '',
          isVerified: Boolean(isVerified),
          canFollow: false,
        },
        media: created.media.length > 0 ? created.media : [{
          id: uploaded.assetId ?? `${created.id}-media`,
          type: 1,
          url: uploaded.url,
        }],
        mentions: [],
      }
      let hydrated: GatewayPost | null = null
      try {
        hydrated = await api.postDetail(created.id)
      } catch {
        // Publishing succeeded. A temporarily lagging read model must not invite a duplicate Reel.
      }
      onCreated(hydrated?.__typename === 'ReelDetail'
        ? {
            ...hydrated,
            aspectRatio: hydrated.aspectRatio ?? aspectRatio,
            focalPointX: hydrated.focalPointX ?? focalPointX,
            focalPointY: hydrated.focalPointY ?? focalPointY,
          }
        : optimisticPost)
      onClose()
    } catch (caught) {
      if (!persisted && uploaded) await Promise.allSettled([api.cancelPendingMedia(uploaded)])
      setError(caught instanceof ReelCropError && caught.code === 'unsupported'
        ? t('reelCropUnsupported')
        : t('createReelError'))
    } finally {
      setBusy(false)
    }
  }

  return <BodyPortal><div className="modal-backdrop reel-composer-backdrop" role="presentation" onClick={() => !busy && onClose()}>
    <form className="modal reel-composer-modal" role="dialog" aria-modal="true" aria-label={t('createReel')} onSubmit={submit} onClick={(event) => event.stopPropagation()}>
      <header className="modal-head reel-composer-head">
        <h2>{t('createReel')}</h2>
        <button type="button" className="icon-circle" aria-label={t('close')} disabled={busy} onClick={onClose}><Icon name="close" size={20} /></button>
      </header>
      <div className="reel-composer-layout">
        <section className="reel-composer-panel" aria-label={t('reelComposerSettings')}>
          <div className="reel-composer-author">
            <Avatar name={displayName} src={avatarUrl} size={42} />
            <div><strong>{displayName}<VerifiedBadge verified={isVerified} size={13} /></strong><span>{t('reelComposerAuthorHelp')}</span></div>
          </div>

          <label className={file ? 'reel-video-picker selected' : 'reel-video-picker'}>
            <span className="reel-video-picker-icon"><ReelIcon size={27} filled /></span>
            <span><strong>{file ? t('reelReplaceVideo') : t('chooseReelVideo')}</strong><small>{file?.name ?? t('reelVideoRequirements')}</small></span>
            <input ref={inputRef} type="file" accept="video/*,.mp4,.mov,.m4v,.webm" disabled={busy} onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
          </label>

          <label className="reel-caption-field">
            <span>{t('caption')}</span>
            <textarea rows={5} maxLength={5000} value={content} disabled={busy} placeholder={t('reelCaptionPlaceholder')} onChange={(event) => setContent(event.target.value)} />
            <small>{content.length}/5000</small>
          </label>

          <div className="reel-privacy-field" ref={privacyRef}>
            <span>{t('privacy')}</span>
            <button type="button" className="reel-privacy-control" aria-haspopup="listbox" aria-expanded={privacyOpen} disabled={busy} onClick={() => setPrivacyOpen((current) => !current)}><PostPrivacyIcon privacy={privacy} size={18} /><span>{privacyLabel}</span><PrivacyCaret /></button>
            {privacyOpen && <div className="reel-privacy-menu" role="listbox" aria-label={t('privacy')}>{privacyOptions.map((option) => <button key={option.value} type="button" role="option" aria-selected={privacy === option.value} onClick={() => { setPrivacy(option.value); setPrivacyOpen(false) }}><PostPrivacyIcon privacy={option.value} size={19} /><span>{option.label}</span></button>)}</div>}
          </div>

          {error && <p className="form-error reel-composer-error">{error}</p>}
          <button className="btn-primary reel-publish-button" type="submit" disabled={busy || !file}>{busy ? t('posting') : t('publish')}</button>
        </section>

        <section className="reel-preview-panel" aria-label={t('reelPreview')}>
          <div className="reel-preview-heading"><div><strong>{t('reelPreview')}</strong><span>{ratioLabel(aspectRatio)}</span></div>{sourceRatio && <small>{t('reelSourceRatio', { ratio: ratioLabel(sourceRatio) })}</small>}</div>
          <div className="reel-preview-stage">
            <div ref={previewFrameRef} className={`${previewUrl ? 'reel-preview-frame has-video' : 'reel-preview-frame'}${cropDragging ? ' crop-dragging' : ''}`} style={{ aspectRatio: String(aspectRatio) }} onPointerDown={beginCropDrag} onPointerMove={moveCrop} onPointerUp={endCropDrag} onPointerCancel={endCropDrag} onClickCapture={(event) => { if (suppressPreviewClickRef.current) { event.preventDefault(); event.stopPropagation() } }}>
              {previewUrl
                ? <PostVideoPlayer src={previewUrl} autoPlay={false} controlVariant="compact" displayAspectRatio={aspectRatio} objectPosition={`${focalPointX * 100}% ${focalPointY * 100}%`} onLoadedMetadata={(width, height) => { if (height <= 0) return; const ratio = width / height; setSourceRatio(ratio); setCropSlider(sliderFromRatio(ratio)); setFocalPointX(0.5); setFocalPointY(0.5) }} />
                : <div className="reel-preview-empty"><ReelIcon size={56} filled /><strong>{t('reelPreviewEmpty')}</strong><span>{t('reelPreviewEmptyHelp')}</span></div>}
            </div>
          </div>
          <div className="reel-ratio-control">
            <div className="reel-ratio-labels"><span>{t('reelLandscape')}<small>16:9</small></span><strong>{t('reelFrame')}</strong><span>{t('reelPortrait')}<small>9:16</small></span></div>
            <input type="range" min="0" max="100" step="0.01" value={cropSlider} disabled={busy} aria-label={t('reelFrame')} style={{ '--reel-ratio-progress': `${cropSlider}%` } as React.CSSProperties} onChange={(event) => setCropSlider(Number(event.target.value))} />
          </div>
        </section>
      </div>
    </form>
  </div></BodyPortal>
}
