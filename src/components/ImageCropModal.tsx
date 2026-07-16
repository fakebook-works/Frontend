import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useI18n } from '../i18n'
import { coverCropRect } from '../lib/imageCrop'

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = url
  await image.decode()
  return image
}

async function croppedFile(file: File, aspect: number, zoom: number, offsetX: number, offsetY: number, outputWidth: number): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const rect = coverCropRect(image.naturalWidth, image.naturalHeight, aspect, zoom, offsetX, offsetY)
    const canvas = document.createElement('canvas')
    canvas.width = outputWidth
    canvas.height = Math.round(outputWidth / aspect)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable')
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not encode image')), 'image/jpeg', .9))
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-cropped.jpg`, { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function ImageCropModal({ file, kind, onClose, onConfirm }: { file: File; kind: 'avatar' | 'background'; onClose: () => void; onConfirm: (original: File, cropped: File) => Promise<void> | void }) {
  const { t } = useI18n()
  const aspect = kind === 'avatar' ? 1 : 16 / 6
  const outputWidth = kind === 'avatar' ? 1024 : 1600
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    let active = true
    loadImage(url).then((image) => {
      if (!active || !canvasRef.current) return
      const canvas = canvasRef.current
      const rect = coverCropRect(image.naturalWidth, image.naturalHeight, aspect, zoom, offsetX, offsetY)
      const context = canvas.getContext('2d')
      if (!context) return
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height)
    }).catch(() => active && setError(t('imageLoadError')))
    return () => { active = false; URL.revokeObjectURL(url) }
  }, [aspect, file, offsetX, offsetY, t, zoom])

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm(file, await croppedFile(file, aspect, zoom, offsetX, offsetY, outputWidth))
    } catch {
      setError(t('imageCropError'))
    } finally {
      setBusy(false)
    }
  }

  return <div className="modal-backdrop image-crop-backdrop" role="presentation" onClick={() => !busy && onClose()}><section className="modal image-crop-modal" role="dialog" aria-modal="true" aria-label={kind === 'avatar' ? t('cropAvatar') : t('cropBackground')} onClick={(event) => event.stopPropagation()}><header className="modal-head"><h2>{kind === 'avatar' ? t('cropAvatar') : t('cropBackground')}</h2><button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button></header><div className="image-crop-body"><div className={kind === 'avatar' ? 'crop-preview avatar-crop' : 'crop-preview background-crop'}><canvas ref={canvasRef} width={kind === 'avatar' ? 520 : 800} height={kind === 'avatar' ? 520 : 300} /></div><label><span>{t('zoom')}</span><input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label><label><span>{t('horizontalPosition')}</span><input type="range" min="-100" max="100" value={offsetX} onChange={(event) => setOffsetX(Number(event.target.value))} /></label><label><span>{t('verticalPosition')}</span><input type="range" min="-100" max="100" value={offsetY} onChange={(event) => setOffsetY(Number(event.target.value))} /></label>{error && <p className="form-error">{error}</p>}</div><footer className="modal-foot"><button type="button" className="btn-soft" onClick={onClose}>{t('cancel')}</button><button type="button" className="btn-primary" disabled={busy} onClick={() => void confirm()}>{busy ? t('uploading') : t('uploadAndSave')}</button></footer></section></div>
}
