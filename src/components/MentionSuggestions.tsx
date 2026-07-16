import type { UserSummary } from '../api/types'
import { Avatar } from './Avatar'
import { VerifiedBadge } from './VerifiedBadge'
import { useI18n } from '../i18n'
import { activeMention } from '../lib/mentions'

export function MentionSuggestions({ text, people, onTextChange, onSelected }: { text: string; people: UserSummary[]; onTextChange: (value: string) => void; onSelected: (person: UserSummary) => void }) {
  const { t } = useI18n()
  const mention = activeMention(text)
  if (!mention) return null
  const matches = people.filter((person) => person.displayName.toLocaleLowerCase().includes(mention.query)).slice(0, 6)
  if (matches.length === 0) return <div className="mention-suggestions empty">{t('noFriendsFound')}</div>
  return <div className="mention-suggestions" role="listbox" aria-label={t('mentionPeople')}>{matches.map((person) => <button type="button" role="option" aria-selected="false" key={person.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { onTextChange(`${text.slice(0, mention.start)}@${person.displayName} `); onSelected(person) }}><Avatar name={person.displayName} src={person.avatarUrl} size={34} /><span><strong>{person.displayName}<VerifiedBadge verified={person.isVerified} /></strong><small>{t('fakebookFriend')}</small></span></button>)}</div>
}
