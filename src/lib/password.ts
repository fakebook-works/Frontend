export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong'

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return 'weak'

  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  if (score >= 5) return 'strong'
  if (score >= 4) return 'good'
  if (score >= 2) return 'fair'
  return 'weak'
}
