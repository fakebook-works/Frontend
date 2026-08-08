import { describe, expect, it } from 'vitest'
import {
  MESSENGER_ATTACHMENT_ACCEPT,
  MESSENGER_ATTACHMENT_MIME_TYPES,
  MESSENGER_MAX_ATTACHMENTS,
} from './attachmentPolicy'

describe('messenger attachment picker policy', () => {
  it('derives the picker policy from the exact Upload Server MIME allowlist', () => {
    for (const mime of [
      'image/jpeg',
      'image/avif',
      'video/mp4',
      'audio/webm',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'application/rtf',
    ]) {
      expect(MESSENGER_ATTACHMENT_MIME_TYPES).toContain(mime)
      expect(MESSENGER_ATTACHMENT_ACCEPT).toContain(mime)
    }

    expect(MESSENGER_MAX_ATTACHMENTS).toBe(10)
  })
})
