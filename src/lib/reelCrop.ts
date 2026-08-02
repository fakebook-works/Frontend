import {
  clampReelFocalPoint,
  MAX_REEL_ASPECT_RATIO,
  MAX_REEL_BYTES,
  MIN_REEL_ASPECT_RATIO,
} from './reelPresentation'

const MAX_CROPPED_EDGE = 1920
const DEFAULT_FRAME_RATE = 30

type CaptureStreamVideo = HTMLVideoElement & {
  captureStream?: () => MediaStream
  mozCaptureStream?: () => MediaStream
}

export interface ReelCropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ReelCropOptions {
  aspectRatio: number
  focalPointX: number
  focalPointY: number
}

export class ReelCropError extends Error {
  readonly code: 'unsupported' | 'decode' | 'encode'

  constructor(code: ReelCropError['code'], message: string, cause?: unknown) {
    super(message)
    this.name = 'ReelCropError'
    this.code = code
    if (cause !== undefined) (this as Error & { cause?: unknown }).cause = cause
  }
}

function clampAspectRatio(value: number) {
  if (!Number.isFinite(value)) return MIN_REEL_ASPECT_RATIO
  return Math.min(MAX_REEL_ASPECT_RATIO, Math.max(MIN_REEL_ASPECT_RATIO, value))
}

export function calculateReelCropRect(
  sourceWidth: number,
  sourceHeight: number,
  targetAspectRatio: number,
  focalPointX: number,
  focalPointY: number,
): ReelCropRect {
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
    throw new ReelCropError('decode', 'The source video has invalid dimensions.')
  }

  const aspectRatio = clampAspectRatio(targetAspectRatio)
  const sourceAspectRatio = sourceWidth / sourceHeight
  if (sourceAspectRatio > aspectRatio) {
    const width = sourceHeight * aspectRatio
    const remainingWidth = Math.max(0, sourceWidth - width)
    return {
      x: remainingWidth * clampReelFocalPoint(focalPointX),
      y: 0,
      width,
      height: sourceHeight,
    }
  }

  const height = sourceWidth / aspectRatio
  const remainingHeight = Math.max(0, sourceHeight - height)
  return {
    x: 0,
    y: remainingHeight * clampReelFocalPoint(focalPointY),
    width: sourceWidth,
    height,
  }
}

export function reelCropIsRequired(sourceWidth: number, sourceHeight: number, targetAspectRatio: number) {
  if (sourceWidth <= 0 || sourceHeight <= 0) return true
  const sourceRatio = sourceWidth / sourceHeight
  const targetRatio = clampAspectRatio(targetAspectRatio)
  // A difference below half a source pixel cannot produce a meaningful crop.
  const tolerance = .5 / Math.max(sourceWidth, sourceHeight)
  return Math.abs(sourceRatio - targetRatio) > tolerance
}

export function calculateReelCropOutputSize(rect: Pick<ReelCropRect, 'width' | 'height'>, aspectRatio: number) {
  const ratio = clampAspectRatio(aspectRatio)
  const scale = Math.min(1, MAX_CROPPED_EDGE / Math.max(rect.width, rect.height))
  let width: number
  let height: number

  if (ratio >= 1) {
    width = Math.max(2, Math.round((rect.width * scale) / 2) * 2)
    height = Math.max(2, Math.round((width / ratio) / 2) * 2)
  } else {
    height = Math.max(2, Math.round((rect.height * scale) / 2) * 2)
    width = Math.max(2, Math.round((height * ratio) / 2) * 2)
  }

  return { width, height }
}

function waitForVideoMetadata(video: HTMLVideoElement) {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA && video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve()
  }
  return new Promise<void>((resolve, reject) => {
    const loaded = () => {
      cleanup()
      resolve()
    }
    const failed = () => {
      cleanup()
      reject(new ReelCropError('decode', 'The selected video could not be decoded.', video.error))
    }
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', loaded)
      video.removeEventListener('error', failed)
    }
    video.addEventListener('loadedmetadata', loaded)
    video.addEventListener('error', failed)
  })
}

function waitForPlaybackEnd(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    const ended = () => {
      cleanup()
      resolve()
    }
    const failed = () => {
      cleanup()
      reject(new ReelCropError('decode', 'The selected video stopped while it was being cropped.', video.error))
    }
    const cleanup = () => {
      video.removeEventListener('ended', ended)
      video.removeEventListener('error', failed)
    }
    video.addEventListener('ended', ended)
    video.addEventListener('error', failed)
  })
}

function recorderMimeType() {
  const candidates = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ]
  if (typeof MediaRecorder.isTypeSupported !== 'function') return 'video/mp4'
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? ''
}

function fileExtension(mimeType: string) {
  return mimeType.toLowerCase().includes('mp4') ? 'mp4' : 'webm'
}

/**
 * Exports the visible Reel frame as a new video file.  The crop is applied to
 * every decoded frame before the file reaches Upload Server; aspect/focal
 * metadata is no longer being used as a substitute for cropping the asset.
 */
export async function cropReelVideoFile(file: File, options: ReelCropOptions): Promise<File> {
  const canvas = document.createElement('canvas')
  const captureCanvas = canvas as HTMLCanvasElement & { captureStream?: (frameRate?: number) => MediaStream }
  const video = document.createElement('video') as CaptureStreamVideo
  const captureVideo = video.captureStream ?? video.mozCaptureStream

  if (typeof MediaRecorder === 'undefined' || !captureCanvas.captureStream || !captureVideo) {
    throw new ReelCropError('unsupported', 'This browser cannot export a cropped Reel.')
  }

  const sourceUrl = URL.createObjectURL(file)
  let animationFrame: number | null = null
  let sourceStream: MediaStream | null = null
  let canvasStream: MediaStream | null = null
  let outputStream: MediaStream | null = null
  let recorder: MediaRecorder | null = null

  try {
    video.preload = 'auto'
    video.playsInline = true
    // Muted playback satisfies autoplay policy. captureStream retains the
    // source audio track, which is copied into the composed output stream.
    video.muted = true
    video.src = sourceUrl
    const metadataReady = waitForVideoMetadata(video)
    video.load()
    await metadataReady

    const normalizedInputType = file.type.split(';', 1)[0]?.trim().toLowerCase() ?? ''
    const uploadCompatibleOriginal = /\.mp4$/i.test(file.name)
      && (!normalizedInputType || normalizedInputType === 'video/mp4' || normalizedInputType === 'application/octet-stream')
    if (!reelCropIsRequired(video.videoWidth, video.videoHeight, options.aspectRatio) && uploadCompatibleOriginal) return file

    const cropRect = calculateReelCropRect(
      video.videoWidth,
      video.videoHeight,
      options.aspectRatio,
      options.focalPointX,
      options.focalPointY,
    )
    const outputSize = calculateReelCropOutputSize(cropRect, options.aspectRatio)
    canvas.width = outputSize.width
    canvas.height = outputSize.height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new ReelCropError('unsupported', 'Canvas video export is unavailable.')

    sourceStream = captureVideo.call(video)
    const sourceFrameRate = sourceStream.getVideoTracks()[0]?.getSettings().frameRate
    const frameRate = Number.isFinite(sourceFrameRate)
      ? Math.min(60, Math.max(24, sourceFrameRate as number))
      : DEFAULT_FRAME_RATE
    canvasStream = captureCanvas.captureStream(frameRate)
    outputStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...sourceStream.getAudioTracks(),
    ])

    const mimeType = recorderMimeType()
    if (!mimeType) throw new ReelCropError('unsupported', 'This browser cannot encode the cropped Reel as MP4.')
    const pixels = outputSize.width * outputSize.height
    const preferredVideoBitrate = Math.round(Math.min(10_000_000, Math.max(2_000_000, pixels * 3)))
    const uploadBudgetBitrate = Number.isFinite(video.duration) && video.duration > 0
      ? Math.floor(((MAX_REEL_BYTES * .94) * 8) / video.duration) - 192_000
      : preferredVideoBitrate
    const recorderOptions: MediaRecorderOptions = {
      videoBitsPerSecond: Math.max(150_000, Math.min(preferredVideoBitrate, uploadBudgetBitrate)),
      mimeType,
    }
    try {
      recorder = new MediaRecorder(outputStream, recorderOptions)
    } catch (error) {
      throw new ReelCropError('unsupported', 'The browser has no compatible Reel encoder.', error)
    }

    const chunks: Blob[] = []
    const encoded = new Promise<Blob>((resolve, reject) => {
      if (!recorder) return reject(new ReelCropError('encode', 'The Reel encoder was not created.'))
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      })
      recorder.addEventListener('error', (event) => {
        reject(new ReelCropError('encode', 'The Reel encoder failed.', event))
      }, { once: true })
      recorder.addEventListener('stop', () => {
        const outputType = recorder?.mimeType || mimeType
        const blob = new Blob(chunks, { type: outputType })
        if (blob.size <= 0) reject(new ReelCropError('encode', 'The cropped Reel is empty.'))
        else resolve(blob)
      }, { once: true })
    })

    const drawFrame = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        context.drawImage(
          video,
          cropRect.x,
          cropRect.y,
          cropRect.width,
          cropRect.height,
          0,
          0,
          outputSize.width,
          outputSize.height,
        )
      }
      if (!video.ended) animationFrame = window.requestAnimationFrame(drawFrame)
    }

    recorder.start(1_000)
    drawFrame()
    const playbackEnded = waitForPlaybackEnd(video)
    try {
      await video.play()
      await playbackEnded
    } catch (error) {
      if (error instanceof ReelCropError) throw error
      throw new ReelCropError('decode', 'The selected video could not be played for cropping.', error)
    }
    if (recorder.state !== 'inactive') recorder.stop()
    const blob = await encoded
    const outputType = blob.type || recorder.mimeType || mimeType
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'reel'
    return new File([blob], `${baseName}-cropped.${fileExtension(outputType)}`, {
      type: outputType,
      lastModified: Date.now(),
    })
  } finally {
    if (animationFrame != null) window.cancelAnimationFrame(animationFrame)
    video.pause()
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop() } catch { /* The encoder may already be shutting down. */ }
    }
    outputStream?.getTracks().forEach((track) => track.stop())
    canvasStream?.getTracks().forEach((track) => track.stop())
    sourceStream?.getTracks().forEach((track) => track.stop())
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(sourceUrl)
  }
}
