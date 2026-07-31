export function FriendPeopleGlyph({
  filled,
  className,
}: {
  filled: boolean
  className?: string
}) {
  const classes = ['friend-people-glyph', filled ? 'is-filled' : 'is-outline', className].filter(Boolean).join(' ')
  return <svg
    className={classes}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke={filled ? 'none' : 'currentColor'}
    strokeWidth={filled ? undefined : 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <FriendPersonShape className="friend-people-person" transform="translate(15 11.5) scale(.9)" />
    <FriendPersonShape className="friend-people-separator" transform="translate(8 14.4) scale(.9)" />
    <FriendPersonShape className="friend-people-person friend-people-front" transform="translate(8 14.4) scale(.9)" />
  </svg>
}

export function FriendPersonShape({ className, transform }: { className?: string; transform: string }) {
  return <g className={className} transform={transform}>
    <circle cx="0" cy="-6.2" r="3.5" />
    <path d="M0-1.8c-4.2 0-7 2.5-7 6.2 0 1.2.97 2.17 2.17 2.17h9.66C6.03 6.57 7 5.6 7 4.4 7 .7 4.2-1.8 0-1.8Z" />
  </g>
}
