import { useId } from 'react'
import { FriendPeopleGlyph, FriendPersonActionGlyph, FriendPersonGlyph, FriendPersonShape } from './FriendPeopleGlyph'

// Filled glyph set used across the UI. Single-path 24x24 icons drawn with
// currentColor so callers control size/color via CSS.
export type IconName =
  | 'home'
  | 'friends'
  | 'user'
  | 'watch'
  | 'groups'
  | 'menu'
  | 'messenger'
  | 'bell'
  | 'search'
  | 'like'
  | 'likeOutline'
  | 'comment'
  | 'commentOutline'
  | 'share'
  | 'shareOutline'
  | 'more'
  | 'photo'
  | 'video'
  | 'feeling'
  | 'close'
  | 'edit'
  | 'compose'
  | 'trash'
  | 'globe'
  | 'lock'
  | 'caret'
  | 'plus'
  | 'camera'
  | 'settings'
  | 'logout'
  | 'bookmark'
  | 'location'
  | 'check'
  | 'userPlus'
  | 'userMinus'
  | 'block'
  | 'gift'
  | 'clock'
  | 'tag'
  | 'send'
  | 'phone'
  | 'info'
  | 'mic'
  | 'sticker'
  | 'back'
  | 'play'
  | 'pause'
  | 'volume'
  | 'volumeOff'
  | 'eye'
  | 'expand'
  | 'link'
  | 'bookOpen'

const PATHS: Record<IconName, string> = {
  home: 'M11.3 3.3 3 10.5c-.3.3-.5.7-.5 1.1V20a1 1 0 0 0 1 1h5v-6h7v6h5a1 1 0 0 0 1-1v-8.4c0-.4-.2-.8-.5-1.1L12.7 3.3a1 1 0 0 0-1.4 0z',
  friends:
    'M16.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-7.5 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 1.5c-3 0-7 1.6-7 4.7V21h14v-2.8c0-3.1-4-4.7-7-4.7zm7.5.2c.5.8.8 1.7.8 2.5V21H23v-2.5c0-2.4-3.1-3.9-6-4.3-.4.1-.8.2-1 .7z',
  user:
    'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z',
  watch:
    'M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5l-3 3-3-3H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm6 3v8l6.5-4L10 7z',
  groups:
    'M12 12.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5zM5.5 10A2.5 2.5 0 1 0 5.5 5a2.5 2.5 0 0 0 0 5zm13 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM12 13.5c-2.7 0-5.5 1.4-5.5 3.6V19h11v-1.9c0-2.2-2.8-3.6-5.5-3.6zM4.5 11.5c-2 0-4 1.1-4 2.9V16H5v-1.4c0-1 .5-1.9 1.3-2.6-.6-.3-1.2-.5-1.8-.5zm15 0c-.6 0-1.2.2-1.8.5.8.7 1.3 1.6 1.3 2.6V16h4.5v-1.6c0-1.8-2-2.9-4-2.9z',
  menu: 'M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z',
  messenger:
    'M12 2C6.5 2 2 6.1 2 11.2c0 2.9 1.4 5.5 3.7 7.2V22l3.4-1.9c.9.2 1.9.4 2.9.4 5.5 0 10-4.1 10-9.2S17.5 2 12 2zm1 12.4-2.6-2.7-4.9 2.7 5.4-5.7 2.6 2.7 4.8-2.7-5.3 5.7z',
  bell: 'M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-5-2-2v-4a5 5 0 0 0-4-4.9V5a1 1 0 0 0-2 0v1.1A5 5 0 0 0 7 11v4l-2 2v1h14v-1z',
  search:
    'M10 4a6 6 0 1 0 3.5 10.9l4.3 4.3 1.4-1.4-4.3-4.3A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
  like: 'M2 9.5h3.2V21H2V9.5zM7 21h9.6c.85 0 1.6-.53 1.9-1.32l2.36-5.6c.09-.22.14-.46.14-.7V11.4c0-1.1-.9-2-2-2h-5.04l.76-3.66.02-.26c0-.41-.17-.79-.44-1.06L13.5 3.2 7.6 9.1c-.36.36-.6.86-.6 1.4V21z',
  likeOutline: 'M7.5 21H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3.5m0 11V10l4.2-6.1a2 2 0 0 1 3.6 1.5L14.7 10H19a2 2 0 0 1 1.9 2.6l-2.1 6.8A2.3 2.3 0 0 1 16.6 21H7.5z',
  comment:
    'M12 3C6.5 3 2 6.7 2 11.3c0 2.6 1.4 4.9 3.6 6.4-.1 1.1-.6 2.4-1.6 3.3 1.6-.1 3.4-.6 4.8-1.6 1 .25 2 .4 3.2.4 5.5 0 10-3.7 10-8.3S17.5 3 12 3z',
  commentOutline: 'M21 11.5c0 4.7-4.1 8.5-9.2 8.5-1.1 0-2.2-.2-3.2-.5L4 21l1.4-4C3.9 15.5 3 13.6 3 11.5 3 6.8 7.1 3 12 3s9 3.8 9 8.5z',
  share: 'M14 9V4.5L22 12l-8 7.5V15c-5 0-8.5 1.6-11 5 1-5 4-10 11-11z',
  shareOutline: 'M14 9V4.5L22 12l-8 7.5V15c-4.7 0-8.3 1.5-11 5 .8-5.4 4.3-10.5 11-11z',
  bookOpen: 'M3.5 5.25c3.25-.7 6.15.05 8.5 2.1v11.4c-2.35-2.05-5.25-2.8-8.5-2.1V5.25Zm17 0c-3.25-.7-6.15.05-8.5 2.1v11.4c2.35-2.05 5.25-2.8 8.5-2.1V5.25Z',
  more: 'M6 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  photo:
    'M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM5 19l4-5 2.5 3 3.5-4.5L19 19H5z',
  video:
    'M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z',
  feeling:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-3.5 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM12 17.5c-2.3 0-4.3-1.4-5-3.5h10c-.7 2.1-2.7 3.5-5 3.5z',
  close: 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z',
  edit: 'M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  compose: 'M13.5 5H6.25A2.25 2.25 0 0 0 4 7.25v10.5A2.25 2.25 0 0 0 6.25 20h10.5A2.25 2.25 0 0 0 19 17.75V10.5M10.25 14.1l.45-2.55 6.8-6.8a1.75 1.75 0 0 1 2.48 2.48l-6.8 6.8-2.93.07Z',
  trash: 'M6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7zm3-3h6l1 2h4v2H4V6h4l1-2z',
  globe:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.8a14 14 0 0 0-1.2-3.2A8 8 0 0 1 18.9 8zM12 4c.8 1.1 1.4 2.5 1.8 4h-3.6c.4-1.5 1-2.9 1.8-4zM4.3 14a8 8 0 0 1 0-4h3a17 17 0 0 0 0 4h-3zm.8 2h2.8c.3 1.2.7 2.3 1.2 3.2A8 8 0 0 1 5.1 16zm2.8-8H5.1a8 8 0 0 1 4-3.2A14 14 0 0 0 7.9 8zM12 20c-.8-1.1-1.4-2.5-1.8-4h3.6c-.4 1.5-1 2.9-1.8 4zm2.2-6H9.8a15 15 0 0 1 0-4h4.4a15 15 0 0 1 0 4zm.7 5.2c.5-1 .9-2 1.2-3.2h2.8a8 8 0 0 1-4 3.2zm1.6-5.2a17 17 0 0 0 0-4h3a8 8 0 0 1 0 4h-3z',
  lock: 'M17 9V7a5 5 0 0 0-10 0v2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zM9 7a3 3 0 0 1 6 0v2H9V7z',
  caret: 'M7 10l5 5 5-5z',
  plus: 'M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z',
  camera:
    'M9 4 7.2 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.2L15 4H9zm3 5a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
  settings:
    'M19.4 13a7.8 7.8 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7 7 0 0 0-1.7-1L15 2.4H9.6L9 4.9a7 7 0 0 0-1.7 1l-2.5-1-2 3.5L2.9 11a7.8 7.8 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1L9 21.6h5.4l.6-2.5c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5L19.4 13zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z',
  logout: 'M16 13v-2H7V8l-5 4 5 4v-3h9zM20 3h-9a2 2 0 0 0-2 2v4h2V5h9v14h-9v-4H9v4a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z',
  bookmark: 'M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z',
  location: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  userPlus:
    'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3.3 0-7 1.7-7 5v1h11.4A6 6 0 0 1 15 18.5 13 13 0 0 0 9 14zm10 0v-3h-2v3h-3v2h3v3h2v-3h3v-2h-3z',
  userMinus:
    'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3.3 0-7 1.7-7 5v1h11.4a6 6 0 0 1 1.6-1.5A13 13 0 0 0 9 14zm5 0h8v2h-8v-2z',
  block: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM5.9 7.3 16.7 18.1A8 8 0 0 1 5.9 7.3zm12.2 9.4L7.3 5.9a8 8 0 0 1 10.8 10.8z',
  gift:
    'M20 7h-3.2a3 3 0 0 0-4.8-3.6A3 3 0 0 0 7.2 7H4a1 1 0 0 0-1 1v2h8V8h2v2h8V8a1 1 0 0 0-1-1zm-8.5 0H10a1 1 0 1 1 1-1v1h.5zm3 0H14V6a1 1 0 1 1 1 1h-.5zM4 11v9a1 1 0 0 0 1 1h6V11H4zm9 10h6a1 1 0 0 0 1-1v-9h-7v10z',
  clock:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.2 3.1.8-1.3-4.5-2.7V7z',
  tag: 'M21.4 11.6 12.4 2.6A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 .6 1.4l9 9a2 2 0 0 0 2.8 0l7-7a2 2 0 0 0 0-2.8zM6.5 8A1.5 1.5 0 1 1 6.5 5a1.5 1.5 0 0 1 0 3z',
  send: 'M2 21 23 12 2 3v7l13 2-13 2v7z',
  phone:
    'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1.5 1.5 0 0 1 1.5-.36c1.65.55 3.43.84 5.1.84V22a20 20 0 0 1-20-20h6.3c0 1.67.29 3.45.84 5.1.17.53.03 1.11-.36 1.5l-2.18 2.2z',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
  mic:
    'M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1a7 7 0 0 0 6-6.9h-2z',
  sticker:
    'M5 3.5h14a1.5 1.5 0 0 1 1.5 1.5v9.2L14.2 20.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5zm9 17v-4.8a1.5 1.5 0 0 1 1.5-1.5h5M8.5 9h.01M15.5 9h.01M8.5 12.5c.9 1.1 2.1 1.7 3.5 1.7s2.6-.6 3.5-1.7',
  back: 'M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2z',
  play: 'M8 5v14l11-7L8 5z',
  pause: 'M6 5h4v14H6V5zm8 0h4v14h-4V5z',
  volume: 'M3 9v6h4l5 4V5L7 9H3zm12.5 3a3.5 3.5 0 0 0-2-3.15v6.3A3.5 3.5 0 0 0 15.5 12zm0-7.1v2.05a6 6 0 0 1 0 10.1v2.05a8 8 0 0 0 0-14.2z',
  volumeOff: 'M3 9v6h4l5 4V5L7 9H3zm12.1.1-1.4 1.4L15.2 12l-1.5 1.5 1.4 1.4 1.5-1.5 1.5 1.5 1.4-1.4L18 12l1.5-1.5-1.4-1.4-1.5 1.5-1.5-1.5z',
  eye: 'M12 5c-5.5 0-9.5 7-9.5 7s4 7 9.5 7 9.5-7 9.5-7S17.5 5 12 5zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  expand: 'M4 4h6v2H7.4l3.3 3.3-1.4 1.4L6 7.4V10H4V4zm10 0h6v6h-2V7.4l-3.3 3.3-1.4-1.4L16.6 6H14V4zM9.3 13.3l1.4 1.4L7.4 18H10v2H4v-6h2v2.6l3.3-3.3zm5.4 0 3.3 3.3V14h2v6h-6v-2h2.6l-3.3-3.3 1.4-1.4z',
  link: 'M10.6 13.4a4 4 0 0 0 5.66 0l2.14-2.14a4 4 0 0 0-5.66-5.66l-1.22 1.22M13.4 10.6a4 4 0 0 0-5.66 0L5.6 12.74a4 4 0 1 0 5.66 5.66l1.22-1.22',
}

export function SavedShortcutIcon({ size = 20, className }: { size?: number; className?: string }) {
  const gradientId = `saved-shortcut-${useId().replace(/:/g, '')}`

  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="5" y1="2" x2="19" y2="22.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b469f2" />
          <stop offset="0.52" stopColor="#8a5bea" />
          <stop offset="1" stopColor="#6558ee" />
        </linearGradient>
      </defs>
      <path d="M7.2 2.2h9.6a2 2 0 0 1 2 2v17.05c0 1.03-1.15 1.65-2.01 1.08l-3.97-2.62a1.5 1.5 0 0 0-1.64 0l-3.97 2.62c-.86.57-2.01-.05-2.01-1.08V4.2a2 2 0 0 1 2-2Z" fill={`url(#${gradientId})`} stroke={`url(#${gradientId})`} strokeWidth="0.7" strokeLinejoin="round" />
    </svg>
  )
}

export function FriendsShortcutIcon({ size = 20, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  const frontGradientId = `friends-front-${id}`
  const backGradientId = `friends-back-${id}`

  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={frontGradientId} x1="3" y1="4" x2="15.5" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#48c9f4" />
          <stop offset="1" stopColor="#1877f2" />
        </linearGradient>
        <linearGradient id={backGradientId} x1="14" y1="4" x2="21.5" y2="19" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff9b62" />
          <stop offset="1" stopColor="#ef5e6f" />
        </linearGradient>
      </defs>
      <g fill={`url(#${backGradientId})`}><FriendPersonShape transform="translate(15 11.5) scale(.9)" /></g>
      <FriendPersonShape className="friends-shortcut-separator" transform="translate(8 14.4) scale(.9)" />
      <g fill={`url(#${frontGradientId})`}><FriendPersonShape transform="translate(8 14.4) scale(.9)" /></g>
    </svg>
  )
}

export function GroupsShortcutIcon({ size = 20, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  const centerGradientId = `groups-center-${id}`
  const leftGradientId = `groups-left-${id}`
  const rightGradientId = `groups-right-${id}`

  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={centerGradientId} x1="7" y1="5" x2="17" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#43c5f5" />
          <stop offset="1" stopColor="#2767e8" />
        </linearGradient>
        <linearGradient id={leftGradientId} x1="1" y1="5" x2="9" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#75d9f7" />
          <stop offset="1" stopColor="#399ce8" />
        </linearGradient>
        <linearGradient id={rightGradientId} x1="16" y1="5" x2="23" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#63d8ae" />
          <stop offset="1" stopColor="#20a987" />
        </linearGradient>
      </defs>
      <circle cx="5.25" cy="8.4" r="2.75" fill={`url(#${leftGradientId})`} />
      <path d="M.75 18.35v-.72c0-2.9 1.88-4.82 4.67-4.82 1.22 0 2.28.37 3.08 1.04A7.2 7.2 0 0 0 6.35 19v.32H1.72a.97.97 0 0 1-.97-.97Z" fill={`url(#${leftGradientId})`} stroke={`url(#${leftGradientId})`} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18.75" cy="8.4" r="2.75" fill={`url(#${rightGradientId})`} />
      <path d="M23.25 18.35v-.72c0-2.9-1.88-4.82-4.67-4.82-1.22 0-2.28.37-3.08 1.04A7.2 7.2 0 0 1 17.65 19v.32h4.63c.54 0 .97-.43.97-.97Z" fill={`url(#${rightGradientId})`} stroke={`url(#${rightGradientId})`} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="7.55" r="3.55" fill={`url(#${centerGradientId})`} />
      <path d="M5.75 21v-1.08c0-3.82 2.66-6.35 6.25-6.35s6.25 2.53 6.25 6.35V21H5.75Z" fill={`url(#${centerGradientId})`} stroke={`url(#${centerGradientId})`} strokeWidth="0.85" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ReelIcon({
  size = 20,
  className,
  filled = false,
  gradient = false,
  dividerColor,
}: {
  size?: number
  className?: string

  filled?: boolean
  gradient?: boolean
  dividerColor?: string
}) {
  const id = useId().replace(/:/g, '')
  const gradientId = `reel-gradient-${id}`
  const maskId = `reel-mask-${id}`

  if (filled) {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ff7095" />
            <stop offset="0.5" stopColor="#f24364" />
            <stop offset="1" stopColor="#d92343" />
          </linearGradient>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            <rect x="2.5" y="2.5" width="19" height="19" rx="3.4" fill="#fff" />
            <path d="M2.9 8.7h18.2M7.4 2.9l3.3 5.8m2.8-5.8 3.3 5.8" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10.05 11.72c0-.64.7-1.04 1.25-.72l4.56 2.64c.55.32.55 1.12 0 1.44l-4.56 2.64c-.55.32-1.25-.08-1.25-.72v-5.28Z" fill="#000" />
          </mask>
        </defs>
        <rect width="24" height="24" fill={gradient ? `url(#${gradientId})` : 'currentColor'} mask={`url(#${maskId})`} />
        {dividerColor && <path className="reel-icon-divider" d="M2.9 8.7h18.2M7.4 2.9l3.3 5.8m2.8-5.8 3.3 5.8" fill="none" stroke={dividerColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    )
  }

  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="2.8" y="2.8" width="18.4" height="18.4" rx="3.2" />
      <path d="M3.2 8.7h17.6M7.5 3.2l3.15 5.5m2.8-5.5 3.15 5.5" />
      <path d="m10.1 11.9 5.2 3.1-5.2 3.1v-6.2Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function LiveVideoIcon({ size = 20, className }: { size?: number; className?: string }) {
  const eyeMaskId = `live-video-eye-${useId().replace(/:/g, '')}`

  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <mask id={eyeMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="#000" />
          <rect x="2" y="5.2" width="14.4" height="13.6" rx="3.2" fill="#fff" />
          <path d="m17.45 9.05 3.6-2.1c.43-.25.95.06.95.55v9c0 .49-.52.8-.95.55l-3.6-2.1v-5.9Z" fill="#fff" />
          <path d="M4.35 12s2.23-3.15 5.1-3.15 5.1 3.15 5.1 3.15-2.23 3.15-5.1 3.15S4.35 12 4.35 12Z" fill="#000" />
        </mask>
      </defs>
      <rect width="24" height="24" fill="currentColor" mask={`url(#${eyeMaskId})`} />
      <circle cx="9.45" cy="12" r="1.22" fill="currentColor" />
    </svg>
  )
}

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName
  size?: number
  className?: string

}) {
  if (name === 'friends') return <FriendPeopleGlyph className={className} filled size={size} />
  if (name === 'user') return <FriendPersonGlyph className={className} size={size} />
  if (name === 'userPlus') return <FriendPersonActionGlyph action="add" className={className} size={size} />
  if (name === 'userMinus') return <FriendPersonActionGlyph action="remove" className={className} size={size} />
  if (name === 'block') return <FriendPersonActionGlyph action="block" className={className} size={size} />
  const outline = name === 'likeOutline' || name === 'commentOutline' || name === 'shareOutline' || name === 'sticker' || name === 'link' || name === 'compose' || name === 'bookOpen'
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={outline ? 'none' : 'currentColor'}
      stroke={outline ? 'currentColor' : undefined}
      strokeWidth={outline ? 1.8 : undefined}
      strokeLinecap={outline ? 'round' : undefined}
      strokeLinejoin={outline ? 'round' : undefined}
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
