import type { MediaType, MediaUpload } from '../../api/types'
import {
  MESSENGER_ATTACHMENT_MIME_TYPES,
  MediaValidationError,
  validateMediaFiles,
} from '../../lib/mediaValidation'

export interface PendingMediaUploadPreview {
  id: string
  file: File
  attachment: MediaUpload
}

let pendingUploadSequence = 0
const releasedPendingUploadPreviews = new WeakSet<PendingMediaUploadPreview>()

export interface PendingMediaUploadValidation {
  previews: PendingMediaUploadPreview[]
  errors: MediaValidationError[]
}

function mediaTypeForKind(kind: 'image' | 'video' | 'audio' | 'document'): MediaType {
  return kind === 'document' ? 'file' : kind
}

function createPendingMediaUploadPreview(file: File, type: MediaType, contentType: string): PendingMediaUploadPreview {
  const url = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : ''
  pendingUploadSequence += 1
  return {
    id: `messenger-upload-${Date.now()}-${pendingUploadSequence}`,
    file,
    attachment: {
      url,
      type,
      mediaType: type,
      contentType,
      size: file.size,
      sizeBytes: file.size,
      name: file.name,
      originalName: file.name,
    },
  }
}

export async function createPendingMediaUploadPreviews(files: File[]): Promise<PendingMediaUploadValidation> {
  const results = await validateMediaFiles(files, {
    allowedMimeTypes: MESSENGER_ATTACHMENT_MIME_TYPES,
    decodeImage: false,
    concurrency: 2,
  })
  return {
    previews: results.flatMap((result) => result.value
      ? [createPendingMediaUploadPreview(result.file, mediaTypeForKind(result.value.kind), result.value.mime)]
      : []),
    errors: results.flatMap((result) => result.error ? [result.error] : []),
  }
}

export function releasePendingMediaUploadPreviews(previews: PendingMediaUploadPreview[]) {
  if (typeof URL.revokeObjectURL !== 'function') return
  for (const preview of previews) {
    if (releasedPendingUploadPreviews.has(preview)) continue
    releasedPendingUploadPreviews.add(preview)
    if (preview.attachment.url.startsWith('blob:')) URL.revokeObjectURL(preview.attachment.url)
  }
}
