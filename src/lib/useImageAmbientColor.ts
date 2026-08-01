import { useEffect, useState } from 'react'

const DEFAULT_AMBIENT = 'rgb(142 145 151)'
const SAMPLE_SIZE = 24
const COLOR_BUCKET_SIZE = 32
const colorCache = new Map<string, string>()

interface ColorBucket {
  count: number
  r: number
  g: number
  b: number
}

function channel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

export function dominantAmbientColor(data: Uint8ClampedArray, fallback = DEFAULT_AMBIENT) {
  const buckets = new Map<string, ColorBucket>()
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 96) continue
    const r = data[index]
    const g = data[index + 1]
    const b = data[index + 2]
    const key = `${Math.floor(r / COLOR_BUCKET_SIZE)}:${Math.floor(g / COLOR_BUCKET_SIZE)}:${Math.floor(b / COLOR_BUCKET_SIZE)}`
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
    bucket.count += 1
    bucket.r += r
    bucket.g += g
    bucket.b += b
    buckets.set(key, bucket)
  }
  if (buckets.size === 0) return fallback

  const dominant = [...buckets.values()].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count
    const leftChannels = [left.r / left.count, left.g / left.count, left.b / left.count]
    const rightChannels = [right.r / right.count, right.g / right.count, right.b / right.count]
    const leftRange = Math.max(...leftChannels) - Math.min(...leftChannels)
    const rightRange = Math.max(...rightChannels) - Math.min(...rightChannels)
    return rightRange - leftRange
  })[0]

  let r = dominant.r / dominant.count
  let g = dominant.g / dominant.count
  let b = dominant.b / dominant.count

  // Preserve the dominant hue while lifting it enough to blend cleanly into the dark profile shell.
  const initialWhiteMix = .22
  r = r * (1 - initialWhiteMix) + 255 * initialWhiteMix
  g = g * (1 - initialWhiteMix) + 255 * initialWhiteMix
  b = b * (1 - initialWhiteMix) + 255 * initialWhiteMix
  const luminance = r * .2126 + g * .7152 + b * .0722
  if (luminance < 164) {
    const liftMix = Math.min(.68, (164 - luminance) / (255 - luminance))
    r = r * (1 - liftMix) + 255 * liftMix
    g = g * (1 - liftMix) + 255 * liftMix
    b = b * (1 - liftMix) + 255 * liftMix
  }
  return `rgb(${channel(r)} ${channel(g)} ${channel(b)})`
}

function sampleImage(url: string): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = SAMPLE_SIZE
        canvas.height = SAMPLE_SIZE
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) return resolve(DEFAULT_AMBIENT)
        context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
        resolve(dominantAmbientColor(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data))
      } catch {
        resolve(DEFAULT_AMBIENT)
      }
    }
    image.onerror = () => resolve(DEFAULT_AMBIENT)
    image.src = url
  })
}

export function useImageAmbientColor(url: string | null | undefined, fallback = DEFAULT_AMBIENT) {
  const [color, setColor] = useState(() => url ? colorCache.get(url) ?? fallback : fallback)

  useEffect(() => {
    let active = true
    if (!url) {
      setColor(fallback)
      return () => { active = false }
    }
    const cached = colorCache.get(url)
    if (cached) {
      setColor(cached)
      return () => { active = false }
    }
    setColor(fallback)
    void sampleImage(url).then((sampled) => {
      colorCache.set(url, sampled)
      if (active) setColor(sampled)
    })
    return () => { active = false }
  }, [fallback, url])

  return color
}
