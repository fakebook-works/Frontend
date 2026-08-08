import { useI18n } from '../i18n'

export function VerifiedBadge({ verified, size = 15, marginLeft = 0 }: { verified?: boolean; size?: number; marginLeft?: number }) {
  const { t } = useI18n()
  if (!verified) return null

  return (
    <span className="verified-badge" title={t('verifiedAccount')} aria-label={t('verifiedAccount')} style={{ width: size, height: size, marginLeft }}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23,12l-2.44-2.79l0.34-3.69l-3.61-0.82L15.4,1.5L12,2.96L8.6,1.5L6.71,4.69L3.1,5.5L3.44,9.2L1,12l2.44,2.79l-0.34,3.7l3.61,0.82L8.6,22.5l3.4-1.47l3.4,1.46l1.89-3.19l3.61-0.82l-0.34-3.69L23,12z"/><path className="verified-check" d="m8.2 12.1 2.3 2.3 5.3-5.2"/></svg>
    </span>
  )
}
