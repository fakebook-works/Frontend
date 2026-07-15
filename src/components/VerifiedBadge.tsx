import { useI18n } from '../i18n'

export function VerifiedBadge({ verified, size = 15 }: { verified?: boolean; size?: number }) {
  const { t } = useI18n()
  if (!verified) return null

  return (
    <span className="verified-badge" title={t('verifiedAccount')} aria-label={t('verifiedAccount')} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 2.2 2.1 3-.3.8 2.9 2.7 1.5-1.2 2.8 1.2 2.8-2.7 1.5-.8 2.9-3-.3L12 22l-2.2-2.1-3 .3-.8-2.9-2.7-1.5L4.5 13 3.3 10.2 6 8.7l.8-2.9 3 .3L12 2Z"/><path className="verified-check" d="m8.2 12.1 2.3 2.3 5.3-5.2"/></svg>
    </span>
  )
}
