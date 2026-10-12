// src/components/CreateGroupForm.tsx
'use client'

import { createGroupAction } from '@/app/actions'
import { useRef, useState } from 'react'
import { Toast } from './Toast'
import type { ToastState } from './Toast'

type CreateGroupFormProps = {
  onGroupCreated?: () => void
}

export default function CreateGroupForm({ onGroupCreated }: CreateGroupFormProps) {
  const [groupName, setGroupName] = useState('')
  const [toast, setToast] = useState<ToastState>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!groupName.trim()) {
      setError('그룹 이름을 입력해주세요.')
      input.current?.focus()
      return
    }
    setBusy(true)
    setError('')
    let result
    try { result = await createGroupAction(groupName.trim()) }
    catch { result = { error: '그룹을 만들지 못했습니다. 다시 시도해주세요.' } }
    finally { setBusy(false) }
    if (result?.error) {
      setError(result.error)
      input.current?.focus()
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
          ref={input}
          aria-label="새 그룹 이름"
          aria-invalid={!!error}
          aria-describedby={error ? 'group-name-error' : undefined}
          maxLength={80}
          disabled={busy}
          name="groupName"
          value={groupName}
          onChange={(e) => { setGroupName(e.target.value); setError('') }}
          placeholder="새 그룹 이름"
          className="flex-grow"
        />
        <button
          type="submit"
          disabled={busy}
          className="primary-button whitespace-nowrap"
        >
          {busy ? '만드는 중…' : '만들기'}
        </button>
      </form>
      {error && <p id="group-name-error" role="alert" className="mt-2 text-sm text-[#a54036]">{error}</p>}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
