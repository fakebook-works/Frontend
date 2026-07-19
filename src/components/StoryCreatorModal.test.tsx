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

const imageMocks = vi.hoisted(() => ({
  createEditedStoryImage: vi.fn(),
}))

vi.mock('../api/client', () => ({ api: apiMocks }))
vi.mock('../lib/storyImage', () => imageMocks)
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
    imageMocks.createEditedStoryImage.mockReset().mockImplementation(async (file: File) => file)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('publishes a text-only story with the selected background encoded at the start', async () => {
    const onCreated = vi.fn()
    const onClose = vi.fn()
    render(<StoryCreatorModal open authorId="42" onCreated={onCreated} onClose={onClose} />)

    expect(document.querySelector('.story-editor-canvas')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'storyCreate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'close' }).querySelector('path')).toHaveAttribute('d', 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z')
    expect(screen.queryByText('storyEditorHint')).not.toBeInTheDocument()
    expect(screen.queryByText('storyPreview')).not.toBeInTheDocument()
    expect(screen.queryByText('storyChooseMedia')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'storyBackground 2' }))
    fireEvent.change(screen.getByLabelText('storyPrompt'), { target: { value: 'Text on story' } })
    fireEvent.click(screen.getByRole('button', { name: 'publishStory' }))

    await waitFor(() => expect(apiMocks.createNormalStory).toHaveBeenCalledWith({
      authorId: '42',
      content: '[[story-bg:#7c3aed]]\nText on story',
      media: null,
    }))
    expect(apiMocks.uploadMedia).not.toHaveBeenCalled()
    expect(imageMocks.createEditedStoryImage).not.toHaveBeenCalled()
    expect(onCreated).toHaveBeenCalledWith({
      __typename: 'NormalStory', id: 'story-1', content: 'Created story', create: '2026-07-17T10:00:00Z', media: [],
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('renders image edits into a new file before upload', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'story.png', { type: 'image/png' })
    const editedFile = new File([new Uint8Array([4, 5, 6])], 'story-story-edited.jpg', { type: 'image/jpeg' })
    imageMocks.createEditedStoryImage.mockResolvedValue(editedFile)
    apiMocks.uploadMedia.mockResolvedValue({
      assetId: 'asset-1', state: 'pending', url: '/media/files/story-edited.jpg', type: 'image',
      contentType: 'image/jpeg', size: editedFile.size, name: editedFile.name,
    })
    render(<StoryCreatorModal open authorId="42" onCreated={vi.fn()} onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('storyChooseMedia'), { target: { files: [file] } })
    const preview = await waitFor(() => {
      const image = document.querySelector('.story-editor-canvas img')
      expect(image).toBeInTheDocument()
      return image as HTMLImageElement
    })
    expect(screen.getByRole('button', { name: 'storyBackground 1' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText('storyChooseMedia').closest('label')).toHaveClass('selected')
    expect(screen.getByRole('slider', { name: 'zoom' })).toHaveValue('1')
    expect(apiMocks.uploadMedia).not.toHaveBeenCalled()

    for (let step = 0; step < 5; step += 1) fireEvent.click(screen.getByRole('button', { name: 'storyZoomIn' }))
    fireEvent.wheel(document.querySelector('.story-editor-canvas') as HTMLElement, { deltaY: -120 })
    expect(preview).toHaveStyle({ transform: 'scale(1.6) rotate(0deg)' })
    fireEvent.wheel(screen.getByRole('slider', { name: 'zoom' }), { deltaY: 120 })
    fireEvent.click(screen.getByRole('button', { name: 'storyRotate' }))
    expect(preview).toHaveStyle({ transform: 'scale(1.5) rotate(90deg)' })

    fireEvent.click(screen.getByRole('button', { name: 'publishStory' }))
    await waitFor(() => expect(imageMocks.createEditedStoryImage).toHaveBeenCalledWith(file, { zoom: 1.5, rotation: 90 }))
    expect(apiMocks.uploadMedia).toHaveBeenCalledWith(editedFile)
    expect(apiMocks.createNormalStory).toHaveBeenCalledWith({
      authorId: '42',
      content: '',
      media: { type: 0, url: '/media/files/story-edited.jpg' },
    })
  })

  it('keeps background choices visible and switches from media back to a text background', async () => {
    const file = new File([new Uint8Array([1])], 'story.png', { type: 'image/png' })
    render(<StoryCreatorModal open authorId="42" onCreated={vi.fn()} onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('storyChooseMedia'), { target: { files: [file] } })
    await waitFor(() => expect(document.querySelector('.story-editor-canvas img')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'storyBackground 3' }))

    expect(document.querySelector('.story-editor-canvas img')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'storyBackground 3' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('storyChooseMedia').closest('label')).not.toHaveClass('selected')
    expect(screen.queryByRole('button', { name: 'storyZoomIn' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('storyPrompt'), { target: { value: 'Back to color' } })
    fireEvent.click(screen.getByRole('button', { name: 'publishStory' }))

    await waitFor(() => expect(apiMocks.createNormalStory).toHaveBeenCalledWith({
      authorId: '42',
      content: '[[story-bg:#d63384]]\nBack to color',
      media: null,
    }))
    expect(apiMocks.uploadMedia).not.toHaveBeenCalled()
  })

  it('uploads a video directly and does not show image edit tools', async () => {
    const file = new File([new Uint8Array([1])], 'story.mp4', { type: 'video/mp4' })
    apiMocks.uploadMedia.mockResolvedValue({
      assetId: 'asset-video', state: 'pending', url: '/media/files/story.mp4', type: 'video',
      contentType: 'video/mp4', size: file.size, name: file.name,
    })
    render(<StoryCreatorModal open authorId="42" onCreated={vi.fn()} onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('storyChooseMedia'), { target: { files: [file] } })
    expect(await screen.findByRole('button', { name: 'publishStory' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'storyZoomIn' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'publishStory' }))

    await waitFor(() => expect(apiMocks.uploadMedia).toHaveBeenCalledWith(file))
    expect(imageMocks.createEditedStoryImage).not.toHaveBeenCalled()
  })

  it('does not upload when exporting the edited image fails', async () => {
    const file = new File([new Uint8Array([1])], 'broken.png', { type: 'image/png' })
    imageMocks.createEditedStoryImage.mockRejectedValue(new Error('canvas failed'))
    render(<StoryCreatorModal open authorId="42" onCreated={vi.fn()} onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('storyChooseMedia'), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'publishStory' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('storyPublishError')
    expect(apiMocks.uploadMedia).not.toHaveBeenCalled()
    expect(apiMocks.createNormalStory).not.toHaveBeenCalled()
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
