// src/components/GroupManager.tsx
'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import CreateGroupForm from './CreateGroupForm'
import InviteMemberForm from './InviteMemberForm';

type Group = {
  id: number
  name: string
}

type GroupManagerProps = {
  user: User
  selectedGroupId: number | null
  setSelectedGroupId: (id: number | null) => void
}

export default function GroupManager({ user, selectedGroupId, setSelectedGroupId }: GroupManagerProps) {
  const supabase = createClient()
  const [groups, setGroups] = useState<Group[]>([])

  useEffect(() => {
    const fetchGroups = async () => {
      const { data } = await supabase
        .from('groups')
        .select('id, name')
        .in('id', 
          (await supabase.from('group_members').select('group_id').eq('user_id', user.id)).data?.map(g => g.group_id) || []
        )
      
      if (data) {
        setGroups(data)
        if (data.length > 0 && !selectedGroupId) {
          setSelectedGroupId(data[0].id)
        }
      }
    }
    
    fetchGroups()
  }, [user, supabase, selectedGroupId, setSelectedGroupId])


  return (
    // p-0로 변경하여 부모 컴포넌트의 패딩을 사용하도록 함
    <div className="space-y-6">
      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">새 그룹 만들기</h4>
        <CreateGroupForm />
      </div>
      
      {groups.length > 0 && (
        <div>
          <h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">그룹 선택</h4>
          <select 
            value={selectedGroupId || ''}
            onChange={(e) => setSelectedGroupId(Number(e.target.value))}
            className="w-full p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
          >
            {groups.map(group => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">멤버 초대하기</h4>
        <InviteMemberForm groupId={selectedGroupId} />
      </div>
    </div>
  )
}