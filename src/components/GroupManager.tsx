'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import CreateGroupForm from './CreateGroupForm'
import InviteMemberForm from './InviteMemberForm';

// 그룹의 타입을 정의합니다.
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
        // 그룹이 있는데 선택된 그룹이 없으면, 첫 번째 그룹을 기본으로 선택
        if (data.length > 0 && !selectedGroupId) {
          setSelectedGroupId(data[0].id)
        }
      }
    }
    
    fetchGroups()
  }, [user, supabase, selectedGroupId, setSelectedGroupId])


  return (
    <div className="mb-8 p-6 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-800/50">
      <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">👥 그룹 관리</h3>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <CreateGroupForm />
        
        {groups.length > 0 && (
          <select 
            value={selectedGroupId || ''}
            onChange={(e) => setSelectedGroupId(Number(e.target.value))}
            className="p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
          >
            {groups.map(group => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-6">
        <h4 className="font-semibold dark:text-slate-100">멤버 초대하기:</h4>
        <InviteMemberForm groupId={selectedGroupId} />
      </div>
    </div>
  )
}