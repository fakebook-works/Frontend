import { useI18n } from '../i18n'
import { getAdaptiveMediaLayout, getSingleMediaPresentation } from '../lib/mediaLayout'
import { useMediaDimensions } from '../lib/useMediaDimensions'
import { Icon } from './Icon'

interface ComposerMediaFile {
  file: File
  previewUrl: string
}

function fileIdentity(file: File) {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`
}

export default function ComposerMediaPreview({ items, busy, onClear, showClear = true }: { items: ComposerMediaFile[]; fileKey: number; busy: boolean; onReplace: (files: FileList | null) => void; onClear: () => void; showClear?: boolean }) {
  const { t } = useI18n()
  const visibleItems = items.slice(0, 5)
  const layoutCount = Math.min(items.length, 5)
  const mediaKeys = visibleItems.map((item) => fileIdentity(item.file))
  const { dimensions, rememberDimensions } = useMediaDimensions(mediaKeys)
  const layout = getAdaptiveMediaLayout(dimensions, items.length)
  const singlePresentation = getSingleMediaPresentation(dimensions[0])
  return <section className={`home-media-preview media-count-${layoutCount} layout-${layout.kind}${layoutCount === 1 && singlePresentation.needsBackdrop ? ' letterboxed' : ''}`} style={layoutCount === 1 ? { aspectRatio: String(singlePresentation.frameAspectRatio) } : undefined} aria-label={t('mediaPreview')}>
    {showClear && <div className="home-media-preview-controls">
      <button type="button" disabled={busy} aria-label={t('removeMedia')} title={t('removeMedia')} onClick={onClear}><Icon name="close" size={18} /></button>
    </div>}
    <div className={`home-media-grid adaptive-media-layout layout-${layout.kind}`}>
      {visibleItems.map((item, index) => {
        const key = mediaKeys[index]
        const isVideo = item.file.type.startsWith('video/')
        const letterboxed = layoutCount === 1 && singlePresentation.needsBackdrop
        return <figure className={`home-media-slot media-slot-${index + 1}${letterboxed ? ' letterboxed' : ''}`} key={key}>
        {letterboxed && item.previewUrl && !isVideo && <img className="home-media-backdrop" src={item.previewUrl} alt="" aria-hidden="true" />}
        {item.previewUrl ? isVideo
          ? <video className="home-media-content" src={item.previewUrl} muted playsInline preload="metadata" onLoadedMetadata={(event) => rememberDimensions(key, event.currentTarget.videoWidth, event.currentTarget.videoHeight)} />
          : <img className="home-media-content" src={item.previewUrl} alt="" onLoad={(event) => rememberDimensions(key, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} />
          : <span className="home-media-file-fallback"><Icon name={item.file.type.startsWith('video/') ? 'video' : 'photo'} size={30} /><small>{item.file.name}</small></span>}
        {index === 4 && items.length > 5 && <span className="home-media-more">+{items.length - 5}</span>}
      </figure>})}
    </div>
  </section>
}
