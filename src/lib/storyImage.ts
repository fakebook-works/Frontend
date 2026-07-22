export const STORY_IMAGE_WIDTH = 1440
export const STORY_IMAGE_HEIGHT = 2560

export interface StoryImageEditOptions {
  zoom?: number
  rotation?: number
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve(image)
      else reject(new Error('The selected image has invalid dimensions.'))
    }
    image.onerror = () => reject(new Error('The selected image could not be decoded.'))
    image.src = source
  })
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The edited story image could not be exported.'))
    }, 'image/jpeg', .98)
  })
}

function editedFileName(name: string) {
  const dot = name.lastIndexOf('.')
  const stem = (dot > 0 ? name.slice(0, dot) : name).trim() || 'story'
  return `${stem}-story-edited.jpg`
}

export async function createEditedStoryImage(
  file: File,
  { zoom = 1, rotation = 0 }: StoryImageEditOptions = {},
) {
  if (!file.type.startsWith('image/')) throw new Error('Only image files can be edited for a story.')
  if (!Number.isFinite(zoom) || zoom <= 0) throw new Error('Story image zoom must be greater than zero.')
  if (!Number.isFinite(rotation)) throw new Error('Story image rotation must be finite.')

  const source = URL.createObjectURL(file)
  try {
    const image = await loadImage(source)
    const canvas = document.createElement('canvas')
    canvas.width = STORY_IMAGE_WIDTH
    canvas.height = STORY_IMAGE_HEIGHT

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D is not supported in this browser.')

    context.fillStyle = '#18191a'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'

    const coverScale = Math.max(
      canvas.width / image.naturalWidth,
      canvas.height / image.naturalHeight,
    ) * 1.38
    const backdropWidth = image.naturalWidth * coverScale
    const backdropHeight = image.naturalHeight * coverScale
    context.save()
    context.filter = 'blur(290px) brightness(0.94) saturate(0.88)'
    context.drawImage(
      image,
      (canvas.width - backdropWidth) / 2,
      (canvas.height - backdropHeight) / 2,
      backdropWidth,
      backdropHeight,
    )
    context.restore()
    context.filter = 'none'
    context.fillStyle = 'rgba(0, 0, 0, 0.08)'
    context.fillRect(0, 0, canvas.width, canvas.height)

    const containScale = Math.min(
      canvas.width / image.naturalWidth,
      canvas.height / image.naturalHeight,
    )
    const drawWidth = image.naturalWidth * containScale
    const drawHeight = image.naturalHeight * containScale

    context.save()
    context.translate(canvas.width / 2, canvas.height / 2)
    context.rotate((rotation * Math.PI) / 180)
    context.scale(zoom, zoom)
    context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
    context.restore()

    const blob = await canvasToBlob(canvas)
    return new File([blob], editedFileName(file.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } finally {
    URL.revokeObjectURL(source)
  }
}
