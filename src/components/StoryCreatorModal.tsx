import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, WheelEvent as ReactWheelEvent } from 'react'
import { api } from '../api/client'
import type { NormalStory } from '../api/gatewayTypes'
import type { MediaUpload } from '../api/types'
import { useI18n } from '../i18n'
import {
  DEFAULT_STORY_BACKGROUND,
  STORY_BACKGROUND_PRESETS,
  encodeStoryContent,
} from '../lib/storyContent'
import { createEditedStoryImage } from '../lib/storyImage'
import { Icon } from './Icon'
import './StoryCreatorModal.css'

interface StoryCreatorModalProps {
  open: boolean
  authorId: string
  onClose: () => void
  onCreated: (story: NormalStory) => Promise<void> | void
}

function mediaType(type: MediaUpload['type']) {
  if (type === 'audio') throw new Error('Audio is not supported in stories.')
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
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_STORY_BACKGROUND)
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
    setBackgroundColor(DEFAULT_STORY_BACKGROUND)
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

  function selectBackground(color: string) {
    setBackgroundColor(color)
    if (file) clearMedia()
  }

  function adjustZoom(delta: number) {
    setZoom((value) => Math.min(2.5, Math.max(.65, Number((value + delta).toFixed(2)))))
  }

  async function publish(event: FormEvent) {
    event.preventDefault()
    if (!content.trim() && !file) return
    setBusy(true)
    setError(null)
    let upload: MediaUpload | null = null
    let persisted = false
    try {
      const imageWasEdited = Math.abs(zoom - 1) > .001 || rotation % 360 !== 0
      const uploadFile = file && file.type.startsWith('image/') && imageWasEdited
        ? await createEditedStoryImage(file, { zoom, rotation })
        : file
      upload = uploadFile ? await api.uploadMedia(uploadFile) : null
      const created = await api.createNormalStory({
        authorId,
        content: file ? content.trim() : encodeStoryContent(content, backgroundColor),
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
  const canEditImage = Boolean(file && !isVideo)

  function handleZoomWheel(event: ReactWheelEvent<HTMLElement>) {
    if (!canEditImage || busy || event.deltaY === 0) return
    event.preventDefault()
    adjustZoom(event.deltaY < 0 ? .1 : -.1)
  }

  return <div className="story-creator-backdrop" role="presentation" onMouseDown={() => !busy && onClose()}>
    <form className="story-creator-dialog" role="dialog" aria-modal="true" aria-label={t('storyCreate')} onSubmit={publish} onMouseDown={(event) => event.stopPropagation()}>
      <header className="story-creator-head">
        <h2>{t('storyCreate')}</h2>
        <button type="button" className="icon-circle" aria-label={t('close')} disabled={busy} onClick={onClose}><Icon name="close" /></button>
      </header>

      <div className="story-creator-body">
        <div className="story-editor-layout">
          <aside className="story-editor-left-tools">
            <fieldset className="story-background-picker">
              <legend>{t('storyBackground')}</legend>
              <div>
                {STORY_BACKGROUND_PRESETS.map((preset, index) => <button
                  key={preset.id}
                  type="button"
                  className={!file && backgroundColor === preset.color ? 'selected' : ''}
                  style={{ backgroundColor: preset.color }}
                  aria-label={`${t('storyBackground')} ${index + 1}`}
                  aria-pressed={!file && backgroundColor === preset.color}
                  disabled={busy}
                  onClick={() => selectBackground(preset.color)}
                />)}
              </div>
            </fieldset>

            <label htmlFor={inputId} className={`story-media-tool${file ? ' selected' : ''}${busy ? ' disabled' : ''}`} title={t('storyChooseMedia')}>
              <span className="story-tool-icon"><Icon name="photo" size={23} /></span>
              {file && <span className="story-media-selected"><Icon name="check" size={12} /></span>}
              <input ref={fileInputRef} id={inputId} type="file" accept="image/*,video/*" aria-label={t('storyChooseMedia')} disabled={busy} onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
            </label>
          </aside>

          <section className="story-editor-preview-column" aria-label={t('storyPreview')}>
            <div
              className={`story-editor-canvas${file ? ' has-media' : ' text-only'}`}
              style={!file ? { backgroundColor } : undefined}
              onWheel={handleZoomWheel}
            >
              {file && previewUrl && <span className="story-editor-media-backdrop" aria-hidden="true">{isVideo
                ? <video src={previewUrl} muted loop autoPlay playsInline />
                : <img src={previewUrl} alt="" />}</span>}
              {file && previewUrl && (isVideo
                ? <video className="story-editor-media-foreground" src={previewUrl} muted loop autoPlay playsInline />
                : <img className="story-editor-media-foreground" src={previewUrl} alt="" style={{ transform }} />)}
              <textarea
                autoFocus
                value={content}
                onChange={(event) => setContent(event.target.value)}
                aria-label={t('storyPrompt')}
                placeholder={t('storyPrompt')}
                maxLength={500}
              />
            </div>
          </section>

          <aside className="story-editor-right-tools" aria-label={canEditImage ? t('zoom') : undefined} onWheel={handleZoomWheel}>
            {canEditImage && <>
              <button type="button" aria-label={t('storyZoomIn')} disabled={busy || zoom >= 2.5} onClick={() => adjustZoom(.1)}>+</button>
              <input className="story-zoom-slider" aria-label={t('zoom')} type="range" min="0.65" max="2.5" step="0.05" value={zoom} disabled={busy} onChange={(event) => setZoom(Number(event.target.value))} />
              <button type="button" aria-label={t('storyZoomOut')} disabled={busy || zoom <= .65} onClick={() => adjustZoom(-.1)}>-</button>
              <button type="button" className="story-rotate-button" aria-label={t('storyRotate')} disabled={busy} onClick={() => setRotation((value) => (value + 90) % 360)}>
                <span className="story-rotate-glyph" aria-hidden="true" />
              </button>
            </>}
          </aside>
        </div>
      </div>

      <footer className="story-creator-foot">
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn-primary story-publish-button" disabled={busy || (!content.trim() && !file)}>{busy ? t('posting') : t('publishStory')}</button>
      </footer>
    </form>
  </div>
}

export default StoryCreatorModal
