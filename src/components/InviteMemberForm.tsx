'use client'

import { inviteUserAction, searchInvitableUsersAction } from '@/app/actions'
import { useEffect, useRef, useState } from 'react'
import { Toast } from './Toast'
import type { ToastState } from './Toast'

type SearchResult = Awaited<ReturnType<typeof searchInvitableUsersAction>>

export default function InviteMemberForm({ groupId, onInvited }: { groupId: number | null; onInvited?: () => void }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState({ term: '', offset: 0 })
  const [result, setResult] = useState<SearchResult>({ users: [], hasMore: false })
  const [selectedUserId, setSelectedUserId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [toast, setToast] = useState<ToastState>(null)
  const requestId = useRef(0)

  useEffect(() => {
    setQuery('')
    setPage({ term: '', offset: 0 })
    setToast(null)
  }, [groupId])

  useEffect(() => {
    const id = ++requestId.current
    setResult({ users: [], hasMore: false })
    setSelectedUserId('')
    setLoadError('')
    setLoadingUsers(false)
    if (!groupId || page.term.length < 2) return
    setLoadingUsers(true)
    void searchInvitableUsersAction(groupId, page.term, page.offset)
      .then(data => { if (id === requestId.current) setResult(data) })
      .catch(error => { if (id === requestId.current) setLoadError((error as Error).message) })
      .finally(() => { if (id === requestId.current) setLoadingUsers(false) })
    return () => { requestId.current = id + 1 }
  }, [groupId, page])

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setPage({ term: query.trim(), offset: 0 })
  }

  const handleInvite = async () => {
    if (!groupId || !selectedUserId) return
    const id = requestId.current
    setIsLoading(true)
    try {
      const response = await inviteUserAction(groupId, selectedUserId)
      if (id !== requestId.current) return
      if (response.error) setToast({ message: response.error, type: 'error' })
      else {
        setToast({ message: '성공적으로 초대했습니다!', type: 'success' })
        setSelectedUserId('')
        // Removing a result changes subsequent page offsets.
        setPage(current => ({ ...current, offset: 0 }))
        window.dispatchEvent(new Event('planner-synced'))
        onInvited?.()
      }
    } catch {
      if (id === requestId.current) setToast({ message: '초대 요청에 실패했습니다. 다시 시도해주세요.', type: 'error' })
    } finally { setIsLoading(false) }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSearch} className="flex items-stretch gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="invite-user-search" className="mb-2 block text-sm font-bold">이름 또는 이메일로 검색</label>
          <input id="invite-user-search" type="search" value={query} onChange={event => setQuery(event.target.value)}
            placeholder="이름 또는 이메일을 2자 이상 입력" minLength={2} maxLength={100}
            disabled={!groupId || isLoading} className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-base text-[var(--foreground)]" aria-describedby="invite-search-help" />
        </div>
        <button type="submit" disabled={!groupId || isLoading || query.trim().length < 2}
          className="secondary-button self-end whitespace-nowrap">검색</button>
      </form>
      <p id="invite-search-help" className="muted text-xs">가입한 사용자를 검색합니다. 나와 현재 그룹 구성원은 제외됩니다.</p>
      {!groupId ? <p className="muted text-sm">그룹을 먼저 만들어주세요.</p>
        : loadingUsers ? <p role="status" className="muted text-sm">사용자를 검색하는 중…</p>
        : loadError ? <p role="alert" className="text-sm text-[#a54036]">{loadError}</p>
        : !page.term ? <p className="muted text-sm">초대할 사람을 검색한 뒤 선택해주세요.</p>
        : !result.users.length ? <p role="status" className="muted text-sm">검색 결과가 없습니다. 다른 이름이나 이메일로 검색해주세요.</p>
        : <>
          <fieldset disabled={isLoading} className="min-w-0">
            <legend className="mb-2 text-sm font-bold">초대할 사용자 선택</legend>
            <ul className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-[var(--line)] p-2">
              {result.users.map(user => <li key={user.id}>
                <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg p-3 ${selectedUserId === user.id ? 'bg-[var(--brand-light)]' : 'bg-[var(--surface)]'}`}>
                  <input type="radio" name="invite-user" value={user.id} checked={selectedUserId === user.id}
                    onChange={() => setSelectedUserId(user.id)} className="size-4 shrink-0 accent-[var(--brand)]" />
                  <span className="min-w-0 text-sm"><span className="block break-all font-bold">{user.username || user.email || '이름 미설정'}</span>
                    {user.username && user.email && <span className="muted block break-all text-xs">{user.email}</span>}</span>
                </label>
              </li>)}
            </ul>
          </fieldset>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p role="status" className="muted text-xs">{page.offset + 1}–{page.offset + result.users.length}번째 검색 결과</p>
            <div className="flex gap-2">
              <button type="button" className="secondary-button" disabled={isLoading || page.offset === 0}
                onClick={() => setPage(current => ({ ...current, offset: current.offset - 20 }))}>이전</button>
              <button type="button" className="secondary-button" disabled={isLoading || !result.hasMore}
                onClick={() => setPage(current => ({ ...current, offset: current.offset + 20 }))}>다음</button>
            </div>
          </div>
        </>}
      <button type="button" onClick={handleInvite} disabled={!groupId || isLoading || loadingUsers || !selectedUserId}
        className="primary-button w-full">{isLoading ? '초대하는 중…' : '선택한 사용자 초대'}</button>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
