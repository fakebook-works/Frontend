import { describe, expect, it } from 'vitest'
import { detectVideoHasAudio } from './videoAudio'

function video(properties: Record<string, unknown>) {
  return properties as unknown as HTMLVideoElement
}

describe('detectVideoHasAudio', () => {
  it('uses Firefox and Safari audio metadata when available', () => {
    expect(detectVideoHasAudio(video({ mozHasAudio: true }))).toBe(true)
    expect(detectVideoHasAudio(video({ mozHasAudio: false }))).toBe(false)
    expect(detectVideoHasAudio(video({ audioTracks: { length: 1 } }))).toBe(true)
    expect(detectVideoHasAudio(video({ audioTracks: { length: 0 } }))).toBe(false)
  })

  it('detects Chromium audio tracks through the captured media stream', () => {
    expect(detectVideoHasAudio(video({ captureStream: () => ({ getAudioTracks: () => [{}] }) }))).toBe(true)
    expect(detectVideoHasAudio(video({ captureStream: () => ({ getAudioTracks: () => [] }) }))).toBe(false)
  })

  it('falls back to decoded audio bytes and otherwise reports an unknown result', () => {
    expect(detectVideoHasAudio(video({ webkitAudioDecodedByteCount: 24 }))).toBe(true)
    expect(detectVideoHasAudio(video({ webkitAudioDecodedByteCount: 0 }))).toBeNull()
    expect(detectVideoHasAudio(video({}))).toBeNull()
  })
})
