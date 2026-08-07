import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { messengerApi } from '../../api/messenger'
import { formatMediaSize, MessengerMediaImage, resolveMediaKind, mediaDisplayName } from './MediaGallery'
import type { MediaAttachment } from './MediaGallery'
import { useI18n } from '../../i18n'

interface ConversationMediaBrowserProps {
  conversationId: string
  activeTab: 'media' | 'files' | 'links'
  onClose: () => void
  onTabChange: (tab: 'media' | 'files' | 'links') => void
}

export function ConversationMediaBrowser({ conversationId, activeTab, onClose, onTabChange }: ConversationMediaBrowserProps) {
  const { t } = useI18n()
  const [media, setMedia] = useState<MediaAttachment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    messengerApi.conversationMedia(conversationId)
      .then((items) => {
        if (active) {
          setMedia(items as MediaAttachment[])
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [conversationId])

  const mediaItems = media.filter(item => {
    const kind = resolveMediaKind(item)
    return kind === 'image' || kind === 'video'
  })
  
  const fileItems = media.filter(item => {
    const kind = resolveMediaKind(item)
    return kind === 'file' || kind === 'audio'
  })

  // We are asked to have a Links tab, we will filter any message body that has links or maybe media has links?
  // Let's assume the API returns link items with type 'link' or we extract them. For now, we will just filter by type === 'link'
  const linkItems = media.filter(item => item.type === 'link')

  return (
    <aside className="messenger-media-browser">
      <header className="media-browser-header">
        <button type="button" onClick={onClose} aria-label={t('back')}>
          <Icon name="back" size={24} />
        </button>
        <h2>File phương tiện, file và liên kết</h2>
      </header>

      <div className="media-browser-tabs">
        <button type="button" className={activeTab === 'media' ? 'active' : ''} onClick={() => onTabChange('media')}>
          File phương tiện
        </button>
        <button type="button" className={activeTab === 'files' ? 'active' : ''} onClick={() => onTabChange('files')}>
          File
        </button>
        <button type="button" className={activeTab === 'links' ? 'active' : ''} onClick={() => onTabChange('links')}>
          Liên kết
        </button>
      </div>

      <div className="media-browser-content">
        {loading ? (
          <div className="messenger-loading"><span className="spinner" /></div>
        ) : activeTab === 'media' ? (
          mediaItems.length > 0 ? (
            <div className="media-browser-grid">
              {mediaItems.map((item, i) => (
                <div key={`${item.url}-${i}`} className="media-browser-grid-item">
                  <MessengerMediaImage attachment={item} alt={mediaDisplayName(item)} />
                  {resolveMediaKind(item) === 'video' && (
                    <span className="media-browser-video-icon"><Icon name="play" size={16} /></span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="media-browser-empty">Không có file phương tiện nào</p>
          )
        ) : activeTab === 'files' ? (
          fileItems.length > 0 ? (
            <div className="media-browser-list">
              {fileItems.map((item, i) => (
                <a key={`${item.url}-${i}`} href={item.url} target="_blank" rel="noreferrer" className="media-browser-list-item">
                  <div className="media-browser-icon-container">
                    <Icon name="bookmark" size={24} />
                  </div>
                  <div className="media-browser-item-info">
                    <strong>{mediaDisplayName(item)}</strong>
                    <small>{formatMediaSize(item.size ?? item.sizeBytes)}</small>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="media-browser-empty">Không có file nào</p>
          )
        ) : (
          linkItems.length > 0 ? (
            <div className="media-browser-list">
              {linkItems.map((item, i) => (
                <a key={`${item.url}-${i}`} href={item.url} target="_blank" rel="noreferrer" className="media-browser-list-item">
                  <div className="media-browser-icon-container">
                    <Icon name="link" size={24} />
                  </div>
                  <div className="media-browser-item-info">
                    <strong>{item.name || item.url}</strong>
                    <small>{new URL(item.url).hostname}</small>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="media-browser-empty">Không có liên kết nào</p>
          )
        )}
      </div>
    </aside>
  )
}
