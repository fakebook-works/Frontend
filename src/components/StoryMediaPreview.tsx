import type { CSSProperties } from 'react'
import { useImageAmbientColor } from '../lib/useImageAmbientColor'
import { StoryImageMedia } from './StoryImageMedia'

export function StoryMediaPreview({ type, url }: { type: number; url: string }) {
  const ambientColor = useImageAmbientColor(type === 0 ? url : null, 'rgb(137 140 146)')
  return <span className={`home-story-media-preview${type === 1 ? ' video' : ' image'}`} style={{ '--story-ambient-color': ambientColor } as CSSProperties}>
    {type === 1
      ? <><span className="story-stage-backdrop" aria-hidden="true"><video src={url} muted playsInline preload="auto" /></span><video className="home-story-video-foreground" src={url} muted playsInline preload="auto" /></>
      : <StoryImageMedia src={url} onReady={() => undefined} />}
  </span>
}
