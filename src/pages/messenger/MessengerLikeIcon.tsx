interface MessengerLikeIconProps {
  size?: number
  className?: string
}

export function MessengerLikeIcon({ size = 24, className }: MessengerLikeIconProps) {
  return <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="2" y="30" width="14" height="32" rx="4" />
    <path d="M20 31.5c5.3-3.7 8.9-9.4 10.3-16.2l1.5-7.2C32.6 4.5 35 2 38.1 2c3.5 0 6.2 3.2 5.5 6.7L41 21.8h10.7c5.5 0 9.8 3.2 9.8 7.5 0 3.4-2.5 6.2-6.1 7 3.8.4 6.6 2.9 6.6 6.2 0 3.4-2.7 6.1-6.7 6.5 2.8.8 4.7 3 4.7 5.7 0 4.1-3.6 7.3-8.2 7.3H28.3C23.7 62 20 58.4 20 54z" />
  </svg>
}
