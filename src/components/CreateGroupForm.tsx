// src/components/CreateGroupForm.tsx
'use client'

import { createGroupAction } from '@/app/actions'
import { useState } from 'react'

export default function CreateGroupForm() {
  const [groupName, setGroupName] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const result = await createGroupAction(groupName)
    if (result?.error) {
      alert(result.error)
    } else {
      setGroupName('')
      // 페이지를 새로고침하는 대신 부모 컴포넌트에서 상태를 갱신하도록 하는 것이 더 좋지만,
      // 현재 구조에서는 새로고침이 가장 간단한 방법입니다.
      window.location.reload() 
    }
  }

  return (
    // flex-col sm:flex-row 로 반응형 레이아웃 적용
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch gap-2">
      <input
        type="text"
        name="groupName"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        placeholder="새 그룹 이름"
        className="p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 flex-grow"
      />
      <button 
        type="submit"
        className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 whitespace-nowrap"
      >
        만들기
      </button>
    </form>
  )
}