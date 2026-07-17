// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoryCreatorModal } from './StoryCreatorModal'

const apiMocks = vi.hoisted(() => ({
  uploadMedia: vi.fn(),
  createNormalStory: vi.fn(),
  cancelPendingMedia: vi.fn(),
}))

vi.mock('../api/client', () => ({ api: apiMocks }))
vi.mock('../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('StoryCreatorModal', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:story-preview'),
      revokeObjectURL: vi.fn(),
    })
    apiMocks.uploadMedia.mockReset()
    apiMocks.createNormalStory.mockReset().mockResolvedValue({
      __typename: 'NormalStory', id: 'story-1', content: 'Created story', create: '2026-07-17T10:00:00Z', media: [],
    })
    apiMocks.cancelPendingMedia.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('publishes a text-only story from the 9:16 preview', async () => {
    const onCreated = vi.fn()
    const onClose = vi.fn()
    render(<StoryCreatorModal open authorId="42" onCreated={onCreated} onClose={onClose} />)

    expect(document.querySelector('.story-editor-canvas')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('storyPrompt'), { target: { value: 'Text on story' } })
    fireEvent.click(screen.getByRole('button', { name: 'publishStory' }))

    await waitFor(() => expect(apiMocks.createNormalStory).toHaveBeenCalledWith({
      authorId: '42',
      content: 'Text on story',
      media: null,
    }))
    expect(apiMocks.uploadMedia).not.toHaveBeenCalled()
    expect(onCreated).toHaveBeenCalledWith({
      __typename: 'NormalStory', id: 'story-1', content: 'Created story', create: '2026-07-17T10:00:00Z', media: [],
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('previews, zooms and rotates media without uploading before publish', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'story.png', { type: 'image/png' })
    apiMocks.uploadMedia.mockResolvedValue({
      assetId: 'asset-1', state: 'pending', url: '/media/files/story.png', type: 'image',
      contentType: 'image/png', size: file.size, name: file.name,
    })
    render(<StoryCreatorModal open authorId="42" onCreated={vi.fn()} onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('storyChooseMedia'), { target: { files: [file] } })
    const preview = await waitFor(() => {
      const image = document.querySelector('.story-editor-canvas img')
      expect(image).toBeInTheDocument()
      return image as HTMLImageElement
    })
    expect(apiMocks.uploadMedia).not.toHaveBeenCalled()
    fireEvent.change(screen.getByRole('slider', { name: 'zoom' }), { target: { value: '1.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'storyRotate' }))
    expect(preview).toHaveStyle({ transform: 'scale(1.5) rotate(90deg)' })

    fireEvent.click(screen.getByRole('button', { name: 'publishStory' }))
    await waitFor(() => expect(apiMocks.uploadMedia).toHaveBeenCalledWith(file))
    expect(apiMocks.createNormalStory).toHaveBeenCalledWith({
      authorId: '42',
      content: '',
      media: { type: 0, url: '/media/files/story.png' },
    })
  })

  it('cancels a staged upload when story creation fails', async () => {
    const file = new File([new Uint8Array([1])], 'story.png', { type: 'image/png' })
    const upload = {
      assetId: 'asset-2', state: 'pending', url: '/media/files/story.png', type: 'image',
      contentType: 'image/png', size: file.size, name: file.name,
    }
    apiMocks.uploadMedia.mockResolvedValue(upload)
    apiMocks.createNormalStory.mockRejectedValue(new Error('write failed'))
    render(<StoryCreatorModal open authorId="42" onCreated={vi.fn()} onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('storyChooseMedia'), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'publishStory' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('storyPublishError')
    expect(apiMocks.cancelPendingMedia).toHaveBeenCalledWith(upload)
  })
})
