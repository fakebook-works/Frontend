import { useCallback, useEffect, useRef } from 'react'

function prepareCanvas(canvas: HTMLCanvasElement) {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (width <= 0 || height <= 0) return null
  const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
  const pixelWidth = Math.max(1, Math.round(width * ratio))
  const pixelHeight = Math.max(1, Math.round(height * ratio))
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight
  const context = canvas.getContext('2d')
  return context ? { context, width: pixelWidth, height: pixelHeight } : null
}

export function StoryVideoPreview({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const backdropRef = useRef<HTMLCanvasElement | null>(null)
  const foregroundRef = useRef<HTMLCanvasElement | null>(null)

  const draw = useCallback(() => {
    const video = videoRef.current
    const backdrop = backdropRef.current
    const foreground = foregroundRef.current
    if (!video || !backdrop || !foreground) return
    if (video.videoWidth <= 0 || video.videoHeight <= 0) return
    const background = prepareCanvas(backdrop)
    const content = prepareCanvas(foreground)
    if (!background || !content) return
    const sourceRatio = video.videoWidth / video.videoHeight
    const targetRatio = background.width / background.height
    let sourceX = 0
    let sourceY = 0
    let sourceWidth = video.videoWidth
    let sourceHeight = video.videoHeight
    if (sourceRatio > targetRatio) {
      sourceWidth = video.videoHeight * targetRatio
      sourceX = (video.videoWidth - sourceWidth) / 2
    } else {
      sourceHeight = video.videoWidth / targetRatio
      sourceY = (video.videoHeight - sourceHeight) / 2
    }
    const containScale = Math.min(content.width / video.videoWidth, content.height / video.videoHeight)
    const drawWidth = video.videoWidth * containScale
    const drawHeight = video.videoHeight * containScale
    background.context.clearRect(0, 0, background.width, background.height)
    content.context.clearRect(0, 0, content.width, content.height)
    try {
      background.context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, background.width, background.height)
      content.context.drawImage(video, (content.width - drawWidth) / 2, (content.height - drawHeight) / 2, drawWidth, drawHeight)
    } catch {
      // A later loaded-data or resize event retries the preview frame.
    }
  }, [])

  useEffect(() => {
    if (typeof ResizeObserver !== 'function') return
    const foreground = foregroundRef.current
    if (!foreground) return
    const observer = new ResizeObserver(draw)
    observer.observe(foreground)
    return () => observer.disconnect()
  }, [draw])

  return <>
    <span className="story-stage-backdrop" aria-hidden="true"><canvas ref={backdropRef} /></span>
    <canvas ref={foregroundRef} className="story-video-foreground" aria-hidden="true" />
    <video ref={videoRef} className="story-video-source" src={src} muted playsInline preload="auto" onLoadedData={draw} />
  </>
}
