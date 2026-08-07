import { useBodyInteractionLock } from '../lib/bodyInteractionLock'
import { ContentDetailShellClose } from './ContentDetailShellClose'

export function StoryViewerLoadingFallback({ onClose }: { onClose: () => void }) {
  useBodyInteractionLock(true, ['content-detail-open', 'story-viewer-open'])

  return <>
    <ContentDetailShellClose className="story-viewer-shell-close" onClose={onClose} />
    <div className="story-viewer-backdrop story-viewer-loading-backdrop" role="presentation" onClick={onClose}><span className="spinner" /></div>
  </>
}
