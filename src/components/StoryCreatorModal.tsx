import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api/client'
import type { NormalStory } from '../api/gatewayTypes'
import type { MediaUpload } from '../api/types'
import { useI18n } from '../i18n'
import { Icon } from './Icon'
import './StoryCreatorModal.css'

interface StoryCreatorModalProps {
  open: boolean
  authorId: string
  onClose: () => void
  onCreated: (story: NormalStory) => Promise<void> | void
}

function mediaType(type: 'image' | 'video') {
  return type === 'video' ? 1 : 0
}

function createPreviewUrl(file: File) {
  try {
    return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : ''
  } catch {
    return ''
  }
}

export function StoryCreatorModal({ open, authorId, onClose, onCreated }: StoryCreatorModalProps) {
  const { t } = useI18n()
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return
    }
    const nextUrl = createPreviewUrl(file)
    setPreviewUrl(nextUrl)
    return () => {
      if (nextUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(nextUrl)
    }
  }, [file])

  useEffect(() => {
    if (!open) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [busy, onClose, open])

  useEffect(() => {
    if (open) return
    setContent('')
    setFile(null)
    setZoom(1)
    setRotation(0)
    setError(null)
  }, [open])

  if (!open) return null

  function chooseFile(next: File | null) {
    if (!next) return
    setFile(next)
    setZoom(1)
    setRotation(0)
    setError(null)
  }

  function clearMedia() {
    setFile(null)
    setZoom(1)
    setRotation(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function publish(event: FormEvent) {
    event.preventDefault()
    if (!content.trim() && !file) return
    setBusy(true)
    setError(null)
    let upload: MediaUpload | null = null
    let persisted = false
    try {
      upload = file ? await api.uploadMedia(file) : null
      const created = await api.createNormalStory({
        authorId,
        content: content.trim(),
        media: upload ? { type: mediaType(upload.type), url: upload.url } : null,
      })
      persisted = true
      await onCreated(created)
      onClose()
    } catch {
      if (!persisted && upload) await Promise.allSettled([api.cancelPendingMedia(upload)])
      setError(t('storyPublishError'))
    } finally {
      setBusy(false)
    }
  }

  const transform = `scale(${zoom}) rotate(${rotation}deg)`
  const isVideo = file?.type.startsWith('video/') ?? false

  return <div className="story-creator-backdrop" role="presentation" onMouseDown={() => !busy && onClose()}>
    <form className="story-creator-dialog" role="dialog" aria-modal="true" aria-label={t('storyCreate')} onSubmit={publish} onMouseDown={(event) => event.stopPropagation()}>
      <header className="story-creator-head">
        <div>
          <h2>{t('storyCreate')}</h2>
          <p>{t('storyEditorHint')}</p>
        </div>
        <button type="button" className="icon-circle" aria-label={t('close')} disabled={busy} onClick={onClose}><Icon name="close" /></button>
      </header>

      <div className="story-creator-body">
        <h3>{t('storyPreview')}</h3>
        <div className="story-editor-workspace">
          <div className={`story-editor-canvas${file ? ' has-media' : ' text-only'}`}>
            {file && previewUrl && (isVideo
              ? <video src={previewUrl} muted loop autoPlay playsInline style={{ transform }} />
              : <img src={previewUrl} alt="" style={{ transform }} />)}
            {!file && <div className="story-editor-gradient" />}
            <textarea
              autoFocus
              value={content}
              onChange={(event) => setContent(event.target.value)}
              aria-label={t('storyPrompt')}
              placeholder={t('storyPrompt')}
              maxLength={500}
            />
          </div>

          <div className="story-editor-controls" aria-label={t('zoom')}>
            <button type="button" aria-label={t('storyZoomOut')} disabled={!file || busy || zoom <= .65} onClick={() => setZoom((value) => Math.max(.65, Number((value - .1).toFixed(2))))}>−</button>
            <input aria-label={t('zoom')} type="range" min="0.65" max="2.5" step="0.05" value={zoom} disabled={!file || busy} onChange={(event) => setZoom(Number(event.target.value))} />
            <button type="button" aria-label={t('storyZoomIn')} disabled={!file || busy || zoom >= 2.5} onClick={() => setZoom((value) => Math.min(2.5, Number((value + .1).toFixed(2))))}>+</button>
            <button type="button" className="story-rotate-button" disabled={!file || busy} onClick={() => setRotation((value) => (value + 90) % 360)}><span aria-hidden="true">↻</span>{t('storyRotate')}</button>
          </div>
        </div>
      </div>

      <footer className="story-creator-foot">
        <div className="story-media-actions">
          <label htmlFor={inputId} className="btn-soft"><Icon name="photo" size={18} />{file ? t('storyReplaceMedia') : t('storyChooseMedia')}</label>
          <input ref={fileInputRef} id={inputId} type="file" accept="image/*,video/*" disabled={busy} onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
          {file && <button type="button" className="btn-soft danger-text" disabled={busy} onClick={clearMedia}><Icon name="trash" size={17} />{t('removeMedia')}</button>}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn-primary story-publish-button" disabled={busy || (!content.trim() && !file)}>{busy ? t('posting') : t('publishStory')}</button>
      </footer>
    </form>
  </div>
}

export default StoryCreatorModal
