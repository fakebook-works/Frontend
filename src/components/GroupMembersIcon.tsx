export function GroupMembersIcon({
  size = 24,
  className,
  fill = 'currentColor',
  cutout = 'var(--group-members-icon-cutout, var(--group-nav-icon-bg, transparent))',
  cutoutStrokeWidth = 1.15,
  contentOffsetX = 0,
  contentOffsetY = -1.05,
}: {
  size?: number
  className?: string
  fill?: string
  cutout?: string
  cutoutStrokeWidth?: number
  contentOffsetX?: number
  contentOffsetY?: number
}) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <g
      transform={`translate(${contentOffsetX} ${contentOffsetY})`}
      fill={fill}
      stroke={cutout}
      strokeWidth={cutoutStrokeWidth}
      strokeLinejoin="round"
    >
      <path d="M0-1.8c-4.2 0-7 2.5-7 6.2 0 1.2 1.25 2.17 2.8 2.17h8.4C5.75 6.57 7 5.6 7 4.4 7 .7 4.2-1.8 0-1.8Z" transform="translate(6.15 13.85) scale(.78)" vectorEffect="non-scaling-stroke" />
      <path d="M0-1.8c-4.2 0-7 2.5-7 6.2 0 1.2 1.25 2.17 2.8 2.17h8.4C5.75 6.57 7 5.6 7 4.4 7 .7 4.2-1.8 0-1.8Z" transform="translate(17.85 13.85) scale(.78)" vectorEffect="non-scaling-stroke" />
      <path d="M0-1.8c-4.2 0-7 2.5-7 6.2 0 1.2 1.25 2.17 2.8 2.17h8.4C5.75 6.57 7 5.6 7 4.4 7 .7 4.2-1.8 0-1.8Z" transform="translate(12 14.9) scale(.97)" vectorEffect="non-scaling-stroke" />
      <circle cx="6.15" cy="8.7" r="3" />
      <circle cx="17.85" cy="8.7" r="3" />
      <circle cx="12" cy="8.75" r="3.4" strokeWidth={cutoutStrokeWidth * (1.2 / 1.15)} />
    </g>
  </svg>
}

export function GroupMembershipIcon({ badge, size = 20 }: { badge: 'plus' | 'arrow' | 'check'; size?: number }) {
  return <span className={`group-membership-status-icon badge-${badge}`} style={{ width: size, height: size }} aria-hidden="true">
    <GroupMembersIcon size={size} />
    <span className="group-membership-status-badge">
      {badge === 'plus'
        ? <svg viewBox="0 0 12 12"><path d="M6 2.1v7.8M2.1 6h7.8" /></svg>
        : badge === 'arrow'
          ? <svg viewBox="0 0 12 12"><path d="M2 6h7M6.5 2.6 10 6 6.5 9.4" /></svg>
          : <svg viewBox="0 0 12 12"><path d="m2.1 6.2 2.45 2.4L9.9 3.3" /></svg>}
    </span>
  </span>
}
