import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n'
import { HoverTooltip } from './HoverTooltip'
import { PostPrivacyIcon, type PostPrivacy } from './PostPrivacyIcon'

export interface PostPrivacyOption {
  value: PostPrivacy
  label: string
}

export function PostPrivacyControl({ privacy, label, options, busy, onSelect }: {
  privacy: PostPrivacy
  label: string
  options: PostPrivacyOption[]
  busy: boolean
  onSelect: (privacy: PostPrivacy) => void
}) {
  const { t } = useI18n()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' })

  useEffect(() => {
    if (!open) return
    function closeFromOutside(event: PointerEvent) {
      const target = event.target as Node
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    function closeFromEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeFromOutside)
    document.addEventListener('keydown', closeFromEscape)
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside)
      document.removeEventListener('keydown', closeFromEscape)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    function placeMenu() {
      const button = buttonRef.current
      const menu = menuRef.current
      if (!button || !menu) return
      const buttonBox = button.getBoundingClientRect()
      const menuBox = menu.getBoundingClientRect()
      const padding = 6
      const left = Math.min(Math.max(padding, buttonBox.left), Math.max(padding, window.innerWidth - menuBox.width - padding))
      const below = buttonBox.bottom + 6
      const top = below + menuBox.height <= window.innerHeight - padding
        ? below
        : Math.max(padding, buttonBox.top - menuBox.height - 6)
      setPosition({ left, top, visibility: 'visible' })
    }
    placeMenu()
    window.addEventListener('resize', placeMenu)
    window.addEventListener('scroll', placeMenu, true)
    return () => {
      window.removeEventListener('resize', placeMenu)
      window.removeEventListener('scroll', placeMenu, true)
    }
  }, [open])

  return <>
    <HoverTooltip label={label} className="post-meta-hover post-privacy-hover" disabled={open}>
      <button ref={buttonRef} type="button" className="post-card-privacy-control" aria-label={label} aria-haspopup="listbox" aria-expanded={open} disabled={busy} onClick={() => setOpen((current) => !current)}><PostPrivacyIcon privacy={privacy} size={13} /></button>
    </HoverTooltip>
    {open && createPortal(<div ref={menuRef} className="home-post-privacy-menu post-card-privacy-menu" role="listbox" aria-label={t('privacy')} style={position}>{options.map((option) => <button key={option.value} type="button" role="option" aria-selected={privacy === option.value} onClick={() => { setOpen(false); onSelect(option.value) }}><PostPrivacyIcon privacy={option.value} size={18} /><span>{option.label}</span></button>)}</div>, document.body)}
  </>
}
