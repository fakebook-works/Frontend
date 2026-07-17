import { useState } from 'react'
import type { UserSummary } from '../api/types'
import { useI18n } from '../i18n'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { VerifiedBadge } from './VerifiedBadge'

export default function TagPeoplePicker({ people, selected, onToggle, onDone, onCancel }: { people: UserSummary[]; selected: UserSummary[]; onToggle: (person: UserSummary) => void; onDone: () => void; onCancel: () => void }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const selectedIds = new Set(selected.map((person) => person.id))
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visiblePeople = normalizedQuery
    ? people.filter((person) => `${person.displayName} ${person.username}`.toLocaleLowerCase().includes(normalizedQuery))
    : people

  return <div className="modal-backdrop home-tag-picker-backdrop" role="presentation" onClick={onCancel}>
    <section className="modal home-tag-picker" role="dialog" aria-modal="true" aria-label={t('tagPeople')} onClick={(event) => event.stopPropagation()}>
      <header className="home-tag-picker-head"><button type="button" className="icon-circle" aria-label={t('back')} onClick={onCancel}><Icon name="back" /></button><h2>{t('tagPeople')}</h2></header>
      <div className="home-tag-picker-body">
        <div className="home-tag-search-row"><label><Icon name="search" size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search')} /></label><button type="button" onClick={onDone}>{t('done')}</button></div>
        <section className="home-tag-selected"><h3>{t('taggedPeople')}</h3><div>{selected.length === 0 ? <p>{t('noTaggedPeople')}</p> : selected.map((person) => <span key={person.id}>{person.displayName}<button type="button" aria-label={`${t('removeTag')} ${person.displayName}`} onClick={() => onToggle(person)}><Icon name="close" size={14} /></button></span>)}</div></section>
        <section className="home-tag-suggestions"><h3>{t('suggestions')}</h3>{visiblePeople.length === 0 ? <p>{t('noFriendsFound')}</p> : <div>{visiblePeople.map((person) => <button type="button" className={selectedIds.has(person.id) ? 'selected' : ''} key={person.id} onClick={() => onToggle(person)}><Avatar name={person.displayName} src={person.avatarUrl} size={44} /><span><strong>{person.displayName}<VerifiedBadge verified={person.isVerified} size={12} /></strong><small>{t('friends')}</small></span>{selectedIds.has(person.id) && <i><Icon name="check" size={15} /></i>}</button>)}</div>}</section>
      </div>
    </section>
  </div>
}
