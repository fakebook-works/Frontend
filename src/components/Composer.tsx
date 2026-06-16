import { type ChangeEvent, useRef, useState } from 'react'
import { api } from '../api/client'
import type { MediaUpload, PostDto, UserSummary } from '../api/types'
import { firstName, PRIVACY } from '../lib/format'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { useI18n } from '../i18n'

interface ComposerProps {
  user: UserSummary
  onCreated: (post: PostDto) => void
}

export function Composer({ user, onCreated }: ComposerProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [media, setMedia] = useState<MediaUpload | null>(null)
  const [uploading, setUploading] = useState(false)
  const [privacy, setPrivacy] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  function reset() {
    setContent('')
    setMedia(null)
    setUploading(false)
    setPrivacy(0)
    setError(null)
  }

  function close() {
    if (busy || uploading) return
    setOpen(false)
    reset()
  }

  function pickFile() {
    setOpen(true)
    fileInput.current?.click()
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be re-selected later
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      setMedia(await api.uploadMedia(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('uploadFileError'))
    } finally {
      setUploading(false)
    }
  }

  async function submit() {
    const text = content.trim()
    if (!text && !media) {
      setError(t('composeNeedContent'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const created = await api.createPost({
        content: text,
        imageUrl: media?.url ?? null,
        mediaType: media?.type ?? null,
        privacy,
      })
      onCreated(created)
      setOpen(false)
      reset()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('publishPostError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card composer">
      <div className="composer-top">
        <Avatar name={user.displayName} src={user.avatarUrl} size={40} />
        <button type="button" className="composer-trigger" onClick={() => setOpen(true)}>
          {t('composePrompt', { name: firstName(user.displayName) })}
        </button>
      </div>
      <div className="composer-divider" />
      <div className="composer-shortcuts">
        <button type="button" onClick={pickFile}>
          <Icon name="video" size={22} className="ic-live" />
          <span>{t('liveVideo')}</span>
        </button>
        <button type="button" onClick={pickFile}>
          <Icon name="photo" size={22} className="ic-photo" />
          <span>{t('photoVideo')}</span>
        </button>
        <button type="button" onClick={() => setOpen(true)}>
          <Icon name="feeling" size={22} className="ic-feeling" />
          <span>{t('feelingActivity')}</span>
        </button>
      </div>

      {open && (
        <div className="modal-backdrop" role="presentation" onClick={close}>
          <div className="modal composer-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="modal-head">
              <h2>{t('createPost')}</h2>
              <button type="button" className="icon-circle subtle" onClick={close} aria-label="Close">
                <Icon name="close" size={20} />
              </button>
            </header>
            <div className="modal-body">
              <div className="composer-identity">
                <Avatar name={user.displayName} src={user.avatarUrl} size={40} />
                <div>
                  <strong>{user.displayName}</strong>
                  <label className="privacy-pill">
                    <Icon name={PRIVACY[privacy]?.icon ?? 'globe'} size={13} />
                    <select value={privacy} onChange={(e) => setPrivacy(Number(e.target.value))}>
                      {PRIVACY.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <Icon name="caret" size={13} />
                  </label>
                </div>
              </div>

              <textarea
                className="composer-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`What's on your mind, ${firstName(user.displayName)}?`}
                rows={media || uploading ? 3 : 5}
                autoFocus
              />

              <input ref={fileInput} type="file" accept="image/*,video/*" hidden onChange={onFileChange} />

              {uploading && <p className="muted small">{t('uploading')}</p>}

              {media && (
                <div className="post-media composer-preview">
                  {media.type === 'video' ? <video src={media.url} controls /> : <img src={media.url} alt="" />}
                  <button
                    type="button"
                    className="composer-media-remove"
                    onClick={() => setMedia(null)}
                    aria-label={t('removeMedia')}
                  >
                    <Icon name="close" size={18} />
                  </button>
                </div>
              )}

              <div className="composer-addrow">
                <span>Add to your post</span>
                <div className="composer-addbtns">
                  <button
                    type="button"
                    className={media ? 'on' : ''}
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                    aria-label={t('addPhotoVideo')}
                  >
                    <Icon name="photo" size={22} className="ic-photo" />
                  </button>
                  <button type="button" aria-label={t('feeling')}>
                    <Icon name="feeling" size={22} className="ic-feeling" />
                  </button>
                  <button type="button" aria-label={t('checkIn')}>
                    <Icon name="location" size={22} className="ic-location" />
                  </button>
                </div>
              </div>

              {error && <p className="form-error">{error}</p>}
            </div>
            <footer className="modal-foot">
              <button
                type="button"
                className="btn-primary block"
                onClick={submit}
                disabled={busy || uploading || (!content.trim() && !media)}
              >
                {busy ? t('posting') : t('post')}
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  )
}
