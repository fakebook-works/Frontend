export interface PostTimestamp {
  display: string
  detail: string
}

function isSameCalendarDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

function clockTime(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value)
}

function detailedTime(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(value)
}

export function formatPostTimestamp(value: string, locale: string, now = new Date()): PostTimestamp {
  const created = new Date(value)
  if (Number.isNaN(created.getTime())) return { display: value, detail: value }

  const isVietnamese = locale.toLowerCase().startsWith('vi')
  const detail = detailedTime(created, locale)
  const differenceMs = Math.max(0, now.getTime() - created.getTime())

  if (isSameCalendarDay(created, now)) {
    const minutes = Math.floor(differenceMs / 60_000)
    if (minutes < 1) {
      return { display: isVietnamese ? 'Vừa xong' : 'Just now', detail }
    }

    const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'always' })
    if (minutes < 60) return { display: relative.format(-minutes, 'minute'), detail }
    return { display: relative.format(-Math.floor(minutes / 60), 'hour'), detail }
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameCalendarDay(created, yesterday)) {
    const time = clockTime(created, locale)
    return { display: isVietnamese ? `Hôm qua lúc ${time}` : `Yesterday at ${time}`, detail }
  }

  const time = clockTime(created, locale)
  if (created.getFullYear() === now.getFullYear()) {
    const date = isVietnamese
      ? `${created.getDate()} tháng ${created.getMonth() + 1}`
      : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(created)
    return { display: `${date} ${isVietnamese ? 'lúc' : 'at'} ${time}`, detail }
  }

  const date = isVietnamese
    ? `${created.getDate()} tháng ${created.getMonth() + 1}, ${created.getFullYear()}`
    : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(created)
  return { display: `${date} ${isVietnamese ? 'lúc' : 'at'} ${time}`, detail }
}
