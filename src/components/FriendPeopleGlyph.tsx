export function FriendPeopleGlyph({
  filled,
  className,
  size,
}: {
  filled: boolean
  className?: string
  size?: number
}) {
  const classes = ['friend-people-glyph', filled ? 'is-filled' : 'is-outline', className].filter(Boolean).join(' ')
  return <svg
    className={classes}
    width={size}
    height={size}
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

export function FriendPersonGlyph({ className, size }: { className?: string; size?: number }) {
  const classes = ['friend-person-glyph', className].filter(Boolean).join(' ')
  return <svg
    className={classes}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <FriendPersonShape transform="translate(12 13)" />
  </svg>
}

export type FriendPersonAction = 'add' | 'remove' | 'request-sent' | 'request-received' | 'list' | 'check' | 'cancel' | 'block'

function FriendPersonActionSymbol({ action }: { action: FriendPersonAction }) {
  if (action === 'block') return <><circle cx="16.7" cy="18.75" r="2.95" /><path d="m14.62 16.67 4.16 4.16" /></>
  if (action === 'check') return <path d="m12.95 19.05 2.05 1.95 4.15-4.4" />
  if (action === 'cancel') return <path d="m14.25 16.4 4.65 4.65m0-4.65-4.65 4.65" />
  const path = action === 'remove'
    ? 'M12.7 19.2h6.1'
    : action === 'request-sent'
      ? 'M12.1 19.2h6.7m-2.35-2.35 2.35 2.35-2.35 2.35'
      : action === 'request-received'
        ? 'M18.8 19.2h-6.7m2.35-2.35-2.35 2.35 2.35 2.35'
        : action === 'list'
          ? 'M12.3 17.7h6.4m-6.4 3.15h4.1'
          : 'M15.8 16.1v6.2m-3.1-3.1h6.2'
  return <path d={path} />
}

export function FriendPersonActionGlyph({
  action,
  className,
  size,
}: {
  action: FriendPersonAction
  className?: string
  size?: number
}) {
  const classes = ['friend-person-action-glyph', `is-${action}`, className].filter(Boolean).join(' ')
  return <svg
    className={classes}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <FriendPersonShape className="friend-person-action-person" transform="translate(12 13)" />
    <g className="friend-person-action-symbol-outline"><FriendPersonActionSymbol action={action} /></g>
    <g className="friend-person-action-symbol"><FriendPersonActionSymbol action={action} /></g>
  </svg>
}
