// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MessengerAudioPlayer } from './MessengerAudioPlayer'

describe('MessengerAudioPlayer', () => {
  it('cycles playback speed from 0.5x through 2x per audio message', () => {
    const { container } = render(<MessengerAudioPlayer src="/media/files/voice.webm" name="voice.webm" durationMs={10_000} />)
    const audio = container.querySelector('audio')!

    fireEvent.click(screen.getByRole('button', { name: 'Playback speed 1x' }))
    expect(screen.getByRole('button', { name: 'Playback speed 1.5x' })).toBeInTheDocument()
    expect(audio.playbackRate).toBe(1.5)

    fireEvent.click(screen.getByRole('button', { name: 'Playback speed 1.5x' }))
    expect(screen.getByRole('button', { name: 'Playback speed 2x' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Playback speed 2x' }))
    expect(screen.getByRole('button', { name: 'Playback speed 0.5x' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Playback speed 0.5x' }))
    expect(screen.getByRole('button', { name: 'Playback speed 1x' })).toBeInTheDocument()
  })

  it('seeks with the custom waveform control', () => {
    const { container } = render(<MessengerAudioPlayer src="/media/files/voice.webm" name="voice.webm" durationMs={10_000} />)
    const audio = container.querySelector('audio')!
    expect(within(container).getByText('0:10')).toBeInTheDocument()

    fireEvent.play(audio)
    fireEvent.change(within(container).getByRole('slider', { name: 'Seek voice.webm' }), { target: { value: '5' } })
    expect(audio.currentTime).toBe(5)
    expect(within(container).getByText('0:05')).toBeInTheDocument()
    expect(within(container).queryByText('0:10')).not.toBeInTheDocument()
  })

  it('keeps the volume control on the left and the current time on the right', () => {
    const { container } = render(<MessengerAudioPlayer src="/media/files/voice.webm" name="voice.webm" durationMs={10_000} />)
    const audio = container.querySelector('audio')!
    const volume = within(container).getByRole('slider', { name: 'Volume voice.webm' })
    const meta = container.querySelector('.messenger-audio-meta')!

    expect(meta.firstElementChild).toBe(volume)
    expect(meta.lastElementChild).toHaveClass('messenger-audio-time')

    fireEvent.change(volume, { target: { value: '0.4' } })
    expect(audio.volume).toBeCloseTo(0.4)
    expect(volume).toHaveClass('messenger-audio-volume')
  })

  it('shows duration before first play, then keeps the paused progress until playback resumes', () => {
    const { container } = render(<MessengerAudioPlayer src="/media/files/voice.webm" name="voice.webm" durationMs={10_000} />)
    const audio = container.querySelector('audio')!

    expect(within(container).getByText('0:10')).toBeInTheDocument()

    fireEvent.play(audio)
    expect(within(container).getByText('0:00')).toBeInTheDocument()

    Object.defineProperty(audio, 'currentTime', { configurable: true, writable: true, value: 4 })
    fireEvent.timeUpdate(audio)
    expect(within(container).getByText('0:04')).toBeInTheDocument()

    fireEvent.pause(audio)
    expect(within(container).getByText('0:04')).toBeInTheDocument()

    fireEvent.play(audio)
    expect(within(container).getByText('0:04')).toBeInTheDocument()
  })
})
