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
      window.location.reload()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <input
        type="text"
        name="groupName"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        placeholder="새 그룹 이름"
        className="p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
      />
      <button 
        type="submit"
        className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700"
      >
        만들기
      </button>
    </form>
  )
}