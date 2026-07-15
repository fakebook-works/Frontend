import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  showLabel: string
  hideLabel: string
}

export function PasswordField({ showLabel, hideLabel, className, ...inputProps }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={`password-field${className ? ` ${className}` : ''}`}>
      <input {...inputProps} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}

function EyeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.7 12s3.4-6 9.3-6 9.3 6 9.3 6-3.4 6-9.3 6-9.3-6-9.3-6Z" /><circle cx="12" cy="12" r="2.7" /></svg>
}

function EyeOffIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5.9 0 9.3 6 9.3 6a15 15 0 0 1-2.1 2.8M6.1 6.1C3.9 7.7 2.7 12 2.7 12s3.4 6 9.3 6a9.8 9.8 0 0 0 3.5-.6M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
}
