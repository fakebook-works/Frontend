import { useEffect } from 'react'
import { useI18n } from '../i18n'
import { BodyPortal } from './BodyPortal'
import { Icon } from './Icon'

export function CreatorModalLoadingFallback({ kind, onClose }: { kind: 'reel' | 'story'; onClose: () => void }) {
  const { t } = useI18n()

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const backdropClass = kind === 'story'
    ? 'modal-backdrop story-creator-loading-backdrop creator-modal-loading-backdrop'
    : 'modal-backdrop reel-composer-backdrop creator-modal-loading-backdrop'

  return <BodyPortal><div className={backdropClass} role="presentation" onClick={onClose}>
    <button type="button" className="icon-circle creator-modal-loading-close" aria-label={t('close')} onClick={(event) => { event.stopPropagation(); onClose() }}><Icon name="close" size={20} /></button>
    <span className="spinner" />
  </div></BodyPortal>
}
