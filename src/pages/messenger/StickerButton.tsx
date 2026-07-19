import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { useI18n } from '../../i18n'

const QUICK_STICKERS = ['😀', '😂', '🥰', '😮', '😢', '😡', '👍', '❤️', '🔥', '🎉', '✨', '💯']

interface StickerButtonProps {
  onPick: (sticker: string) => void
  disabled?: boolean
}

export function StickerButton({ onPick, disabled = false }: StickerButtonProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return <div className="mini-sticker-wrap" ref={ref}>
    <button
      type="button"
      className="mini-compose-btn"
      aria-label={t('stickers')}
      disabled={disabled}
      onClick={() => setOpen((current) => !current)}
    >
      <Icon name="sticker" size={21} />
    </button>
    {open && <div className="mini-sticker-picker" role="dialog" aria-label={t('stickers')}>
      {QUICK_STICKERS.map((sticker) => <button
        type="button"
        key={sticker}
        aria-label={`${t('sendSticker')} ${sticker}`}
        onClick={() => {
          onPick(sticker)
          setOpen(false)
        }}
      >
        {sticker}
      </button>)}
    </div>}
  </div>
}
