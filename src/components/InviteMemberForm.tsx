// src/components/InviteMemberForm.tsx
'use client'

import { inviteUserAction } from '@/app/actions'
import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { Toast } from './Toast'
import type { ToastState } from './Toast'
import type { Profile } from '@/types'

export default function InviteMemberForm({ groupId, onInvited }: { groupId: number | null; onInvited?: () => void }) {
  const [invitableUsers, setInvitableUsers] = useState<Profile[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [toast, setToast] = useState<ToastState>(null)

  useEffect(() => {
    let alive = true
    setLoadingUsers(true)
    setInvitableUsers([])
    setSelectedUserId('')
    setLoadError('')
    const fetchInvitableUsers = async () => {
      if (!groupId) return
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const currentMemberIds: string[] = [user.id]

      if (groupId) {
        const { data: members } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', groupId)
        members?.forEach(m => currentMemberIds.push(m.user_id))
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, email')
        .not('id', 'in', `(${currentMemberIds.join(',')})`)

      if (error) throw new Error('초대 가능한 사용자를 불러오지 못했습니다.')
      if (alive && data) setInvitableUsers(data)
    }

    void fetchInvitableUsers().catch((error) => { if (alive) setLoadError((error as Error).message) }).finally(() => { if (alive) setLoadingUsers(false) })
    return () => { alive = false }
  }, [groupId])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!groupId) {
      setToast({ message: '그룹을 먼저 선택해주세요.', type: 'error' })
      return
    }
    if (!selectedUserId) {
      setToast({ message: '초대할 사용자를 선택해주세요.', type: 'error' })
      return
    }
    setIsLoading(true)
    try {
    const result = await inviteUserAction(groupId, selectedUserId)
    if (result.error) {
      setToast({ message: result.error, type: 'error' })
    } else {
      setToast({ message: '성공적으로 초대했습니다!', type: 'success' })
      setInvitableUsers(prev => prev.filter(user => user.id !== selectedUserId))
      setSelectedUserId('')
      window.dispatchEvent(new Event('planner-synced'))
      onInvited?.()
    }
    } catch {
      setToast({ message: '초대 요청에 실패했습니다. 다시 시도해주세요.', type: 'error' })
    } finally { setIsLoading(false) }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch gap-2">
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="flex-grow"
          aria-label="초대할 기존 사용자"
          disabled={!groupId || loadingUsers || !invitableUsers.length}
        >
          <option value="">초대할 멤버 선택...</option>
          {invitableUsers.map(u => (
            <option key={u.id} value={u.id}>
              {u.username || u.email}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!groupId || isLoading || loadingUsers || !selectedUserId}
          className="primary-button whitespace-nowrap"
        >
          초대
        </button>
      </form>
      {loadingUsers ? <p role="status" className="muted mt-2 text-xs">초대 가능한 사용자를 확인하는 중…</p>
        : loadError ? <p role="alert" className="mt-2 text-xs text-[#a54036]">{loadError}</p>
        : !groupId ? <p className="muted mt-2 text-xs">그룹을 먼저 만들어주세요.</p>
        : !invitableUsers.length && <p className="muted mt-2 text-xs">현재 추가할 수 있는 기존 사용자가 없습니다. 친구가 서비스에 가입한 뒤 다시 확인해주세요.</p>}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
