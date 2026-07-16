export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export function coverCropRect(imageWidth: number, imageHeight: number, aspect: number, zoom = 1, offsetX = 0, offsetY = 0): CropRect {
  if (imageWidth <= 0 || imageHeight <= 0 || aspect <= 0) throw new Error('Invalid crop dimensions')
  const imageAspect = imageWidth / imageHeight
  const baseWidth = imageAspect > aspect ? imageHeight * aspect : imageWidth
  const baseHeight = imageAspect > aspect ? imageHeight : imageWidth / aspect
  const safeZoom = Math.max(1, Math.min(3, zoom))
  const width = baseWidth / safeZoom
  const height = baseHeight / safeZoom
  const maxX = imageWidth - width
  const maxY = imageHeight - height
  const x = Math.max(0, Math.min(maxX, maxX / 2 + (Math.max(-100, Math.min(100, offsetX)) / 100) * (maxX / 2)))
  const y = Math.max(0, Math.min(maxY, maxY / 2 + (Math.max(-100, Math.min(100, offsetY)) / 100) * (maxY / 2)))
  return { x, y, width, height }
}
