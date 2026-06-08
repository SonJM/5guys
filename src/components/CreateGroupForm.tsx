// src/components/CreateGroupForm.tsx
'use client'

import { createGroupAction } from '@/app/actions'
import { useState } from 'react'
import { Toast } from './Toast'
import type { ToastState } from './Toast'

type CreateGroupFormProps = {
  onGroupCreated?: () => void
}

export default function CreateGroupForm({ onGroupCreated }: CreateGroupFormProps) {
  const [groupName, setGroupName] = useState('')
  const [toast, setToast] = useState<ToastState>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const result = await createGroupAction(groupName)
    if (result?.error) {
      setToast({ message: result.error, type: 'error' })
    } else {
      setGroupName('')
      setToast({ message: '그룹이 생성되었습니다.', type: 'success' })
      onGroupCreated?.()
    }
  }

  return (
    <>
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
