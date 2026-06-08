// src/components/InviteMemberForm.tsx
'use client'

import { inviteUserAction } from '@/app/actions'
import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { Toast } from './Toast'
import type { ToastState } from './Toast'
import type { Profile } from '@/types'

export default function InviteMemberForm({ groupId }: { groupId: number | null }) {
  const [invitableUsers, setInvitableUsers] = useState<Profile[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)

  useEffect(() => {
    const fetchInvitableUsers = async () => {
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

      const { data } = await supabase
        .from('profiles')
        .select('id, username, email')
        .not('id', 'in', `(${currentMemberIds.join(',')})`)

      if (data) setInvitableUsers(data)
    }

    fetchInvitableUsers()
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
    const result = await inviteUserAction(groupId, selectedUserId)
    if (result.error) {
      setToast({ message: result.error, type: 'error' })
    } else {
      setToast({ message: '성공적으로 초대했습니다!', type: 'success' })
      setSelectedUserId('')
    }
    setIsLoading(false)
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch gap-2">
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="p-2 border rounded-md shadow-sm flex-grow bg-white dark:bg-slate-700 dark:border-slate-600"
          disabled={!groupId}
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
          disabled={!groupId || isLoading}
          className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 disabled:bg-slate-400 whitespace-nowrap"
        >
          초대
        </button>
      </form>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
