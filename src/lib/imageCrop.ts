export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

async function loadCropImage(url: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = url
  await image.decode()
  return image
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

export async function cropImageFile(
  file: File,
  aspect: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
  outputWidth: number,
): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadCropImage(url)
    const rect = coverCropRect(image.naturalWidth, image.naturalHeight, aspect, zoom, offsetX, offsetY)
    const canvas = document.createElement('canvas')
    canvas.width = outputWidth
    canvas.height = Math.round(outputWidth / aspect)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable')
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error('Could not encode image')),
      'image/jpeg',
      .9,
    ))
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-cropped.jpg`, { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(url)
  }
}
