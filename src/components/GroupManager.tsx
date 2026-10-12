// src/components/GroupManager.tsx
'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import type { Group } from '@/types'
import CreateGroupForm from './CreateGroupForm'
import InviteMemberForm from './InviteMemberForm'
import { listGroupMembersAction } from '@/app/actions'

type GroupManagerProps = {
  user: User
  selectedGroupId: number | null
  setSelectedGroupId: (id: number | null) => void
  onGroupsChange?: (groups: Group[]) => void
}

export default function GroupManager({ user, selectedGroupId, setSelectedGroupId, onGroupsChange }: GroupManagerProps) {
  const supabase = createClient()
  const [groups, setGroups] = useState<Group[]>([])
  const [members, setMembers] = useState<Awaited<ReturnType<typeof listGroupMembersAction>>>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState('')
  const [memberRevision, setMemberRevision] = useState(0)
  useEffect(() => {
    let alive = true
    setMembers([]); setMembersError(''); setMembersLoading(!!selectedGroupId)
    if (selectedGroupId) void listGroupMembersAction(selectedGroupId).then((data) => { if (alive) setMembers(data) }).catch((error) => { if (alive) setMembersError((error as Error).message) }).finally(() => { if (alive) setMembersLoading(false) })
    return () => { alive = false }
  }, [selectedGroupId, memberRevision])

  const fetchGroups = async () => {
    const { data } = await supabase
      .from('group_members')
      .select('groups(id, name)')
      .eq('user_id', user.id)

    const fetched = ((data ?? [])
      .map(row => (row as unknown as { groups: Group | null }).groups)
      .filter(Boolean) as Group[])
    setGroups(fetched)
    onGroupsChange?.(fetched)
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
            aria-label="관리할 그룹"
            className="hidden w-full lg:block"
          >
            {groups.map(group => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <p className="font-bold lg:hidden">{groups.find(group => group.id === selectedGroupId)?.name}</p>
          <p className="muted mt-2 text-xs">이 그룹에 구성원을 추가합니다.</p>
        </div>
      )}
      {selectedGroupId && <div className="soft-card p-5"><h4 className="mb-3 text-lg font-extrabold">현재 구성원</h4>
        {membersLoading ? <p role="status" className="muted text-sm">구성원을 불러오는 중…</p> : membersError ? <p role="alert" className="text-sm text-[#a54036]">{membersError}</p> : <ul className="space-y-2">{members.map(member => <li key={member.id} className="flex items-center justify-between gap-3 text-sm"><span>{member.name}{member.id === user.id && ' (나)'}</span><span className="muted text-xs">{member.role}</span></li>)}</ul>}
      </div>}

      <div className="soft-card p-5">
        <h4 className="mb-2 text-lg font-extrabold">멤버 초대하기</h4>
        <p className="muted mb-4 text-sm leading-6">그룹 생성자만 기존 사용자를 추가할 수 있습니다. 일정 제목과 근무 종류는 공유되지 않습니다.</p>
        <InviteMemberForm groupId={selectedGroupId} onInvited={() => setMemberRevision(value => value + 1)} />
      </div>
    </div>
  )
}
