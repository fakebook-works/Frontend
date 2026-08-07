import { createPortal } from 'react-dom'
import { useI18n } from '../i18n'
import { Icon } from './Icon'

export const CONTENT_DETAIL_SHELL_CLOSE_TARGET_ID = 'content-detail-shell-close-target'

export function ContentDetailShellClose({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const button = <button type="button" className="content-detail-shell-close" aria-label={t('close')} onClick={onClose}><Icon name="close" size={24} /></button>
  const target = typeof document === 'undefined'
    ? null
    : document.getElementById(CONTENT_DETAIL_SHELL_CLOSE_TARGET_ID) ?? document.body

  return target ? createPortal(button, target) : button
}
