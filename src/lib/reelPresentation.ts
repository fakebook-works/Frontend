export const MAX_REEL_BYTES = 500 * 1024 * 1024
export const MIN_REEL_ASPECT_RATIO = 9 / 16
export const MAX_REEL_ASPECT_RATIO = 16 / 9

export function ratioFromSlider(value: number) {
  const normalized = Math.min(100, Math.max(0, value))
  if (normalized === 0) return MAX_REEL_ASPECT_RATIO
  if (normalized === 100) return MIN_REEL_ASPECT_RATIO
  const progress = normalized / 100
  return Number((MAX_REEL_ASPECT_RATIO - ((MAX_REEL_ASPECT_RATIO - MIN_REEL_ASPECT_RATIO) * progress)).toFixed(6))
}

export function sliderFromRatio(value: number) {
  const ratio = Math.min(MAX_REEL_ASPECT_RATIO, Math.max(MIN_REEL_ASPECT_RATIO, value))
  if (ratio === MAX_REEL_ASPECT_RATIO) return 0
  if (ratio === MIN_REEL_ASPECT_RATIO) return 100
  return Number((((MAX_REEL_ASPECT_RATIO - ratio) / (MAX_REEL_ASPECT_RATIO - MIN_REEL_ASPECT_RATIO)) * 100).toFixed(6))
}

export function clampReelFocalPoint(value: number) {
  return Math.min(1, Math.max(0, value))
}
