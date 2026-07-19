// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HoldLikeButton } from './HoldLikeButton'

const playLikeSound = vi.hoisted(() => vi.fn())
vi.mock('../../lib/sounds', () => ({ playLikeSound }))

describe('HoldLikeButton', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    playLikeSound.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('grows through three levels while held and sends the selected level', () => {
    const onSend = vi.fn()
    render(<HoldLikeButton label="like" onSend={onSend} />)
    const button = screen.getByRole('button', { name: 'like' })

    fireEvent.pointerDown(button, { pointerId: 1, pointerType: 'mouse', button: 0 })
    act(() => vi.advanceTimersByTime(440))
    expect(button).toHaveClass('level-2', 'holding')
    act(() => vi.advanceTimersByTime(460))
    expect(button).toHaveClass('level-3', 'holding')
    fireEvent.pointerUp(button, { pointerId: 1, pointerType: 'mouse', button: 0 })

    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith(3)
  })

  it('deflates and cancels the send when held beyond the maximum', () => {
    const onSend = vi.fn()
    render(<HoldLikeButton label="like" onSend={onSend} />)
    const button = screen.getByRole('button', { name: 'like' })

    fireEvent.pointerDown(button, { pointerId: 2, pointerType: 'touch' })
    act(() => vi.advanceTimersByTime(1_500))
    expect(button).toHaveClass('level-3', 'deflated')
    fireEvent.pointerUp(button, { pointerId: 2, pointerType: 'touch' })
    fireEvent.click(button)

    expect(onSend).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(340))
    expect(button).toHaveClass('level-1')
    expect(button).not.toHaveClass('deflated')
  })

  it('cancels the current hold when the pointer moves outside and requires a new press', () => {
    const onSend = vi.fn()
    render(<HoldLikeButton label="like" onSend={onSend} />)
    const button = screen.getByRole('button', { name: 'like' })
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      bottom: 36,
      height: 36,
      left: 0,
      right: 32,
      top: 0,
      width: 32,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    fireEvent.pointerDown(button, { pointerId: 3, pointerType: 'mouse', button: 0 })
    act(() => vi.advanceTimersByTime(440))
    expect(button).toHaveClass('level-2', 'holding')
    fireEvent.pointerMove(button, { pointerId: 3, pointerType: 'mouse', clientX: 45, clientY: 18 })
    expect(button).toHaveClass('level-2', 'deflated')
    expect(button).not.toHaveClass('holding')
    fireEvent.pointerUp(button, { pointerId: 3, pointerType: 'mouse', button: 0 })
    fireEvent.click(button)
    expect(onSend).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(340))
    fireEvent.pointerDown(button, { pointerId: 4, pointerType: 'mouse', button: 0 })
    fireEvent.pointerUp(button, { pointerId: 4, pointerType: 'mouse', button: 0 })
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith(1)
  })
})
