import { describe, expect, it } from 'vitest'
import { MESSENGER_ATTACHMENT_ACCEPT } from './attachmentPolicy'

describe('messenger attachment picker policy', () => {
  it('allows common office and text documents in addition to media', () => {
    for (const extension of ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf']) {
      expect(MESSENGER_ATTACHMENT_ACCEPT).toContain(extension)
    }

    expect(MESSENGER_ATTACHMENT_ACCEPT).toContain('image/jpeg')
    expect(MESSENGER_ATTACHMENT_ACCEPT).toContain('video/mp4')
    expect(MESSENGER_ATTACHMENT_ACCEPT).toContain('audio/webm')
  })
})
