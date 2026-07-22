interface AudioTrackListLike {
  readonly length: number
}

type AudioInspectableVideo = HTMLVideoElement & {
  mozHasAudio?: boolean
  webkitAudioDecodedByteCount?: number
  audioTracks?: AudioTrackListLike
  captureStream?: () => MediaStream
  mozCaptureStream?: () => MediaStream
}

export function detectVideoHasAudio(element: HTMLVideoElement): boolean | null {
  const video = element as AudioInspectableVideo
  if (typeof video.mozHasAudio === 'boolean') return video.mozHasAudio
  if (video.audioTracks && typeof video.audioTracks.length === 'number') return video.audioTracks.length > 0

  const capture = video.captureStream ?? video.mozCaptureStream
  if (capture) {
    try {
      return capture.call(video).getAudioTracks().length > 0
    } catch {
      // Cross-origin or older media implementations can reject capture inspection.
    }
  }

  if (typeof video.webkitAudioDecodedByteCount === 'number' && video.webkitAudioDecodedByteCount > 0) return true
  return null
}
