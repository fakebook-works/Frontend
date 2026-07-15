import { getPasswordStrength } from '../lib/password'

const strengthSteps = ['weak', 'fair', 'good', 'strong'] as const

export function PasswordStrengthMeter({ password, labels }: {
  password: string
  labels: Record<(typeof strengthSteps)[number], string>
}) {
  if (!password) return null
  const strength = getPasswordStrength(password)
  const activeSteps = strengthSteps.indexOf(strength) + 1

  return (
    <div className={`password-strength is-${strength}`} role="status" aria-live="polite">
      <div className="password-strength-bars" aria-hidden="true">
        {strengthSteps.map((step, index) => <span className={index < activeSteps ? 'active' : ''} key={step} />)}
      </div>
      <span>{labels[strength]}</span>
    </div>
  )
}
