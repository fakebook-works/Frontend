function startOfLocalWeek(value: Date): number {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate())
  const mondayOffset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - mondayOffset)
  return date.getTime()
}

function sameLocalDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

function clockTime(value: Date): string {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
}

export function formatMessageHoverTime(createdAt: string, nowValue: Date | number = new Date()): string {
  const created = new Date(createdAt)
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue)
  if (Number.isNaN(created.getTime())) return ''
  const time = clockTime(created)
  if (sameLocalDay(created, now)) return time
  if (startOfLocalWeek(created) === startOfLocalWeek(now)) {
    const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
    return `${weekdays[created.getDay()]}, ${time}`
  }
  if (created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth()) {
    return `Ngày ${created.getDate()}, ${time}`
  }
  if (created.getFullYear() === now.getFullYear()) {
    return `${created.getDate()} tháng ${created.getMonth() + 1}, ${time}`
  }
  return `${created.getDate()}/${created.getMonth() + 1}/${created.getFullYear()}, ${time}`
}
