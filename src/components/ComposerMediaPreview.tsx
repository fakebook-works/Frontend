import { useI18n } from '../i18n'
import { Icon } from './Icon'

interface ComposerMediaFile {
  file: File
  previewUrl: string
}

function fileIdentity(file: File) {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`
}

export default function ComposerMediaPreview({ items, fileKey, busy, onReplace, onClear }: { items: ComposerMediaFile[]; fileKey: number; busy: boolean; onReplace: (files: FileList | null) => void; onClear: () => void }) {
  const { t } = useI18n()
  const visibleItems = items.slice(0, 5)
  const layoutCount = Math.min(items.length, 5)
  return <section className={`home-media-preview media-count-${layoutCount}`} aria-label={t('mediaPreview')}>
    <div className="home-media-preview-controls">
      <label className="home-media-edit-all"><Icon name="edit" size={17} /><span>{items.length === 1 ? t('editMedia') : t('editAllMedia')}</span><input key={`edit-${fileKey}`} disabled={busy} type="file" multiple accept="image/*,video/*" onChange={(event) => onReplace(event.target.files)} /></label>
      <button type="button" disabled={busy} aria-label={t('removeMedia')} title={t('removeMedia')} onClick={onClear}><Icon name="close" size={19} /></button>
    </div>
    <div className="home-media-grid">
      {visibleItems.map((item, index) => <figure className={`home-media-slot media-slot-${index + 1}`} key={fileIdentity(item.file)}>
        {item.previewUrl ? item.file.type.startsWith('video/')
          ? <video src={item.previewUrl} muted playsInline preload="metadata" />
          : <img src={item.previewUrl} alt="" />
          : <span className="home-media-file-fallback"><Icon name={item.file.type.startsWith('video/') ? 'video' : 'photo'} size={30} /><small>{item.file.name}</small></span>}
        {index === 4 && items.length > 5 && <span className="home-media-more">+{items.length - 5}</span>}
      </figure>)}
    </div>
  </section>
}
