import type { UserProfile } from '../api/types'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'

export function ProfilePage({ profile, loading, error, canEdit, onEdit }: { profile: UserProfile | null; loading: boolean; error: string | null; canEdit: boolean; onEdit: () => void }) {
  const { t } = useI18n()
  if (loading) return <main className="profile-destination"><div className="card state-card"><span className="spinner" /></div></main>
  if (!profile) return <main className="profile-destination"><div className="card state-card"><h2>{t('profileUnavailable')}</h2><p>{error || t('profileLoadError')}</p></div></main>

  return (
    <main className="profile-destination">
      <section className="profile-cover-card">
        <div className="profile-cover" />
        <div className="profile-destination-header">
          <Avatar name={profile.displayName} src={profile.avatarUrl} size={164} />
          <div className="profile-destination-title"><h1>{profile.displayName}<VerifiedBadge verified={profile.isVerified} size={20} /></h1><p>{profile.friendCount} {t('friends')} · {profile.postCount} {t('postsLabel')}</p></div>
          {canEdit && <button type="button" className="btn-soft" onClick={onEdit}><Icon name="edit" size={17} />{t('editProfile')}</button>}
        </div>
        <nav className="profile-tabs"><button type="button" className="active">{t('postsLabel')}</button><button type="button" disabled>{t('about')}</button><button type="button" disabled>{t('friends')}</button></nav>
      </section>
      <div className="profile-destination-grid">
        <aside className="card profile-intro"><h2>{t('intro')}</h2>{profile.bio && <p>{profile.bio}</p>}{profile.location && <p><Icon name="location" size={18} />{t('livesIn', { location: profile.location })}</p>}{canEdit && <button type="button" className="btn-soft block" onClick={onEdit}>{t('editDetails')}</button>}</aside>
        <section className="card state-card"><h2>{t('profileNoPosts')}</h2><p>{canEdit ? t('yourPostsEmpty') : t('userPostsEmpty', { name: profile.displayName.split(' ')[0] })}</p></section>
      </div>
    </main>
  )
}
