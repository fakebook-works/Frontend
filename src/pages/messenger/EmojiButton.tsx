import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥', '🎉', '✨', '💯']

interface EmojiButtonProps {
  onPick: (emoji: string) => void
}

export function EmojiButton({ onPick }: EmojiButtonProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="msg-emoji-wrap" ref={ref}>
      <button type="button" className="icon-circle subtle" aria-label="Emoji" onClick={() => setOpen((o) => !o)}>
        <Icon name="feeling" size={21} />
      </button>
      {open && (
        <div className="msg-emoji-picker">
          {QUICK_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onPick(e)
                setOpen(false)
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
