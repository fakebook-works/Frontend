// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MediaGallery, formatMediaSize, resolveMediaKind, type MediaAttachment } from './MediaGallery'

function image(index: number): MediaAttachment {
  return {
    url: `/media/files/photo-${index}.jpg`,
    type: 'image',
    contentType: 'image/jpeg',
    name: `photo-${index}.jpg`,
    size: 2048,
  }
}

afterEach(cleanup)

describe('MediaGallery', () => {
  it.each([
    [1, 'layout-single'],
    [2, 'layout-double'],
    [3, 'layout-triple'],
    [4, 'layout-many'],
    [5, 'layout-many'],
  ])('uses the Messenger collage layout for %i images', (count, layout) => {
    const { container } = render(<MediaGallery attachments={Array.from({ length: count }, (_, index) => image(index))} />)
    const gallery = container.querySelector('.media-gallery-images')
    expect(gallery).toHaveClass(layout)
    expect(gallery).toHaveAttribute('data-image-count', String(count))
    expect(gallery?.querySelectorAll('.media-gallery-image')).toHaveLength(Math.min(count, 4))
  })

  it('labels a stacked group with the total image count', () => {
    const { container } = render(<MediaGallery mine attachments={Array.from({ length: 7 }, (_, index) => image(index))} />)
    expect(container.querySelector('.media-gallery-count-label')).toHaveTextContent('Bạn đã gửi 7 ảnh')
    expect(container.querySelector('.media-gallery-more')).not.toBeInTheDocument()
    expect(container.querySelector('.media-gallery-images')).toHaveAttribute('data-visible-count', '4')
  })

  it('renders video, audio and file attachments independently from the image collage', () => {
    const attachments: MediaAttachment[] = [
      image(1),
      { url: '/media/files/clip.mp4', type: 'video', contentType: 'video/mp4', name: 'clip.mp4' },
      { url: '/media/files/voice.webm?kind=audio', type: 'audio', contentType: 'audio/webm', name: 'voice.webm' },
      // Legacy API responses sometimes report PDFs as image with an octet-stream MIME.
      { url: '/media/files/guide.pdf', type: 'image', contentType: 'application/pdf', name: 'guide.pdf', size: 4096 },
    ]
    const { container } = render(<MediaGallery attachments={attachments} />)
    expect(container.querySelectorAll('[data-media-kind="image"]')).toHaveLength(1)
    expect(container.querySelector('[data-media-kind="video"] video')).toBeInTheDocument()
    expect(container.querySelector('[data-media-kind="audio"] audio')).toBeInTheDocument()
    expect(container.querySelector('[data-media-kind="file"]')).toHaveTextContent('guide.pdf')
  })

  it('accepts future metadata and resolves type before falling back to URL extension', () => {
    expect(resolveMediaKind({ url: '/asset/no-extension', mediaType: 'video', contentType: '' })).toBe('video')
    expect(resolveMediaKind({ url: '/asset/photo.png', type: 'file', contentType: '' })).toBe('image')
    expect(resolveMediaKind({ url: '/asset/report.pdf', type: 'image', contentType: '' })).toBe('file')
    expect(formatMediaSize(1024 * 2.5)).toBe('2.5 KB')
  })

  it('uses the committed image URL first and only falls back to a thumbnail on failure', () => {
    const attachment = { ...image(1), thumbnailUrl: '/media/thumbnails/stale.jpg' }
    const { container } = render(<MediaGallery attachments={[attachment]} />)
    const preview = container.querySelector('.media-gallery-image img')

    expect(preview).toHaveAttribute('src', '/media/files/photo-1.jpg')
    fireEvent.error(preview!)
    expect(container.querySelector('.media-gallery-image img')).toHaveAttribute('src', '/media/thumbnails/stale.jpg')

    fireEvent.error(container.querySelector('.media-gallery-image img')!)
    expect(container.querySelector('.media-gallery-image .messenger-media-image-unavailable')).toBeInTheDocument()
  })

  it('opens the full media set without a visible filename or counter', () => {
    const { container } = render(<MediaGallery attachments={Array.from({ length: 5 }, (_, index) => image(index))} />)
    fireEvent.click(container.querySelector('.media-gallery-image')!)

    const dialog = screen.getByRole('dialog')
    expect(dialog).not.toHaveTextContent('photo-0.jpg')
    expect(dialog).not.toHaveTextContent('1/5')
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(5)
    expect(within(dialog).getByRole('button', { name: 'Previous media' }).querySelector('svg')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Next media' }).querySelector('svg')).toBeInTheDocument()
    expect(dialog.querySelector('.media-lightbox-ambient img')).toHaveAttribute('src', '/media/files/photo-0.jpg')
    fireEvent.click(screen.getByRole('button', { name: 'Previous media' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('photo-4.jpg (5/5)')
    fireEvent.click(screen.getByRole('button', { name: 'Next media' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('photo-0.jpg (1/5)')
    fireEvent.click(screen.getByRole('button', { name: 'Next media' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('photo-1.jpg (2/5)')
    fireEvent.click(screen.getByRole('button', { name: 'Close image viewer' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('switches from one message collage to every image and video in the conversation', async () => {
    const loadConversationMedia = vi.fn().mockResolvedValue([
      { ...image(1), galleryKey: 'message-a:0' },
      { ...image(7), galleryKey: 'message-b:0' },
      { url: '/media/files/clip.mp4', type: 'video', contentType: 'video/mp4', name: 'clip.mp4', galleryKey: 'message-c:0' },
    ])
    const { container } = render(
      <MediaGallery
        attachments={[image(7)]}
        messageId="message-b"
        loadConversationMedia={loadConversationMedia}
      />,
    )

    fireEvent.click(container.querySelector('.media-gallery-image')!)

    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAccessibleName('photo-7.jpg (2/3)'))
    const dialog = screen.getByRole('dialog')
    const thumbnails = within(dialog).getAllByRole('listitem')
    expect(thumbnails).toHaveLength(3)
    expect(within(dialog).getByRole('listitem', { name: 'View photo-7.jpg' })).toHaveAttribute('aria-current', 'true')

    fireEvent.click(within(dialog).getByRole('listitem', { name: 'View clip.mp4' }))
    expect(dialog).toHaveAccessibleName('clip.mp4 (3/3)')
    expect(within(dialog).getByLabelText('clip.mp4', { selector: 'video' })).toHaveAttribute('controls')
    expect(within(dialog).getByRole('listitem', { name: 'View clip.mp4' })).toHaveAttribute('aria-current', 'true')
    expect(loadConversationMedia).toHaveBeenCalledTimes(1)
  })

  it('reuses the message forward flow from the viewer toolbar', () => {
    const onForward = vi.fn()
    const { container } = render(<MediaGallery attachments={[image(1)]} onForward={onForward} />)
    fireEvent.click(container.querySelector('.media-gallery-image')!)

    fireEvent.click(screen.getByRole('button', { name: 'Chuyển tiếp' }))

    expect(onForward).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
