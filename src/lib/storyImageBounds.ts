export interface StoryImageBounds {
  x: number
  y: number
  width: number
  height: number
}

const DARK_PIXEL_LIMIT = 6
const MIN_VISIBLE_LINE_RATIO = .08

export function detectStoryImageContentBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): StoryImageBounds {
  const full = { x: 0, y: 0, width, height }
  if (width <= 0 || height <= 0 || pixels.length < width * height * 4) return full

  const isVisiblePixel = (x: number, y: number) => {
    const offset = (y * width + x) * 4
    return pixels[offset + 3] > 12 && Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]) > DARK_PIXEL_LIMIT
  }
  const rowHasContent = (y: number) => {
    let visible = 0
    const minimum = Math.max(2, Math.ceil(width * MIN_VISIBLE_LINE_RATIO))
    for (let x = 0; x < width; x += 1) {
      if (isVisiblePixel(x, y) && ++visible >= minimum) return true
    }
    return false
  }
  const columnHasContent = (x: number) => {
    let visible = 0
    const minimum = Math.max(2, Math.ceil(height * MIN_VISIBLE_LINE_RATIO))
    for (let y = 0; y < height; y += 1) {
      if (isVisiblePixel(x, y) && ++visible >= minimum) return true
    }
    return false
  }

  let top = 0
  let bottom = height - 1
  let left = 0
  let right = width - 1
  while (top < bottom && !rowHasContent(top)) top += 1
  while (bottom > top && !rowHasContent(bottom)) bottom -= 1
  while (left < right && !columnHasContent(left)) left += 1
  while (right > left && !columnHasContent(right)) right -= 1

  if (right - left < width * .15 || bottom - top < height * .15) return full
  const edgeInset = Math.max(1, Math.round(Math.min(width, height) * .004))
  if (left > 0) left = Math.min(right, left + edgeInset)
  if (right < width - 1) right = Math.max(left, right - edgeInset)
  if (top > 0) top = Math.min(bottom, top + edgeInset)
  if (bottom < height - 1) bottom = Math.max(top, bottom - edgeInset)
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
}
