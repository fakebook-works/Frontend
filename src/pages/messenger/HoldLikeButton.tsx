import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { playLikeSound } from '../../lib/sounds'
import type { MessengerLikeLevel } from './helpers'
import { MessengerLikeIcon } from './MessengerLikeIcon'

interface HoldLikeButtonProps {
  label: string
  disabled?: boolean
  buttonClassName?: string
  onSend: (level: MessengerLikeLevel) => void
}

const LEVEL_TWO_DELAY = 430
const LEVEL_THREE_DELAY = 880
const DEFLATE_DELAY = 1_480

export function HoldLikeButton({ label, disabled = false, buttonClassName = 'mini-compose-btn send ready', onSend }: HoldLikeButtonProps) {
  const [level, setLevel] = useState<MessengerLikeLevel>(1)
  const [holding, setHolding] = useState(false)
  const [deflated, setDeflated] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const activePointer = useRef<number | null>(null)
  const currentLevel = useRef<MessengerLikeLevel>(1)
  const timers = useRef<number[]>([])
  const suppressClick = useRef(false)

  function clearTimers() {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current = []
  }

  function updateLevel(next: MessengerLikeLevel, isDeflating = false) {
    currentLevel.current = next
    setLevel(next)
    setDeflated(isDeflating)
    playLikeSound(next, isDeflating)
  }

  function resetVisuals() {
    currentLevel.current = 1
    setLevel(1)
    setHolding(false)
    setDeflated(false)
  }

  function releasePointer(pointerId: number) {
    try {
      buttonRef.current?.releasePointerCapture?.(pointerId)
    } catch {
      // Pointer capture may already have been released by the browser.
    }
  }

  function deflateAndCancel(pointerId: number) {
    if (activePointer.current !== pointerId) return
    clearTimers()
    activePointer.current = null
    currentLevel.current = 1
    suppressClick.current = true
    releasePointer(pointerId)
    setHolding(false)
    setDeflated(true)
    playLikeSound(1, true)
    timers.current = [window.setTimeout(resetVisuals, 340)]
  }

  useEffect(() => () => clearTimers(), [])

  function beginHold(event: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return
    clearTimers()
    suppressClick.current = false
    activePointer.current = event.pointerId
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setHolding(true)
    updateLevel(1)
    timers.current = [
      window.setTimeout(() => updateLevel(2), LEVEL_TWO_DELAY),
      window.setTimeout(() => updateLevel(3), LEVEL_THREE_DELAY),
      window.setTimeout(() => deflateAndCancel(event.pointerId), DEFLATE_DELAY),
    ]
  }

  function finishHold(event: ReactPointerEvent<HTMLButtonElement>) {
    if (activePointer.current !== event.pointerId) return
    clearTimers()
    activePointer.current = null
    releasePointer(event.pointerId)
    suppressClick.current = true
    const selectedLevel = currentLevel.current
    setHolding(false)
    onSend(selectedLevel)
    timers.current = [window.setTimeout(resetVisuals, 140)]
  }

  function cancelHold(event: ReactPointerEvent<HTMLButtonElement>) {
    deflateAndCancel(event.pointerId)
  }

  function trackPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    if (activePointer.current !== event.pointerId) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const outside = event.clientX < bounds.left
      || event.clientX > bounds.right
      || event.clientY < bounds.top
      || event.clientY > bounds.bottom
    if (outside) deflateAndCancel(event.pointerId)
  }

  return <button
    ref={buttonRef}
    type="button"
    className={`${buttonClassName} hold-like-button level-${level}${holding ? ' holding' : ''}${deflated ? ' deflated' : ''}`}
    aria-label={label}
    disabled={disabled}
    onPointerDown={beginHold}
    onPointerMove={trackPointer}
    onPointerLeave={cancelHold}
    onPointerUp={finishHold}
    onPointerCancel={cancelHold}
    onClick={() => {
      if (suppressClick.current) {
        suppressClick.current = false
        return
      }
      playLikeSound(1)
      onSend(1)
    }}
  >
    <span className="hold-like-glyph"><MessengerLikeIcon size={23} /></span>
  </button>
}
