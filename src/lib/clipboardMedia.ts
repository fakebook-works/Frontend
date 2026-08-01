const CLIPBOARD_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function hasFileExtension(name: string) {
  return /\.[a-z0-9]{2,8}$/i.test(name)
}

function normalizeClipboardImage(file: File, index: number) {
  if (file.name && hasFileExtension(file.name)) return file
  const extension = CLIPBOARD_IMAGE_EXTENSIONS[file.type.toLowerCase()] ?? 'png'
  return new File([file], `clipboard-image-${index + 1}.${extension}`, {
    type: file.type || 'image/png',
    lastModified: file.lastModified || Date.now(),
  })
}

/**
 * Extracts image files copied to the browser clipboard. Binary clipboard data wins over
 * any accompanying text/URL so one copied image is never imported twice.
 */
export function clipboardImageFiles(clipboardData: DataTransfer): File[] {
  const fromItems = Array.from(clipboardData.items ?? [])
    .filter((item) => item.kind === 'file' && item.type.toLowerCase().startsWith('image/'))
    .flatMap((item) => {
      const file = item.getAsFile()
      if (!file) return []
      if (file.type.toLowerCase().startsWith('image/')) return [file]
      return [new File([file], file.name, { type: item.type, lastModified: file.lastModified })]
    })

  const images = fromItems.length > 0
    ? fromItems
    : Array.from(clipboardData.files ?? []).filter((file) => file.type.toLowerCase().startsWith('image/'))

  return images.map(normalizeClipboardImage)
}
