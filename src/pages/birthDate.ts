const MIN_AGE = 14
const MAX_AGE = 120

function parseDateInput(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? { year, month, day }
    : null
}

function formatDateInput(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function subtractYearsClamped(date: Date, years: number): Date {
  const year = date.getFullYear() - years
  const month = date.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(date.getDate(), lastDay))
}

export function birthDateBounds(today = new Date()): { min: string; max: string } {
  const oldestAllowed = subtractYearsClamped(today, MAX_AGE + 1)
  oldestAllowed.setDate(oldestAllowed.getDate() + 1)
  return {
    min: formatDateInput(oldestAllowed),
    max: formatDateInput(subtractYearsClamped(today, MIN_AGE)),
  }
}

export function isAllowedBirthDate(value: string, today = new Date()): boolean {
  const birthDate = parseDateInput(value)
  if (!birthDate) return false
  let age = today.getFullYear() - birthDate.year
  const currentMonth = today.getMonth() + 1
  if (currentMonth < birthDate.month || (currentMonth === birthDate.month && today.getDate() < birthDate.day)) age -= 1
  return age >= MIN_AGE && age <= MAX_AGE
}
