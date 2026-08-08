import type { MediaType, MediaUpload } from '../../api/types'

export interface PendingMediaUploadPreview {
  id: string
  file: File
  attachment: MediaUpload
}

let pendingUploadSequence = 0
const releasedPendingUploadPreviews = new WeakSet<PendingMediaUploadPreview>()

function mediaTypeForFile(file: File): MediaType {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return 'file'
}

export function createPendingMediaUploadPreviews(files: File[]): PendingMediaUploadPreview[] {
  return files.map((file) => {
    const url = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : ''
    const type = mediaTypeForFile(file)
    pendingUploadSequence += 1
    return {
      id: `messenger-upload-${Date.now()}-${pendingUploadSequence}`,
      file,
      attachment: {
        url,
        type,
        mediaType: type,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        sizeBytes: file.size,
        name: file.name,
        originalName: file.name,
      },
    }
  })
}

export function releasePendingMediaUploadPreviews(previews: PendingMediaUploadPreview[]) {
  if (typeof URL.revokeObjectURL !== 'function') return
  for (const preview of previews) {
    if (releasedPendingUploadPreviews.has(preview)) continue
    releasedPendingUploadPreviews.add(preview)
    if (preview.attachment.url.startsWith('blob:')) URL.revokeObjectURL(preview.attachment.url)
  }
}
