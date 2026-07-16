import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api/client'
import type { GatewayPost } from '../api/gatewayTypes'
import { socialApi, type GroupMembershipState, type SocialGroup, type SocialProfile } from '../api/social'
import type { UserSummary } from '../api/types'
import { Avatar } from '../components/Avatar'
import { ImageCropModal } from '../components/ImageCropModal'
import { Icon } from '../components/Icon'
import { MentionSuggestions } from '../components/MentionSuggestions'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useI18n } from '../i18n'
import { GatewayPostCard } from './GatewayHomePage'

type GroupSection = 'joined' | 'managed' | 'pending' | 'recent'

interface GroupCollections {
  joined: SocialGroup[]
  managed: SocialGroup[]
  pending: SocialGroup[]
  recent: SocialGroup[]
}

const EMPTY_GROUPS: GroupCollections = { joined: [], managed: [], pending: [], recent: [] }

export function GroupsPage({ userId, onNavigate }: { userId: string; onNavigate: (path: string) => void }) {
  const { t } = useI18n()
  const [collections, setCollections] = useState<GroupCollections>(EMPTY_GROUPS)
  const [section, setSection] = useState<GroupSection>('joined')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [partialError, setPartialError] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setPartialError(false)
    const [joinedResult, managedResult, pendingResult, recentResult] = await Promise.allSettled([
      socialApi.getMemberGroups(userId, 50),
      socialApi.getAdminGroups(userId, 50),
      socialApi.getPendingGroupJoins(userId, 50),
      api.visitedGroups(userId, 30),
    ])
    try {
      if ([joinedResult, managedResult, pendingResult, recentResult].every((result) => result.status === 'rejected')) {
        setCollections(EMPTY_GROUPS)
        setError(t('groupsLoadError'))
        return
      }

      const joined = joinedResult.status === 'fulfilled' ? joinedResult.value.items : []
      const managed = managedResult.status === 'fulfilled' ? managedResult.value.items : []
      const pending = pendingResult.status === 'fulfilled' ? pendingResult.value.items : []
      let recent: SocialGroup[] = []
      if (recentResult.status === 'fulfilled') {
        const details = await socialApi.getGroups(recentResult.value.items.map((group) => group.id)).catch(() => [])
        const byId = new Map(details.map((group) => [group.id, group]))
        recent = recentResult.value.items.map((group) => byId.get(group.id) ?? {
          id: group.id,
          avatarUrl: group.avatar || null,
          backgroundUrl: null,
          name: group.name,
          bio: null,
          privacy: 0,
          createdAt: '',
          memberCount: null,
          adminCount: 0,
        })
      }
      setCollections({ joined, managed, pending, recent })
      setPartialError([joinedResult, managedResult, pendingResult, recentResult].some((result) => result.status === 'rejected'))
    } finally {
      setLoading(false)
    }
  }, [t, userId])

  useEffect(() => { void load() }, [load])

  const sections: Array<{ id: GroupSection; label: string; detail: string; icon: 'groups' | 'settings' | 'clock' }> = [
    { id: 'joined', label: t('joinedGroups'), detail: t('joinedGroupsDesc'), icon: 'groups' },
    { id: 'managed', label: t('managedGroups'), detail: t('managedGroupsDesc'), icon: 'settings' },
    { id: 'pending', label: t('pendingGroups'), detail: t('pendingGroupsDesc'), icon: 'clock' },
    { id: 'recent', label: t('recentGroups'), detail: t('recentGroupsDesc'), icon: 'clock' },
  ]
  const selected = sections.find((item) => item.id === section) ?? sections[0]
  const groups = collections[section]
  const emptyDescription = section === 'recent'
    ? t('groupsEmptyDesc')
    : section === 'managed'
      ? t('managedGroupsEmpty')
      : section === 'pending'
        ? t('pendingGroupsEmpty')
        : t('joinedGroupsEmpty')

  return <main className="discovery-layout">
    <aside className="discovery-sidebar">
      <h1>{t('groups')}</h1><p>{t('groupsSubtitle')}</p>
      <nav>
        {sections.map((item) => <button type="button" className={section === item.id ? 'active' : ''} key={item.id} onClick={() => setSection(item.id)}><span><Icon name={item.icon} size={20} /></span>{item.label}<small>{collections[item.id].length}</small></button>)}
        <button type="button" onClick={() => setCreating(true)}><span><Icon name="plus" size={20} /></span>{t('createGroup')}</button>
      </nav>
    </aside>
    <section className="discovery-content">
      <header className="page-content-head"><div><h2>{selected.label}</h2><p>{selected.detail}</p></div><button type="button" className="btn-soft" onClick={() => void load()}>{t('refresh')}</button></header>
      {partialError && !loading && <p className="inline-alert">{t('groupsPartialError')}</p>}
      {loading ? <div className="card state-card"><span className="spinner" /></div> : error ? <div className="card state-card"><h2>{t('unableToLoad')}</h2><p>{error}</p><button type="button" className="btn-primary" onClick={() => void load()}>{t('tryAgain')}</button></div> : groups.length === 0 ? <div className="card state-card"><h2>{t('groupListEmpty')}</h2><p>{emptyDescription}</p>{section !== 'pending' && <button type="button" className="btn-primary" onClick={() => setCreating(true)}>{t('createGroup')}</button>}</div> : <GroupGrid groups={groups} onNavigate={onNavigate} />}
    </section>
    {creating && <CreateGroupModal userId={userId} onClose={() => setCreating(false)} onCreated={(group) => { setCreating(false); setCollections((current) => ({ ...current, managed: [group, ...current.managed.filter((item) => item.id !== group.id)] })); onNavigate(`/groups/${group.id}`) }} />}
  </main>
}

function GroupGrid({ groups, onNavigate }: { groups: SocialGroup[]; onNavigate: (path: string) => void }) {
  const { t } = useI18n()
  return <div className="group-grid">{groups.map((group) => <button type="button" className="card group-card" key={group.id} onClick={() => onNavigate(`/groups/${group.id}`)}><div className="group-card-cover" style={group.backgroundUrl ? { backgroundImage: `url(${group.backgroundUrl})` } : undefined} /><Avatar name={group.name} src={group.avatarUrl} size={64} /><strong>{group.name}</strong><small>{group.memberCount == null ? t('groupResult') : t('membersCount', { count: group.memberCount })}</small></button>)}</div>
}

function CreateGroupModal({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: (group: SocialGroup) => void }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [privacy, setPrivacy] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setBusy(true); setError(null)
    try { onCreated(await socialApi.createGroup(userId, { name: name.trim(), bio: bio.trim(), privacy })) } catch { setError(t('createGroupError')) } finally { setBusy(false) }
  }
  return <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}><form className="modal compact-form-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}><header className="modal-head"><h2>{t('createGroup')}</h2><button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button></header><div className="modal-body settings-form-grid"><label className="wide"><span>{t('groupName')}</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label><label className="wide"><span>{t('groupDescription')}</span><textarea rows={4} value={bio} onChange={(event) => setBio(event.target.value)} /></label><label className="wide"><span>{t('privacy')}</span><select value={privacy} onChange={(event) => setPrivacy(Number(event.target.value))}><option value={0}>{t('publicGroup')}</option><option value={1}>{t('privateGroup')}</option></select></label>{error && <p className="form-error wide">{error}</p>}</div><footer className="modal-foot"><button className="btn-primary block" disabled={busy || !name.trim()}>{busy ? t('creating') : t('createGroup')}</button></footer></form></div>
}

type GroupTab = 'posts' | 'about' | 'members' | 'requests'

export function GroupProfilePage({ groupId, userId, onBack, onNavigate }: { groupId: string; userId: string; onBack: () => void; onNavigate: (path: string) => void }) {
  const { t, locale } = useI18n()
  const [group, setGroup] = useState<SocialGroup | null>(null)
  const [membership, setMembership] = useState<GroupMembershipState>({ isMember: false, isAdmin: false, joinRequestPending: false, canViewPosts: false })
  const [posts, setPosts] = useState<GatewayPost[]>([])
  const [postCursor, setPostCursor] = useState<string | null>(null)
  const [postsHaveMore, setPostsHaveMore] = useState(false)
  const [members, setMembers] = useState<UserSummary[]>([])
  const [admins, setAdmins] = useState<UserSummary[]>([])
  const [requests, setRequests] = useState<SocialProfile[]>([])
  const [tab, setTab] = useState<GroupTab>('posts')
  const [loading, setLoading] = useState(true)
  const [postsLoading, setPostsLoading] = useState(false)
  const [peopleLoading, setPeopleLoading] = useState(false)
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [inviting, setInviting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [groupValue, membershipValue] = await Promise.all([
        socialApi.getGroup(groupId),
        socialApi.getGroupMembershipState(userId, groupId),
      ])
      setGroup(groupValue)
      setMembership(membershipValue)
      if (groupValue) void socialApi.recordGroupVisit(userId, groupId).catch(() => undefined)
    } catch {
      setError(t('groupsLoadError'))
    } finally {
      setLoading(false)
    }
  }, [groupId, t, userId])

  useEffect(() => { void load() }, [load])

  const loadPosts = useCallback(async (cursor: string | null = null, append = false) => {
    if (!membership.canViewPosts) {
      setPosts([])
      setPostCursor(null)
      setPostsHaveMore(false)
      return
    }
    setPostsLoading(true)
    try {
      const page = await socialApi.getGroupPosts(groupId, 20, cursor)
      setPosts((current) => append ? [...current, ...page.items] : page.items)
      setPostCursor(page.endCursor)
      setPostsHaveMore(page.hasNextPage)
    } catch {
      setError(t('groupPostsLoadError'))
    } finally {
      setPostsLoading(false)
    }
  }, [groupId, membership.canViewPosts, t])

  useEffect(() => { void loadPosts() }, [loadPosts])

  const loadPeople = useCallback(async () => {
    setPeopleLoading(true)
    try {
      const [memberPage, adminPage] = await Promise.all([
        socialApi.getGroupMembers(groupId, 50),
        socialApi.getGroupAdmins(groupId, 50),
      ])
      setMembers(memberPage.items)
      setAdmins(adminPage.items)
    } catch {
      setError(t('groupMembersLoadError'))
    } finally {
      setPeopleLoading(false)
    }
  }, [groupId, t])

  useEffect(() => { void loadPeople() }, [loadPeople])

  const loadRequests = useCallback(async () => {
    if (!membership.isAdmin) {
      setRequests([])
      return
    }
    setRequestsLoading(true)
    try { setRequests(await socialApi.getGroupJoinRequests(groupId)) } catch { setError(t('groupRequestsLoadError')) } finally { setRequestsLoading(false) }
  }, [groupId, membership.isAdmin, t])

  useEffect(() => { void loadRequests() }, [loadRequests])

  const tabs = useMemo(() => {
    const values: Array<{ id: GroupTab; label: string }> = [
      { id: 'posts', label: t('postsLabel') },
      { id: 'about', label: t('about') },
      { id: 'members', label: t('members') },
    ]
    if (membership.isAdmin) values.push({ id: 'requests', label: t('joinRequests') })
    return values
  }, [membership.isAdmin, t])
  const excludedInviteIds = useMemo(() => new Set([...members, ...admins].map((person) => person.id)), [admins, members])

  async function membershipAction(action: 'join' | 'cancel' | 'leave') {
    if (!group) return
    setBusy(true)
    setError(null)
    try {
      const success = action === 'join'
        ? await socialApi.requestJoinGroup(userId, groupId)
        : action === 'cancel'
          ? await socialApi.cancelJoinGroupRequest(userId, groupId)
          : await socialApi.leaveGroup(userId, groupId)
      if (!success) throw new Error('Action rejected')
      if (action === 'join' && group.privacy === 0) {
        setMembership({ isMember: true, isAdmin: false, joinRequestPending: false, canViewPosts: true })
        setGroup((current) => current ? { ...current, memberCount: current.memberCount == null ? null : current.memberCount + 1 } : current)
      } else if (action === 'join') {
        setMembership((current) => ({ ...current, joinRequestPending: true }))
      } else if (action === 'cancel') {
        setMembership((current) => ({ ...current, joinRequestPending: false }))
      } else {
        setMembership({ isMember: false, isAdmin: false, joinRequestPending: false, canViewPosts: group.privacy === 0 })
        setGroup((current) => current ? { ...current, memberCount: current.memberCount == null ? null : Math.max(0, current.memberCount - 1) } : current)
      }
      await loadPeople()
    } catch {
      setError(action === 'leave' ? t('leaveGroupError') : t('joinGroupError'))
    } finally {
      setBusy(false)
    }
  }

  async function reviewRequest(profileId: string, approve: boolean) {
    setBusyUserId(profileId)
    setError(null)
    try {
      const success = approve
        ? await socialApi.approveGroupJoinRequest(groupId, profileId)
        : await socialApi.rejectGroupJoinRequest(groupId, profileId)
      if (!success) throw new Error('Action rejected')
      setRequests((current) => current.filter((profile) => profile.id !== profileId))
      if (approve) {
        setGroup((current) => current ? { ...current, memberCount: current.memberCount == null ? null : current.memberCount + 1 } : current)
        await loadPeople()
      }
    } catch {
      setError(t('groupRequestActionError'))
    } finally {
      setBusyUserId(null)
    }
  }

  async function managePerson(person: UserSummary, action: 'promote' | 'remove' | 'demote') {
    setBusyUserId(person.id)
    setError(null)
    try {
      if (action === 'promote') {
        if (!await socialApi.addGroupAdmin(groupId, person.id)) throw new Error('Action rejected')
        setMembers((current) => current.filter((item) => item.id !== person.id))
        setAdmins((current) => [person, ...current.filter((item) => item.id !== person.id)])
      } else if (action === 'remove') {
        if (!await socialApi.removeGroupMember(groupId, person.id)) throw new Error('Action rejected')
        setMembers((current) => current.filter((item) => item.id !== person.id))
      } else {
        if (!await socialApi.removeGroupAdmin(groupId, person.id)) throw new Error('Action rejected')
        if (!await socialApi.addGroupMember(groupId, person.id)) throw new Error('Could not preserve membership')
        setAdmins((current) => current.filter((item) => item.id !== person.id))
        setMembers((current) => [person, ...current.filter((item) => item.id !== person.id)])
      }
      const latest = await socialApi.getGroup(groupId)
      if (latest) setGroup(latest)
    } catch {
      setError(t('groupMemberActionError'))
    } finally {
      setBusyUserId(null)
    }
  }

  if (loading) return <main className="profile-destination"><div className="card state-card"><span className="spinner" /></div></main>
  if (!group) return <main className="profile-destination"><div className="card state-card"><h2>{t('groupUnavailable')}</h2><p>{error}</p><button className="btn-soft" onClick={onBack}>{t('back')}</button></div></main>

  return <main className="profile-destination">
    <section className="profile-cover-card">
      <div className="profile-cover" style={group.backgroundUrl ? { backgroundImage: `url(${group.backgroundUrl})`, backgroundSize: 'cover' } : undefined} />
      <div className="profile-destination-header">
        <Avatar name={group.name} src={group.avatarUrl} size={164} />
        <div className="profile-destination-title"><h1>{group.name}</h1><p>{group.memberCount == null ? t('groupResult') : t('membersCount', { count: group.memberCount })} · {group.privacy === 0 ? t('publicGroup') : t('privateGroup')}</p></div>
        <div className="group-membership-actions">
          {membership.isAdmin && <span className="role-pill">{t('groupAdmin')}</span>}
          {membership.isAdmin && <button type="button" className="btn-soft" onClick={() => setEditing(true)}><Icon name="edit" size={17} />{t('editGroup')}</button>}
          {(membership.isMember || membership.isAdmin) ? <button type="button" className="btn-soft" disabled={busy} onClick={() => void membershipAction('leave')}><Icon name="logout" size={17} />{busy ? t('working') : t('leaveGroup')}</button> : membership.joinRequestPending ? <button type="button" className="btn-soft" disabled={busy} onClick={() => void membershipAction('cancel')}><Icon name="clock" size={17} />{busy ? t('working') : t('cancelJoinRequest')}</button> : <button type="button" className="btn-primary" disabled={busy} onClick={() => void membershipAction('join')}><Icon name="plus" size={17} />{busy ? t('working') : group.privacy === 0 ? t('joinGroup') : t('requestToJoin')}</button>}
          {membership.isAdmin && <button type="button" className="btn-soft danger-text" onClick={() => setConfirmingDelete(true)}><Icon name="trash" size={17} />{t('deleteGroup')}</button>}
        </div>
      </div>
      <nav className="profile-tabs">{tabs.map((item) => <button type="button" key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}{item.id === 'requests' && requests.length > 0 ? ` (${requests.length})` : ''}</button>)}</nav>
    </section>
    {error && <p className="inline-alert profile-inline-alert">{error}</p>}
    <div className="profile-destination-grid">
      <aside className="card profile-intro"><h2>{t('about')}</h2><p>{group.bio || t('noGroupDescription')}</p><p><Icon name="groups" size={18} />{group.memberCount == null ? t('groupResult') : t('membersCount', { count: group.memberCount })}</p><p><Icon name="settings" size={18} />{t('adminsCount', { count: group.adminCount })}</p></aside>
      <section className="profile-post-list">
        {tab === 'posts' && <>
          {(membership.isMember || membership.isAdmin) && <GroupPostComposer userId={userId} groupId={groupId} people={[...new Map([...admins, ...members].map((person) => [person.id, person])).values()]} onCreated={() => void loadPosts()} />}
          {!membership.canViewPosts ? <div className="card state-card"><h2>{t('privateGroup')}</h2><p>{t('joinToSeePosts')}</p></div> : postsLoading && posts.length === 0 ? <div className="card state-card"><span className="spinner" /></div> : posts.length === 0 ? <div className="card state-card"><h2>{t('groupFeedEmpty')}</h2><p>{t('groupFeedEmptyDesc')}</p></div> : <>{posts.map((post) => <GatewayPostCard key={post.id} post={post} locale={locale} viewerId={userId} onNavigate={onNavigate} authorPath={(authorId) => `/groups/${groupId}/members/${authorId}`} />)}{postsHaveMore && <button type="button" className="btn-soft load-more-result" disabled={postsLoading || !postCursor} onClick={() => void loadPosts(postCursor, true)}>{postsLoading ? t('loadingMore') : t('seeMore')}</button>}</>}
        </>}
        {tab === 'about' && <div className="card group-detail-card"><h2>{t('aboutThisGroup')}</h2><p>{group.bio || t('noGroupDescription')}</p><dl><div><dt>{t('privacy')}</dt><dd>{group.privacy === 0 ? t('publicGroup') : t('privateGroup')}</dd></div><div><dt>{t('createdAt')}</dt><dd>{group.createdAt || t('notAvailable')}</dd></div></dl></div>}
        {tab === 'members' && <div className="card group-detail-card"><div className="service-heading"><div><h2>{t('members')}</h2><p>{t('groupMemberSummary', { members: group.memberCount ?? 0, admins: group.adminCount })}</p></div><div className="split-actions">{membership.isAdmin && <button type="button" className="btn-primary sm" onClick={() => setInviting(true)}><Icon name="userPlus" size={16} />{t('invitePeople')}</button>}<button type="button" className="btn-soft sm" onClick={() => void loadPeople()}>{t('refresh')}</button></div></div>{peopleLoading ? <div className="state-card"><span className="spinner" /></div> : <><GroupPeopleList groupId={groupId} title={t('groupAdmins')} people={admins} currentUserId={userId} adminView={membership.isAdmin} busyUserId={busyUserId} onNavigate={onNavigate} onAction={(person) => void managePerson(person, 'demote')} actionLabel={t('removeAdmin')} /><GroupPeopleList groupId={groupId} title={t('groupMembers')} people={members} currentUserId={userId} adminView={membership.isAdmin} busyUserId={busyUserId} onNavigate={onNavigate} onAction={(person, secondary) => void managePerson(person, secondary ? 'remove' : 'promote')} actionLabel={t('makeAdmin')} secondaryActionLabel={t('removeMember')} /></>}</div>}
        {tab === 'requests' && membership.isAdmin && <div className="card group-admin-panel"><div className="service-heading"><div><h2>{t('joinRequests')}</h2><p>{t('joinRequestsDesc')}</p></div><button type="button" className="btn-soft sm" onClick={() => void loadRequests()}>{t('refresh')}</button></div>{requestsLoading ? <div className="state-card"><span className="spinner" /></div> : requests.length === 0 ? <div className="state-card"><h3>{t('noJoinRequests')}</h3><p>{t('noJoinRequestsDesc')}</p></div> : <div className="group-request-list">{requests.map((profile) => <article key={profile.id}><button type="button" className="request-profile" onClick={() => onNavigate(`/profile/${profile.id}`)}><Avatar name={profile.displayName} src={profile.avatarUrl} size={52} /><span><strong>{profile.displayName}<VerifiedBadge verified={profile.isVerified} /></strong><small>{t('friendsCount', { count: profile.friendCount })}</small></span></button><div><button type="button" className="btn-primary sm" disabled={busyUserId === profile.id} onClick={() => void reviewRequest(profile.id, true)}>{t('approve')}</button><button type="button" className="btn-soft sm" disabled={busyUserId === profile.id} onClick={() => void reviewRequest(profile.id, false)}>{t('decline')}</button></div></article>)}</div>}</div>}
      </section>
    </div>
    {editing && <EditGroupModal group={group} onClose={() => setEditing(false)} onUpdated={(updated) => { setGroup(updated); setEditing(false) }} />}
    {confirmingDelete && <DeleteGroupModal group={group} onClose={() => setConfirmingDelete(false)} onDeleted={onBack} />}
    {inviting && <InviteGroupUsersModal groupId={groupId} viewerId={userId} excludedIds={excludedInviteIds} onClose={() => setInviting(false)} />}
  </main>
}

function EditGroupModal({ group, onClose, onUpdated }: { group: SocialGroup; onClose: () => void; onUpdated: (group: SocialGroup) => void }) {
  const { t } = useI18n()
  const [name, setName] = useState(group.name)
  const [bio, setBio] = useState(group.bio ?? '')
  const [privacy, setPrivacy] = useState(group.privacy)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cropTarget, setCropTarget] = useState<{ file: File; kind: 'avatar' | 'background' } | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const updated = await socialApi.updateGroup(group.id, { name: name.trim(), bio: bio.trim(), privacy })
      if (!updated) throw new Error('Missing update result')
      onUpdated(updated)
    } catch {
      setError(t('updateGroupError'))
    } finally {
      setBusy(false)
    }
  }

  async function saveCroppedImage(original: File, cropped: File) {
    if (!cropTarget) return
    setBusy(true)
    setError(null)
    try {
      const croppedUpload = await api.uploadMedia(cropped)
      const originalUpload = cropTarget.kind === 'background' ? await api.uploadMedia(original) : null
      const updated = cropTarget.kind === 'avatar'
        ? await socialApi.changeGroupAvatar(group.id, croppedUpload.url)
        : await socialApi.changeGroupBackground(group.id, croppedUpload.url, originalUpload?.url ?? null)
      if (!updated) throw new Error('Missing group image update')
      onUpdated(updated)
    } catch {
      setError(t('groupImageUpdateError'))
      throw new Error('Group image update failed')
    } finally {
      setBusy(false)
    }
  }

  async function removeImage(kind: 'avatar' | 'background') {
    setBusy(true)
    setError(null)
    try {
      const updated = kind === 'avatar'
        ? await socialApi.removeGroupAvatar(group.id)
        : await socialApi.removeGroupBackground(group.id)
      if (!updated) throw new Error('Missing group image update')
      onUpdated(updated)
    } catch {
      setError(t('groupImageRemoveError'))
    } finally {
      setBusy(false)
    }
  }

  return <><div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}><form className="modal compact-form-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}><header className="modal-head"><h2>{t('editGroup')}</h2><button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button></header><div className="modal-body settings-form-grid"><div className="wide group-image-editor"><div className="group-edit-cover" style={group.backgroundUrl ? { backgroundImage: `url(${group.backgroundUrl})` } : undefined}><div>{group.backgroundUrl && <button type="button" className="btn-soft danger-text" disabled={busy} onClick={() => void removeImage('background')}><Icon name="trash" size={16} />{t('removeGroupBackground')}</button>}<label className="btn-soft"><Icon name="camera" size={16} />{t('changeGroupBackground')}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) setCropTarget({ file, kind: 'background' }); event.currentTarget.value = '' }} /></label></div></div><div className="group-edit-avatar"><Avatar name={group.name} src={group.avatarUrl} size={76} /><div>{group.avatarUrl && <button type="button" className="btn-soft danger-text" disabled={busy} onClick={() => void removeImage('avatar')}>{t('removeGroupAvatar')}</button>}<label className="btn-soft"><Icon name="camera" size={16} />{t('changeGroupAvatar')}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) setCropTarget({ file, kind: 'avatar' }); event.currentTarget.value = '' }} /></label></div></div></div><label className="wide"><span>{t('groupName')}</span><input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="wide"><span>{t('groupDescription')}</span><textarea rows={4} value={bio} onChange={(event) => setBio(event.target.value)} /></label><label className="wide"><span>{t('privacy')}</span><select value={privacy} onChange={(event) => setPrivacy(Number(event.target.value))}><option value={0}>{t('publicGroup')}</option><option value={1}>{t('privateGroup')}</option></select></label>{error && <p className="form-error wide">{error}</p>}</div><footer className="modal-foot"><button type="button" className="btn-soft" onClick={onClose}>{t('cancel')}</button><button type="submit" className="btn-primary" disabled={busy || !name.trim()}>{busy ? t('saving') : t('save')}</button></footer></form></div>{cropTarget && <ImageCropModal file={cropTarget.file} kind={cropTarget.kind} onClose={() => setCropTarget(null)} onConfirm={saveCroppedImage} />}</>
}

function DeleteGroupModal({ group, onClose, onDeleted }: { group: SocialGroup; onClose: () => void; onDeleted: () => void }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function remove() {
    setBusy(true)
    setError(null)
    try {
      if (!await socialApi.deleteGroup(group.id)) throw new Error('Delete rejected')
      onDeleted()
    } catch {
      setError(t('deleteGroupError'))
    } finally {
      setBusy(false)
    }
  }
  return <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}><section className="modal compact-form-modal" role="dialog" aria-modal="true" aria-label={t('deleteGroup')} onClick={(event) => event.stopPropagation()}><header className="modal-head"><h2>{t('deleteGroup')}</h2><button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button></header><div className="modal-body destructive-confirm"><Icon name="trash" size={38} /><p>{t('deleteGroupConfirm', { name: group.name })}</p>{error && <p className="form-error">{error}</p>}</div><footer className="modal-foot"><button type="button" className="btn-soft" onClick={onClose}>{t('cancel')}</button><button type="button" className="btn-danger" disabled={busy} onClick={() => void remove()}>{busy ? t('working') : t('deleteGroup')}</button></footer></section></div>
}

function GroupPostComposer({ userId, groupId, people, onCreated }: { userId: string; groupId: string; people: UserSummary[]; onCreated: () => void }) {
  const { t } = useI18n()
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [taggedPeople, setTaggedPeople] = useState<UserSummary[]>([])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!content.trim() && !file) return
    setBusy(true)
    setError(null)
    try {
      const uploaded = file ? await api.uploadMedia(file) : null
      const created = await socialApi.createGroupPost(userId, groupId, {
        content: content.trim(),
        media: uploaded ? [{ type: uploaded.type === 'video' ? 1 : 0, url: uploaded.url }] : [],
      })
      const activeTags = taggedPeople.filter((person) => content.includes(`@${person.displayName}`))
      await Promise.all(activeTags.map((person) => socialApi.tagUser(created.id, person.id)))
      setContent('')
      setFile(null)
      setFileKey((value) => value + 1)
      setTaggedPeople([])
      onCreated()
    } catch {
      setError(t('publishPostError'))
    } finally {
      setBusy(false)
    }
  }

  return <form className="card gateway-composer group-post-composer" onSubmit={submit}><div className="mention-compose-field"><textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder={t('groupPostPrompt')} rows={3} /><MentionSuggestions text={content} people={people} onTextChange={setContent} onSelected={(person) => setTaggedPeople((current) => current.some((item) => item.id === person.id) ? current : [...current, person])} /></div>{taggedPeople.length > 0 && <div className="tagged-people-row group-tags">{taggedPeople.map((person) => <span key={person.id}><Icon name="tag" size={13} />{person.displayName}</span>)}</div>}<div className="composer-controls"><label className="file-control"><span>{file?.name ?? t('photoVideo')}</span><input key={fileKey} type="file" accept="image/*,video/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><button type="submit" className="btn-primary" disabled={busy || (!content.trim() && !file)}>{busy ? t('posting') : t('post')}</button></div>{error && <p className="form-error">{error}</p>}</form>
}

function GroupPeopleList({ groupId, title, people, currentUserId, adminView, busyUserId, onNavigate, onAction, actionLabel, secondaryActionLabel }: { groupId: string; title: string; people: UserSummary[]; currentUserId: string; adminView: boolean; busyUserId: string | null; onNavigate: (path: string) => void; onAction: (person: UserSummary, secondary?: boolean) => void; actionLabel: string; secondaryActionLabel?: string }) {
  const { t } = useI18n()
  return <section className="group-people-section"><h3>{title}</h3>{people.length === 0 ? <p className="muted">{t('noPeopleToShow')}</p> : <div className="group-request-list">{people.map((person) => <article key={person.id}><button type="button" className="request-profile" onClick={() => onNavigate(`/groups/${groupId}/members/${person.id}`)}><Avatar name={person.displayName} src={person.avatarUrl} size={48} /><span><strong>{person.displayName}<VerifiedBadge verified={person.isVerified} /></strong><small>{person.id === currentUserId ? t('you') : t('fakebookUser')}</small></span></button>{adminView && person.id !== currentUserId && <div><button type="button" className="btn-soft sm" disabled={busyUserId === person.id} onClick={() => onAction(person)}>{actionLabel}</button>{secondaryActionLabel && <button type="button" className="btn-soft sm danger-text" disabled={busyUserId === person.id} onClick={() => onAction(person, true)}>{secondaryActionLabel}</button>}</div>}</article>)}</div>}</section>
}

function InviteGroupUsersModal({ groupId, viewerId, excludedIds, onClose }: { groupId: string; viewerId: string; excludedIds: Set<string>; onClose: () => void }) {
  const { t } = useI18n()
  const [people, setPeople] = useState<SocialProfile[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    socialApi.getRelationProfiles(viewerId, 0, 100).then((items) => {
      if (active) setPeople(items.filter((person) => person.id !== viewerId && !excludedIds.has(person.id)))
    }).catch(() => active && setError(t('friendsLoadError'))).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [excludedIds, t, viewerId])

  const visible = people.filter((person) => person.displayName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))

  async function invite(personId: string) {
    setBusyId(personId)
    setError(null)
    try {
      if (!await socialApi.inviteGroupUser(groupId, personId)) throw new Error('Invite rejected')
      setInvitedIds((current) => new Set(current).add(personId))
    } catch {
      setError(t('groupInviteError'))
    } finally {
      setBusyId(null)
    }
  }

  return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="modal compact-form-modal" role="dialog" aria-modal="true" aria-label={t('invitePeople')} onClick={(event) => event.stopPropagation()}><header className="modal-head"><div><h2>{t('invitePeople')}</h2><p>{t('invitePeopleDesc')}</p></div><button type="button" className="icon-circle subtle" onClick={onClose}><Icon name="close" /></button></header><div className="modal-body invite-group-body"><label className="settings-search"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('searchFriends')} /></label>{loading ? <div className="state-card"><span className="spinner" /></div> : visible.length === 0 ? <p className="muted">{t('noFriendsToInvite')}</p> : <div className="group-request-list">{visible.map((person) => <article key={person.id}><button type="button" className="request-profile"><Avatar name={person.displayName} src={person.avatarUrl} size={46} /><span><strong>{person.displayName}<VerifiedBadge verified={person.isVerified} /></strong><small>{t('friendsCount', { count: person.friendCount })}</small></span></button><button type="button" className={invitedIds.has(person.id) ? 'btn-soft sm' : 'btn-primary sm'} disabled={busyId === person.id || invitedIds.has(person.id)} onClick={() => void invite(person.id)}>{invitedIds.has(person.id) ? t('invited') : busyId === person.id ? t('working') : t('invite')}</button></article>)}</div>}{error && <p className="form-error">{error}</p>}</div><footer className="modal-foot"><button type="button" className="btn-primary" onClick={onClose}>{t('done')}</button></footer></section></div>
}
