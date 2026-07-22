import { useCallback, useEffect, useRef } from 'react'
import { detectStoryImageContentBounds, type StoryImageBounds } from '../lib/storyImageBounds'

const FULL_SAMPLE_SIZE = 320

function imageContentBounds(image: HTMLImageElement): StoryImageBounds {
  const sampleScale = Math.min(1, FULL_SAMPLE_SIZE / Math.max(image.naturalWidth, image.naturalHeight))
  const sampleWidth = Math.max(1, Math.round(image.naturalWidth * sampleScale))
  const sampleHeight = Math.max(1, Math.round(image.naturalHeight * sampleScale))
  const sample = document.createElement('canvas')
  sample.width = sampleWidth
  sample.height = sampleHeight
  const context = sample.getContext('2d', { willReadFrequently: true })
  if (!context) return { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight }
  try {
    context.drawImage(image, 0, 0, sampleWidth, sampleHeight)
    const detected = detectStoryImageContentBounds(context.getImageData(0, 0, sampleWidth, sampleHeight).data, sampleWidth, sampleHeight)
    const scaleX = image.naturalWidth / sampleWidth
    const scaleY = image.naturalHeight / sampleHeight
    return {
      x: detected.x * scaleX,
      y: detected.y * scaleY,
      width: detected.width * scaleX,
      height: detected.height * scaleY,
    }
  } catch {
    return { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight }
  }
}

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

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, bounds: StoryImageBounds, width: number, height: number) {
  const sourceRatio = bounds.width / bounds.height
  const targetRatio = width / height
  let sourceX = bounds.x
  let sourceY = bounds.y
  let sourceWidth = bounds.width
  let sourceHeight = bounds.height
  if (sourceRatio > targetRatio) {
    sourceWidth = bounds.height * targetRatio
    sourceX += (bounds.width - sourceWidth) / 2
  } else {
    sourceHeight = bounds.width / targetRatio
    sourceY += (bounds.height - sourceHeight) / 2
  }
  context.clearRect(0, 0, width, height)
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height)
}

export function StoryImageMedia({ src, onReady, eager = false }: { src: string; onReady: () => void; eager?: boolean }) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const backdropRef = useRef<HTMLCanvasElement | null>(null)
  const foregroundRef = useRef<HTMLSpanElement | null>(null)
  const boundsRef = useRef<StoryImageBounds | null>(null)
  const readyRef = useRef(onReady)
  readyRef.current = onReady

  const redraw = useCallback(() => {
    const image = imageRef.current
    const backdrop = backdropRef.current
    const foreground = foregroundRef.current
    const bounds = boundsRef.current
    if (!image || !backdrop || !foreground || !bounds) return
    const backdropCanvas = prepareCanvas(backdrop)
    if (backdropCanvas) {
      try {
        drawCover(backdropCanvas.context, image, bounds, backdropCanvas.width, backdropCanvas.height)
      } catch {
        // The source remains available for the browser's next resize/load retry.
      }
    }
    const width = foreground.clientWidth
    const height = foreground.clientHeight
    if (width <= 0 || height <= 0) return
    const usesFullImage = bounds.x === 0
      && bounds.y === 0
      && bounds.width === image.naturalWidth
      && bounds.height === image.naturalHeight
    if (usesFullImage) {
      image.style.inset = '0'
      image.style.width = '100%'
      image.style.height = '100%'
      image.style.objectFit = 'contain'
      return
    }
    const scale = Math.min(width / bounds.width, height / bounds.height)
    const contentWidth = bounds.width * scale
    const contentHeight = bounds.height * scale
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1)
    const snap = (value: number) => Math.round(value * pixelRatio) / pixelRatio
    image.style.inset = 'auto'
    image.style.objectFit = 'fill'
    image.style.width = `${snap(image.naturalWidth * scale)}px`
    image.style.height = `${snap(image.naturalHeight * scale)}px`
    image.style.left = `${snap((width - contentWidth) / 2 - bounds.x * scale)}px`
    image.style.top = `${snap((height - contentHeight) / 2 - bounds.y * scale)}px`
  }, [])

  useEffect(() => {
    if (typeof ResizeObserver !== 'function') return
    const foreground = foregroundRef.current
    if (!foreground) return
    const observer = new ResizeObserver(redraw)
    observer.observe(foreground)
    return () => observer.disconnect()
  }, [redraw])

  const prepareImage = useCallback((image: HTMLImageElement) => {
    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
      boundsRef.current = imageContentBounds(image)
      redraw()
    }
    readyRef.current()
  }, [redraw])

  useEffect(() => {
    const image = imageRef.current
    if (!image?.complete) return
    prepareImage(image)
  }, [prepareImage, src])

  return <>
    <span className="story-stage-backdrop" aria-hidden="true"><canvas ref={backdropRef} /></span>
    <span ref={foregroundRef} className="story-image-foreground" aria-hidden="true">
      <img
        ref={imageRef}
        className="story-image-foreground-source"
        src={src}
        crossOrigin="anonymous"
        alt=""
        decoding={eager ? 'sync' : 'async'}
        draggable={false}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        onLoad={(event) => prepareImage(event.currentTarget)}
        onError={() => readyRef.current()}
      />
    </span>
  </>
}
