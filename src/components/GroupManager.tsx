// src/components/GroupManager.tsx
'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import type { Group } from '@/types'
import CreateGroupForm from './CreateGroupForm'
import InviteMemberForm from './InviteMemberForm'

type GroupManagerProps = {
  user: User
  selectedGroupId: number | null
  setSelectedGroupId: (id: number | null) => void
}

export default function GroupManager({ user, selectedGroupId, setSelectedGroupId }: GroupManagerProps) {
  const supabase = createClient()
  const [groups, setGroups] = useState<Group[]>([])

  const fetchGroups = async () => {
    const { data } = await supabase
      .from('group_members')
      .select('groups(id, name)')
      .eq('user_id', user.id)

    const fetched = ((data ?? [])
      .map(row => (row as unknown as { groups: Group | null }).groups)
      .filter(Boolean) as Group[])
    setGroups(fetched)
    if (fetched.length > 0 && !selectedGroupId) {
      setSelectedGroupId(fetched[0].id)
    }
  }

  useEffect(() => {
    fetchGroups()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  const handleGroupCreated = () => {
    fetchGroups()
  }

  return (
    <div className="space-y-5">
      <div className="soft-card p-5">
        <h4 className="mb-2 text-lg font-extrabold">새 그룹 만들기</h4>
        <p className="muted mb-4 text-sm">함께 일정을 맞출 사람들을 한 공간에 모아보세요.</p>
        <CreateGroupForm onGroupCreated={handleGroupCreated} />
      </div>

      {groups.length > 0 && (
        <div className="soft-card p-5">
          <h4 className="mb-2 text-lg font-extrabold">내 그룹</h4>
          <select
            value={selectedGroupId || ''}
            onChange={(e) => setSelectedGroupId(Number(e.target.value))}
            className="w-full"
          >
            {groups.map(group => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="soft-card p-5">
        <h4 className="mb-2 text-lg font-extrabold">멤버 초대하기</h4>
        <p className="muted mb-4 text-sm leading-6">그룹 생성자만 기존 사용자를 추가할 수 있습니다. 일정 제목과 근무 종류는 공유되지 않습니다.</p>
        <InviteMemberForm groupId={selectedGroupId} />
      </div>
    </div>
  )
}
