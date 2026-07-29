import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { cropImageFile } from './imageCrop'

export interface InlineImageCropTarget {
  file: File
  fromExisting: boolean
  previewUrl: string
  source: { contentId: string; mediaId: string } | null
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function useInlineImageCrop(resetKey: string | null | undefined) {
  const [target, setTarget] = useState<InlineImageCropTarget | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [busy, setBusy] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; clientX: number; clientY: number; offsetX: number; offsetY: number } | null>(null)

  const placement = useMemo(() => {
    if (imageSize.width <= 0 || imageSize.height <= 0 || viewportSize.width <= 0 || viewportSize.height <= 0) return null
    const scale = Math.max(viewportSize.width / imageSize.width, viewportSize.height / imageSize.height) * zoom
    const width = imageSize.width * scale
    const height = imageSize.height * scale
    const maxShiftX = Math.max(0, (width - viewportSize.width) / 2)
    const maxShiftY = Math.max(0, (height - viewportSize.height) / 2)
    return {
      width,
      height,
      maxShiftX,
      maxShiftY,
      shiftX: -(clamp(offset.x, -100, 100) / 100) * maxShiftX,
      shiftY: -(clamp(offset.y, -100, 100) / 100) * maxShiftY,
    }
  }, [imageSize, offset, viewportSize, zoom])

  const clear = useCallback(() => {
    dragRef.current = null
    setTarget(null)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setImageSize({ width: 0, height: 0 })
  }, [])

  const cancel = useCallback(() => {
    if (!busy) clear()
  }, [busy, clear])

  const start = useCallback((file: File, fromExisting: boolean, source: { contentId: string; mediaId: string } | null = null) => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setImageSize({ width: 0, height: 0 })
    setBusy(false)
    setTarget({ file, fromExisting, previewUrl: URL.createObjectURL(file), source })
  }, [])

  useEffect(() => {
    const previewUrl = target?.previewUrl
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [target?.previewUrl])

  useEffect(() => {
    clear()
    // The editor must reset when navigation swaps the profile identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  useLayoutEffect(() => {
    if (!target || !previewRef.current) return
    const preview = previewRef.current
    const updateViewport = () => {
      const bounds = preview.getBoundingClientRect()
      setViewportSize({ width: bounds.width, height: bounds.height })
    }
    updateViewport()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateViewport)
      return () => window.removeEventListener('resize', updateViewport)
    }
    const observer = new ResizeObserver(updateViewport)
    observer.observe(preview)
    return () => observer.disconnect()
  }, [target])

  useEffect(() => {
    if (!target || busy) return
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel()
    }
    document.addEventListener('keydown', cancelOnEscape)
    return () => document.removeEventListener('keydown', cancelOnEscape)
  }, [busy, cancel, target])

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (busy) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, offsetX: offset.x, offsetY: offset.y }
    event.currentTarget.classList.add('dragging')
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || !placement) return
    const deltaX = event.clientX - drag.clientX
    const deltaY = event.clientY - drag.clientY
    setOffset({
      x: placement.maxShiftX > .01 ? clamp(drag.offsetX - deltaX / placement.maxShiftX * 100, -100, 100) : drag.offsetX,
      y: placement.maxShiftY > .01 ? clamp(drag.offsetY - deltaY / placement.maxShiftY * 100, -100, 100) : drag.offsetY,
    })
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    event.currentTarget.classList.remove('dragging')
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function moveWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (busy || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const amount = event.shiftKey ? 12 : 4
    setOffset((current) => ({
      x: clamp(current.x + (event.key === 'ArrowLeft' ? amount : event.key === 'ArrowRight' ? -amount : 0), -100, 100),
      y: clamp(current.y + (event.key === 'ArrowUp' ? amount : event.key === 'ArrowDown' ? -amount : 0), -100, 100),
    }))
  }

  function changeZoom(delta: number) {
    setZoom((current) => Math.round(clamp(current + delta, 1, 3) * 100) / 100)
  }

  async function createCroppedFile(outputWidth: number, fallbackAspect: number) {
    if (!target) throw new Error('No image is being edited')
    const bounds = previewRef.current?.getBoundingClientRect()
    const aspect = bounds && bounds.width > 0 && bounds.height > 0 ? bounds.width / bounds.height : fallbackAspect
    return cropImageFile(target.file, aspect, zoom, offset.x, offset.y, outputWidth)
  }

  const imageStyle = placement ? {
    width: `${placement.width}px`,
    height: `${placement.height}px`,
    transform: `translate(calc(-50% + ${placement.shiftX}px), calc(-50% + ${placement.shiftY}px))`,
  } : undefined

  return {
    target,
    zoom,
    busy,
    previewRef,
    imageStyle,
    start,
    cancel,
    clear,
    setBusy,
    changeZoom,
    createCroppedFile,
    beginDrag,
    moveDrag,
    endDrag,
    moveWithKeyboard,
    onImageLoad: (image: HTMLImageElement) => setImageSize({ width: image.naturalWidth, height: image.naturalHeight }),
  }
}
