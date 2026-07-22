import { useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from '../../components/Icon'

const PLAYBACK_RATES = [0.5, 1, 1.5, 2] as const
const WAVEFORM_HEIGHTS = [9, 15, 11, 20, 13, 24, 17, 12, 21, 15, 26, 18, 10, 16, 23, 14, 19, 27, 16, 11, 22, 17, 25, 13, 20, 15, 9, 18]

interface MessengerAudioPlayerProps {
  src: string
  name: string
  durationMs?: number | null
  compact?: boolean
}

function formatAudioTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0:00'
  const seconds = Math.floor(value)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function MessengerAudioPlayer({ src, name, durationMs, compact = false }: MessengerAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const fallbackDuration = Math.max(0, Number(durationMs ?? 0) / 1000)
  const [playing, setPlaying] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(fallbackDuration)
  const [playbackRate, setPlaybackRate] = useState<(typeof PLAYBACK_RATES)[number]>(1)
  const [volume, setVolume] = useState(1)
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0
  const waveformHeights = compact ? WAVEFORM_HEIGHTS.slice(0, 16) : WAVEFORM_HEIGHTS.slice(0, 22)
  const playedBars = Math.round(progress * waveformHeights.length)
  const playerStyle = useMemo(() => ({
    '--audio-progress': `${progress * 100}%`,
    '--audio-volume': `${volume * 100}%`,
  }) as CSSProperties, [progress, volume])

  async function togglePlayback() {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.paused) {
      audio.pause()
      return
    }
    if (duration > 0 && audio.currentTime >= duration) {
      audio.currentTime = 0
      setCurrentTime(0)
    }
    audio.playbackRate = playbackRate
    try {
      await audio.play()
    } catch {
      setPlaying(false)
    }
  }

  function seek(value: number) {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(value)) return
    const next = Math.max(0, Math.min(duration || value, value))
    audio.currentTime = next
    setCurrentTime(next)
  }

  function cyclePlaybackRate() {
    const currentIndex = PLAYBACK_RATES.indexOf(playbackRate)
    const next = PLAYBACK_RATES[(currentIndex + 1) % PLAYBACK_RATES.length]
    setPlaybackRate(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  function updateVolume(nextValue: number) {
    const next = Math.max(0, Math.min(1, nextValue))
    setVolume(next)
    if (audioRef.current) audioRef.current.volume = next
  }

  return (
    <figure className={`messenger-audio-player${compact ? ' compact' : ''}`} data-media-kind="audio" style={playerStyle} title={name}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const nextDuration = Number.isFinite(event.currentTarget.duration)
            ? event.currentTarget.duration
            : fallbackDuration
          setDuration(Math.max(0, nextDuration))
          event.currentTarget.playbackRate = playbackRate
        }}
        onDurationChange={(event) => {
          if (Number.isFinite(event.currentTarget.duration)) setDuration(Math.max(0, event.currentTarget.duration))
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => {
          setPlaying(true)
          setHasStarted(true)
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setCurrentTime(duration)
        }}
        aria-label={name}
      />
      <button type="button" className="messenger-audio-play" aria-label={`${playing ? 'Pause' : 'Play'} ${name}`} onClick={() => void togglePlayback()}>
        {playing
          ? <Icon name="pause" size={compact ? 14 : 15} />
          : <svg className="messenger-audio-play-glyph" width={compact ? 14 : 15} height={compact ? 14 : 15} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8.7 6.3 18.45 12 8.7 17.7Z" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </button>
      <div className="messenger-audio-main">
        <div className="messenger-audio-wave" aria-hidden="true">
          {waveformHeights.map((height, index) => (
            <i key={index} className={index < playedBars ? 'played' : ''} style={{ height }} />
          ))}
        </div>
        <input
          className="messenger-audio-seek"
          type="range"
          min="0"
          max={Math.max(duration, 0.01)}
          step="0.01"
          value={Math.min(currentTime, Math.max(duration, 0.01))}
          aria-label={`Seek ${name}`}
          onChange={(event) => seek(Number(event.currentTarget.value))}
        />
        <div className="messenger-audio-meta">
          <input
            className="messenger-audio-volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            aria-label={`Volume ${name}`}
            onChange={(event) => updateVolume(Number(event.currentTarget.value))}
          />
          <span className="messenger-audio-time">{formatAudioTime(hasStarted ? currentTime : duration)}</span>
        </div>
      </div>
      <button type="button" className="messenger-audio-rate" aria-label={`Playback speed ${playbackRate}x`} onClick={cyclePlaybackRate}>
        {playbackRate}x
      </button>
    </figure>
  )
}
