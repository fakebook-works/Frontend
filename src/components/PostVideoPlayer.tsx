import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useI18n } from '../i18n'
import { detectVideoHasAudio } from '../lib/videoAudio'
import { Icon } from './Icon'

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const AUTOPLAY_START_RATIO = 0.68
const AUTOPLAY_STOP_RATIO = 0.5

let activePostVideo: HTMLVideoElement | null = null

function claimPostVideo(video: HTMLVideoElement) {
  if (activePostVideo && activePostVideo !== video) activePostVideo.pause()
  activePostVideo = video
}

function releasePostVideo(video: HTMLVideoElement) {
  if (activePostVideo === video) activePostVideo = null
}

function formatVideoTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '0:00'
  const seconds = Math.floor(value)
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

function VideoPlayGlyph({ size = 22 }: { size?: number }) {
  return <svg className="post-video-play-glyph" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8.15 6.08c0-1.12 1.23-1.8 2.18-1.2l8.02 5.05a2.44 2.44 0 0 1 0 4.14l-8.02 5.05c-.95.6-2.18-.08-2.18-1.2V6.08Z" /></svg>
}

function VideoSettingsGlyph({ size = 22 }: { size?: number }) {
  return <svg className="post-video-settings-glyph" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.73v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
}

function VideoChevron({ direction }: { direction: 'left' | 'right' }) {
  const path = direction === 'right' ? 'm6.75 4.25 5.25 5.75-5.25 5.75' : 'm11.25 4.25-5.25 5.75 5.25 5.75'
  return <svg className="post-video-chevron" width="14" height="17" viewBox="0 0 18 20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={path} /></svg>
}

export function PostVideoPlayer({ src, controls = true, autoPlay = true, onLoadedMetadata }: {
  src: string
  controls?: boolean
  autoPlay?: boolean
  onLoadedMetadata?: (width: number, height: number) => void
}) {
  const { t } = useI18n()
  const rootRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(true)
  const [videoHeight, setVideoHeight] = useState(0)
  const [hasAudio, setHasAudio] = useState<boolean | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsPanel, setSettingsPanel] = useState<'root' | 'quality' | 'speed'>('root')
  const [playbackRate, setPlaybackRate] = useState(1)
  const autoplaySuppressedRef = useRef(false)

  useEffect(() => {
    setHasAudio(null)
    setVideoHeight(0)
  }, [src])

  useEffect(() => {
    const root = rootRef.current
    const video = videoRef.current
    if (!autoPlay || !root || !video || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return
      if (entry.isIntersecting && entry.intersectionRatio >= AUTOPLAY_START_RATIO) {
        if (autoplaySuppressedRef.current) return
        claimPostVideo(video)
        const attempt = video.play()
        if (attempt) {
          void attempt.catch(() => {
            if (video.muted) {
              releasePostVideo(video)
              return
            }
            video.muted = true
            setMuted(true)
            const mutedAttempt = video.play()
            if (mutedAttempt) void mutedAttempt.catch(() => releasePostVideo(video))
          })
        }
        return
      }
      if (!entry.isIntersecting || entry.intersectionRatio <= AUTOPLAY_STOP_RATIO) {
        autoplaySuppressedRef.current = false
        video.pause()
        releasePostVideo(video)
      }
    }, { threshold: [0, AUTOPLAY_STOP_RATIO, AUTOPLAY_START_RATIO, 1] })

    observer.observe(root)
    return () => {
      observer.disconnect()
      video.pause()
      releasePostVideo(video)
    }
  }, [autoPlay, src])

  useEffect(() => {
    if (!settingsOpen) return
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setSettingsOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [settingsOpen])

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused || video.ended) {
      autoplaySuppressedRef.current = false
      claimPostVideo(video)
      const result = video.play()
      if (result) void result.catch(() => releasePostVideo(video))
    } else {
      autoplaySuppressedRef.current = true
      video.pause()
      releasePostVideo(video)
    }
  }

  function seek(value: number) {
    const video = videoRef.current
    if (!video || !Number.isFinite(value)) return
    video.currentTime = value
    setCurrentTime(value)
  }

  function changeVolume(value: number) {
    const video = videoRef.current
    if (!video || hasAudio === false) return
    const next = Math.min(1, Math.max(0, value))
    video.volume = next
    video.muted = next === 0
    setVolume(next)
    setMuted(next === 0)
  }

  function toggleMute() {
    const video = videoRef.current
    if (!video || hasAudio === false) return
    video.muted = !video.muted
    setMuted(video.muted)
  }

  function changePlaybackRate(value: number) {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = value
    setPlaybackRate(value)
    setSettingsPanel('root')
  }

  function updateAudioAvailability(video: HTMLVideoElement) {
    const detected = detectVideoHasAudio(video)
    if (detected != null) setHasAudio(detected)
  }

  async function toggleFullscreen() {
    const root = rootRef.current
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (!root || !video) return
    if (document.fullscreenElement) {
      await document.exitFullscreen?.()
      return
    }
    if (root.requestFullscreen) await root.requestFullscreen()
    else video.webkitEnterFullscreen?.()
  }

  const progress = duration > 0 ? Math.min(100, Math.max(0, currentTime / duration * 100)) : 0
  const volumeProgress = muted ? 0 : volume * 100
  const progressStyle = { '--post-video-progress': `${progress}%` } as CSSProperties
  const volumeStyle = { '--post-video-volume': `${volumeProgress}%` } as CSSProperties
  const quality = videoHeight > 0 ? `${t('videoQualityAuto')} ${videoHeight}p` : t('videoQualityAuto')

  return <div ref={rootRef} className={`post-video-player post-media-content${playing ? ' playing' : ''}`} onClick={(event) => event.stopPropagation()} onDoubleClick={() => void toggleFullscreen()}>
    <video
      ref={videoRef}
      src={src}
      muted={!controls || muted}
      playsInline
      preload="metadata"
      onClick={controls ? togglePlay : undefined}
      onLoadedMetadata={(event) => {
        const video = event.currentTarget
        setDuration(Number.isFinite(video.duration) ? video.duration : 0)
        setVideoHeight(video.videoHeight)
        setVolume(video.volume)
        setMuted(video.muted)
        updateAudioAvailability(video)
        onLoadedMetadata?.(video.videoWidth, video.videoHeight)
      }}
      onLoadedData={(event) => updateAudioAvailability(event.currentTarget)}
      onCanPlay={(event) => updateAudioAvailability(event.currentTarget)}
      onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
      onTimeUpdate={(event) => {
        setCurrentTime(event.currentTarget.currentTime)
        if (hasAudio == null) updateAudioAvailability(event.currentTarget)
      }}
      onPlay={(event) => {
        setPlaying(true)
        updateAudioAvailability(event.currentTarget)
      }}
      onPause={(event) => {
        setPlaying(false)
        releasePostVideo(event.currentTarget)
      }}
      onEnded={(event) => {
        setPlaying(false)
        releasePostVideo(event.currentTarget)
      }}
      onVolumeChange={(event) => {
        setVolume(event.currentTarget.volume)
        setMuted(event.currentTarget.muted)
      }}
    />
    {controls && <div className="post-video-controls" onDoubleClick={(event) => event.stopPropagation()}>
      <button type="button" className="post-video-control-button play" aria-label={t(playing ? 'videoPause' : 'videoPlay')} onClick={togglePlay}>{playing ? <Icon name="pause" size={21} /> : <VideoPlayGlyph />}</button>
      <time>{formatVideoTime(currentTime)} / {formatVideoTime(duration)}</time>
      <input className="post-video-progress" type="range" min={0} max={Math.max(duration, 0)} step="0.05" value={Math.min(currentTime, Math.max(duration, 0))} aria-label={t('videoSeek')} style={progressStyle} onChange={(event) => seek(Number(event.target.value))} />
      <div className="post-video-settings-wrap">
        <button type="button" className="post-video-control-button" aria-label={t('videoSettings')} aria-expanded={settingsOpen} onClick={() => { setSettingsOpen((open) => !open); setSettingsPanel('root') }}><VideoSettingsGlyph /></button>
        {settingsOpen && <div className="post-video-settings-menu" role="menu">
          {settingsPanel === 'root' && <>
            <button type="button" role="menuitem" className="post-video-settings-row" onClick={() => setSettingsPanel('quality')}><span>{t('videoQuality')}</span><strong>{quality}<VideoChevron direction="right" /></strong></button>
            <button type="button" role="menuitem" className="post-video-settings-row" onClick={() => setSettingsPanel('speed')}><span>{t('videoPlaybackSpeed')}</span><strong>{playbackRate}<VideoChevron direction="right" /></strong></button>
          </>}
          {settingsPanel === 'quality' && <>
            <button type="button" className="post-video-settings-back" onClick={() => setSettingsPanel('root')}><VideoChevron direction="left" />{t('videoQuality')}</button>
            <div className="post-video-quality-options">
              <button type="button" role="menuitemradio" aria-checked="true" onClick={() => setSettingsPanel('root')}><span><strong>{quality}</strong><small>{t('videoOriginalQuality')}</small></span><Icon name="check" size={15} /></button>
            </div>
          </>}
          {settingsPanel === 'speed' && <>
            <button type="button" className="post-video-settings-back" onClick={() => setSettingsPanel('root')}><VideoChevron direction="left" />{t('videoPlaybackSpeed')}</button>
            <div className="post-video-speed-options">{PLAYBACK_SPEEDS.map((speed) => <button type="button" role="menuitemradio" aria-checked={speed === playbackRate} className={speed === playbackRate ? 'active' : ''} key={speed} onClick={() => changePlaybackRate(speed)}>{speed}x</button>)}</div>
          </>}
        </div>}
      </div>
      <button type="button" className="post-video-control-button" aria-label={t('videoFullscreen')} onClick={() => void toggleFullscreen()}><Icon name="expand" size={21} /></button>
      <div className={`post-video-volume-wrap${hasAudio === false ? ' no-audio' : ''}`}>
        {hasAudio !== false && <div className="post-video-volume-popover"><input type="range" min={0} max={1} step={0.02} value={muted ? 0 : volume} aria-label={t('videoVolume')} style={volumeStyle} onChange={(event) => changeVolume(Number(event.target.value))} /></div>}
        <button type="button" className="post-video-control-button" aria-label={hasAudio === false ? t('videoNoAudio') : t(muted || volume === 0 ? 'videoUnmute' : 'videoMute')} aria-disabled={hasAudio === false} onClick={toggleMute}><Icon name={hasAudio === false || muted || volume === 0 ? 'volumeOff' : 'volume'} size={22} /></button>
      </div>
    </div>}
  </div>
}
