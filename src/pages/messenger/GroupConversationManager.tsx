import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { messengerApi } from '../../api/messenger'
import type { MessengerConversationDto, MessengerParticipantDto, UserSummary } from '../../api/types'
import { AnchoredMenuPortal } from '../../components/AnchoredMenuPortal'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { useFriendSearch } from '../../lib/useFriendSearch'
import { useInlineImageCrop } from '../../lib/useInlineImageCrop'
import './GroupConversationManager.css'

type GroupManagerView = 'menu' | 'edit' | 'members' | 'add' | 'leave' | 'delete'

interface GroupConversationManagerProps {
  me: UserSummary
  friends: UserSummary[]
  conversation: MessengerConversationDto
  onClose: () => void
  onUpdated: (conversation: MessengerConversationDto) => void
  onRemoved: (conversationId: string) => void
  onOpenProfile: (profileId: string) => void
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('vi')
}

function AdminCrown() {
  return (
    <svg className="group-manager-crown" viewBox="0 0 24 18" aria-label="Quản trị viên" role="img">
      <path d="m2 4 5 4 5-7 5 7 5-4-2 12H4L2 4Z" />
      <path d="M4 16h16" />
    </svg>
  )
}

function MemberAvatar({ member, size = 44 }: { member: MessengerParticipantDto; size?: number }) {
  return (
    <span className="group-manager-member-avatar">
      <Avatar name={member.displayName} src={member.avatarUrl} size={size} />
      {member.role === 'ADMIN' && <AdminCrown />}
    </span>
  )
}

export function GroupConversationManager({
  me,
  friends,
  conversation,
  onClose,
  onUpdated,
  onRemoved,
  onOpenProfile,
}: GroupConversationManagerProps) {
  const [view, setView] = useState<GroupManagerView>('menu')
  const [title, setTitle] = useState(conversation.title ?? '')
  const [memberQuery, setMemberQuery] = useState('')
  const [friendQuery, setFriendQuery] = useState('')
  const [selectedFriends, setSelectedFriends] = useState<UserSummary[]>([])
  const [memberMenuId, setMemberMenuId] = useState<string | null>(null)
  const [memberMenuAnchor, setMemberMenuAnchor] = useState<HTMLElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const crop = useInlineImageCrop(conversation.id)
  const meParticipant = conversation.participants.find((member) => member.id === me.id)
  const isAdmin = meParticipant?.role === 'ADMIN'
  const existingIds = useMemo(
    () => new Set(conversation.participants.map((member) => member.id)),
    [conversation.participants],
  )
  const selectedFriendIds = useMemo(() => new Set(selectedFriends.map((friend) => friend.id)), [selectedFriends])
  const { people: friendResults, loading: searchingFriends, failed: friendSearchFailed } = useFriendSearch(
    friends,
    friendQuery,
    view === 'add',
  )

  const visibleMembers = useMemo(() => {
    const query = normalize(memberQuery)
    if (!query) return conversation.participants
    return conversation.participants.filter((member) => normalize(`${member.displayName} ${member.username}`).includes(query))
  }, [conversation.participants, memberQuery])
  const addableFriends = useMemo(
    () => friendResults.filter((person) => !existingIds.has(person.id)),
    [existingIds, friendResults],
  )

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || busy) return
      if (memberMenuId) {
        setMemberMenuId(null)
        setMemberMenuAnchor(null)
        return
      }
      if (view === 'menu') onClose()
      else {
        setView('menu')
        setError(null)
        setMemberMenuId(null)
        setMemberMenuAnchor(null)
        crop.cancel()
      }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [busy, crop, memberMenuId, onClose, view])

  useEffect(() => {
    setTitle(conversation.title ?? '')
  }, [conversation.title])

  function openView(next: GroupManagerView) {
    setError(null)
    setMemberMenuId(null)
    setMemberMenuAnchor(null)
    setView(next)
  }

  function backToMenu() {
    if (busy) return
    crop.cancel()
    setSelectedFriends([])
    setFriendQuery('')
    setMemberQuery('')
    openView('menu')
  }

  async function saveGroup() {
    const nextTitle = title.trim()
    if (!nextTitle) {
      setError('Tên nhóm không được để trống.')
      return
    }
    setBusy(true)
    crop.setBusy(true)
    setError(null)
    let uploaded: Awaited<ReturnType<typeof api.uploadMediaFiles>>[number] | null = null
    try {
      const patch: { title?: string; avatarUrl?: string } = {}
      if (nextTitle !== conversation.title) patch.title = nextTitle
      if (crop.target) {
        const croppedFile = await crop.createCroppedFile(1024, 1)
        ;[uploaded] = await api.uploadMediaFiles([croppedFile])
        patch.avatarUrl = uploaded.url
      }
      if (Object.keys(patch).length === 0) {
        backToMenu()
        return
      }
      const updated = await messengerApi.updateGroupConversation(conversation.id, me.id, patch)
      onUpdated(updated)
      crop.clear()
      openView('menu')
    } catch {
      if (uploaded) void api.cancelPendingMedia(uploaded).catch(() => undefined)
      setError('Không thể cập nhật nhóm. Hãy thử lại.')
    } finally {
      crop.setBusy(false)
      setBusy(false)
    }
  }

  async function addMembers() {
    const ids = [...selectedFriendIds]
    if (ids.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const updated = await messengerApi.addConversationMembers(conversation.id, ids, me.id)
      onUpdated(updated)
      setSelectedFriends([])
      setFriendQuery('')
      openView('members')
    } catch {
      setError('Không thể thêm thành viên. Chỉ bạn bè hợp lệ và không bị chặn mới có thể được thêm.')
    } finally {
      setBusy(false)
    }
  }

  async function changeRole(member: MessengerParticipantDto, role: 'ADMIN' | 'MEMBER') {
    setBusy(true)
    setError(null)
    setMemberMenuId(null)
    setMemberMenuAnchor(null)
    try {
      const updated = await messengerApi.setConversationMemberRole(conversation.id, member.id, role, me.id)
      onUpdated(updated)
    } catch {
      setError(role === 'ADMIN'
        ? 'Không thể đặt thành viên này làm quản trị viên.'
        : 'Nhóm luôn phải còn ít nhất một quản trị viên.')
    } finally {
      setBusy(false)
    }
  }

  async function removeMember(member: MessengerParticipantDto) {
    setBusy(true)
    setError(null)
    setMemberMenuId(null)
    setMemberMenuAnchor(null)
    try {
      const updated = await messengerApi.removeConversationMember(conversation.id, member.id, me.id)
      onUpdated(updated)
    } catch {
      setError('Không thể xoá thành viên này. Nhóm luôn phải còn ít nhất một quản trị viên.')
    } finally {
      setBusy(false)
    }
  }

  async function leaveGroup() {
    setBusy(true)
    setError(null)
    try {
      await messengerApi.leaveConversation(conversation.id, me.id)
      onRemoved(conversation.id)
    } catch {
      setError('Không thể rời nhóm. Nếu bạn là quản trị viên cuối cùng, hãy cấp quyền cho người khác trước.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteGroup() {
    setBusy(true)
    setError(null)
    try {
      await messengerApi.deleteGroupConversation(conversation.id)
      onRemoved(conversation.id)
    } catch {
      setError('Không thể xoá nhóm. Chỉ quản trị viên hiện tại mới có quyền này.')
    } finally {
      setBusy(false)
    }
  }

  function renderHeader(label: string, canGoBack = true) {
    return (
      <header className="group-manager-head">
        {canGoBack ? <button type="button" className="group-manager-back" aria-label="Quay lại" onClick={backToMenu}><span>‹</span></button> : <span />}
        <h2>{label}</h2>
        <button type="button" className="group-manager-close" aria-label="Đóng" onClick={onClose} disabled={busy}><Icon name="close" size={20} /></button>
      </header>
    )
  }

  return (
    <div className="group-manager-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose()
    }}>
      <section className="group-manager-dialog" role="dialog" aria-modal="true" aria-label="Quản lý nhóm">
        {view === 'menu' && <>
          {renderHeader('Tuỳ chọn nhóm', false)}
          <div className="group-manager-summary">
            <span className="group-manager-main-avatar">
              <Avatar name={conversation.title ?? 'Nhóm'} src={conversation.avatarUrl} size={76} />
            </span>
            <strong>{conversation.title}</strong>
            <small>{conversation.participants.length} thành viên</small>
          </div>
          <div className="group-manager-menu">
            {isAdmin && <button type="button" onClick={() => openView('edit')}><Icon name="edit" size={20} /><span>Chỉnh sửa nhóm</span></button>}
            {isAdmin && <button type="button" onClick={() => openView('add')}><Icon name="userPlus" size={20} /><span>Thêm thành viên</span></button>}
            <button type="button" onClick={() => openView('members')}><Icon name="friends" size={20} /><span>{isAdmin ? 'Quản lý thành viên' : 'Xem thành viên'}</span></button>
            <button type="button" className="danger" onClick={() => openView('leave')}><Icon name="logout" size={20} /><span>Rời nhóm</span></button>
            {isAdmin && <button type="button" className="danger" onClick={() => openView('delete')}><Icon name="trash" size={20} /><span>Xoá nhóm</span></button>}
          </div>
        </>}

        {view === 'edit' && <>
          {renderHeader('Chỉnh sửa nhóm')}
          <div className="group-manager-edit">
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (file) crop.start(file, false)
              event.currentTarget.value = ''
            }} />
            <button type="button" className="group-manager-avatar-picker" onClick={() => fileInputRef.current?.click()} disabled={busy} aria-label="Chọn ảnh nhóm">
              {crop.target ? (
                <div
                  className="group-manager-crop"
                  ref={crop.previewRef}
                  tabIndex={0}
                  onPointerDown={crop.beginDrag}
                  onPointerMove={crop.moveDrag}
                  onPointerUp={crop.endDrag}
                  onPointerCancel={crop.endDrag}
                  onKeyDown={crop.moveWithKeyboard}
                >
                  <img src={crop.target.previewUrl} style={crop.imageStyle} alt="" draggable={false} onLoad={(event) => crop.onImageLoad(event.currentTarget)} />
                </div>
              ) : <Avatar name={conversation.title ?? 'Nhóm'} src={conversation.avatarUrl} size={150} />}
              <span className="group-manager-camera"><Icon name="camera" size={19} /></span>
            </button>
            {crop.target && <div className="group-manager-zoom" aria-label="Thu phóng ảnh nhóm">
              <button type="button" onClick={() => crop.changeZoom(-0.12)} disabled={busy || crop.zoom <= 1} aria-label="Thu nhỏ">−</button>
              <span><i style={{ height: `${Math.max(0, Math.min(1, (crop.zoom - 1) / 2)) * 100}%` }} /></span>
              <button type="button" onClick={() => crop.changeZoom(0.12)} disabled={busy || crop.zoom >= 3} aria-label="Phóng to">+</button>
            </div>}
            <p>Nhấn vào ảnh để chọn ảnh mới. Kéo ảnh để chọn vị trí mong muốn.</p>
            <label className="group-manager-title-field">
              <span>Tên nhóm</span>
              <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} disabled={busy} />
            </label>
          </div>
          {error && <p className="group-manager-error" role="alert">{error}</p>}
          <footer className="group-manager-footer"><button type="button" onClick={backToMenu} disabled={busy}>Huỷ</button><button type="button" className="primary" onClick={() => void saveGroup()} disabled={busy}>{busy ? 'Đang lưu…' : 'Xác nhận'}</button></footer>
        </>}

        {view === 'members' && <>
          {renderHeader('Thành viên nhóm')}
          <label className="group-manager-search"><Icon name="search" size={19} /><input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="Tìm thành viên" /></label>
          {error && <p className="group-manager-error" role="alert">{error}</p>}
          <div className="group-manager-member-list">
            {visibleMembers.map((member) => <div className="group-manager-member" key={member.id}>
              <MemberAvatar member={member} />
              <span className="group-manager-member-name"><strong>{member.displayName}</strong><small>{member.role === 'ADMIN' ? 'Quản trị viên' : `@${member.username}`}</small></span>
              <div className="group-manager-member-menu-wrap">
                <button type="button" className="group-manager-more" aria-label={`Tuỳ chọn của ${member.displayName}`} onClick={(event) => { const nextOpen = memberMenuId !== member.id; setMemberMenuId(nextOpen ? member.id : null); setMemberMenuAnchor(nextOpen ? event.currentTarget : null) }}><Icon name="more" size={18} /></button>
                {memberMenuId === member.id && <AnchoredMenuPortal anchor={memberMenuAnchor} className="group-manager-member-menu group-manager-member-menu-popover" onRequestClose={() => { setMemberMenuId(null); setMemberMenuAnchor(null) }}>
                  <button type="button" role="menuitem" onClick={() => { setMemberMenuId(null); setMemberMenuAnchor(null); onOpenProfile(member.id) }}><Icon name="user" size={17} />Xem trang cá nhân</button>
                  {isAdmin && member.id !== me.id && member.role !== 'ADMIN' && <button type="button" role="menuitem" onClick={() => void changeRole(member, 'ADMIN')}><AdminCrown />Đặt làm quản trị viên</button>}
                  {isAdmin && member.id !== me.id && member.role === 'ADMIN' && <button type="button" role="menuitem" onClick={() => void changeRole(member, 'MEMBER')}><Icon name="userMinus" size={17} />Gỡ quyền quản trị viên</button>}
                  {isAdmin && member.id !== me.id && <button type="button" role="menuitem" className="danger" onClick={() => void removeMember(member)}><Icon name="userMinus" size={17} />Xoá khỏi nhóm</button>}
                </AnchoredMenuPortal>}
              </div>
            </div>)}
            {visibleMembers.length === 0 && <p className="group-manager-empty">Không tìm thấy thành viên.</p>}
          </div>
        </>}

        {view === 'add' && <>
          {renderHeader('Thêm thành viên')}
          {selectedFriendIds.size > 0 && <div className="group-manager-selected">
            {selectedFriends.map((friend) => <button type="button" key={friend.id} onClick={() => setSelectedFriends((current) => current.filter((item) => item.id !== friend.id))}><Avatar name={friend.displayName} src={friend.avatarUrl} size={30} /><span>{friend.displayName}</span><Icon name="close" size={13} /></button>)}
          </div>}
          <label className="group-manager-search"><Icon name="search" size={19} /><input value={friendQuery} onChange={(event) => setFriendQuery(event.target.value)} placeholder="Tìm kiếm bạn bè" /></label>
          {error && <p className="group-manager-error" role="alert">{error}</p>}
          <div className="group-manager-member-list add-list">
            {addableFriends.map((person) => {
              const selected = selectedFriendIds.has(person.id)
              return <button type="button" className={`group-manager-friend${selected ? ' selected' : ''}`} key={person.id} onClick={() => setSelectedFriends((current) => current.some((item) => item.id === person.id) ? current.filter((item) => item.id !== person.id) : [...current, person])}><Avatar name={person.displayName} src={person.avatarUrl} size={44} /><span><strong>{person.displayName}</strong><small>@{person.username}</small></span><i>{selected && <Icon name="check" size={16} />}</i></button>
            })}
            {searchingFriends && <p className="group-manager-empty">Đang tìm bạn bè…</p>}
            {!searchingFriends && addableFriends.length === 0 && <p className="group-manager-empty">{friendSearchFailed ? 'Không thể tìm bạn bè lúc này.' : 'Không còn bạn bè phù hợp để thêm.'}</p>}
          </div>
          <footer className="group-manager-footer"><button type="button" onClick={backToMenu} disabled={busy}>Huỷ</button><button type="button" className="primary" onClick={() => void addMembers()} disabled={busy || selectedFriendIds.size === 0}>{busy ? 'Đang thêm…' : `Thêm${selectedFriendIds.size ? ` (${selectedFriendIds.size})` : ''}`}</button></footer>
        </>}

        {(view === 'leave' || view === 'delete') && <>
          {renderHeader(view === 'leave' ? 'Rời nhóm' : 'Xoá nhóm')}
          <div className="group-manager-confirm">
            <span className="group-manager-confirm-icon"><Icon name={view === 'leave' ? 'logout' : 'trash'} size={28} /></span>
            <h3>{view === 'leave' ? 'Bạn muốn rời nhóm này?' : 'Xoá vĩnh viễn nhóm này?'}</h3>
            <p>{view === 'leave'
              ? 'Bạn sẽ không thể xem hoặc gửi tin nhắn mới trong nhóm sau khi rời đi.'
              : 'Toàn bộ cuộc trò chuyện sẽ bị xoá đối với mọi thành viên. Thao tác này không thể hoàn tác.'}</p>
          </div>
          {error && <p className="group-manager-error" role="alert">{error}</p>}
          <footer className="group-manager-footer"><button type="button" onClick={backToMenu} disabled={busy}>Huỷ</button><button type="button" className="danger-button" onClick={() => void (view === 'leave' ? leaveGroup() : deleteGroup())} disabled={busy}>{busy ? 'Đang xử lý…' : view === 'leave' ? 'Rời nhóm' : 'Xoá nhóm'}</button></footer>
        </>}
      </section>
    </div>
  )
}
