export type StoryControlIconName = 'caret' | 'more' | 'pause' | 'play' | 'volume' | 'volumeOff'

export function StoryControlIcon({ name, size = 22, className }: { name: StoryControlIconName; size?: number; className?: string }) {
  return <svg className={`story-rounded-control-icon${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === 'caret' && <path className="story-control-fill" d="M6.1 8.85c-.58-.7-.08-1.76.83-1.76h10.14c.91 0 1.41 1.06.83 1.76l-5.07 6.08a1.08 1.08 0 0 1-1.66 0L6.1 8.85Z" />}
    {name === 'volume' && <>
      <path className="story-control-fill" d="M4.4 10.1c0-.62.5-1.12 1.12-1.12h2.14l3.18-2.7c.65-.55 1.65-.09 1.65.76v9.92c0 .85-1 1.31-1.65.76l-3.18-2.7H5.52c-.62 0-1.12-.5-1.12-1.12v-3.8Z" />
      <path d="M15.25 9.1a4.1 4.1 0 0 1 0 5.8M17.7 6.75a7.35 7.35 0 0 1 0 10.5" />
    </>}
    {name === 'volumeOff' && <>
      <path className="story-control-fill" d="M4.4 10.1c0-.62.5-1.12 1.12-1.12h2.14l3.18-2.7c.65-.55 1.65-.09 1.65.76v9.92c0 .85-1 1.31-1.65.76l-3.18-2.7H5.52c-.62 0-1.12-.5-1.12-1.12v-3.8Z" />
      <path d="m15.2 9.2 4.2 4.2m0-4.2-4.2 4.2" />
    </>}
    {name === 'pause' && <><rect className="story-control-fill" x="6.7" y="5.2" width="4.1" height="13.6" rx="1.65" /><rect className="story-control-fill" x="13.2" y="5.2" width="4.1" height="13.6" rx="1.65" /></>}
    {name === 'play' && <path className="story-control-fill story-control-play" d="M8.2 7.25c0-1.03 1.12-1.67 2.01-1.15l7.95 4.75c.86.51.86 1.79 0 2.3l-7.95 4.75c-.89.52-2.01-.12-2.01-1.15v-9.5Z" />}
    {name === 'more' && <><circle className="story-control-fill" cx="5" cy="12" r="1.65" /><circle className="story-control-fill" cx="12" cy="12" r="1.65" /><circle className="story-control-fill" cx="19" cy="12" r="1.65" /></>}
  </svg>
}
