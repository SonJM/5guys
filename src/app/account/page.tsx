'use client'

import { createClient } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { updateUsernameAction } from '@/app/actions'
import Link from 'next/link'

export default function AccountPage() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [username, setUsername] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single()
        if (profile) {
          setUsername(profile.username || '')
        }
      }
      setIsLoading(false)
    }
    fetchProfile()
  }, [supabase])

  const handleUpdateUsername = async (event: React.FormEvent) => {
    event.preventDefault()
    setMessage('')
    const result = await updateUsernameAction(username)
    if (result.error) {
      setMessage(`오류: ${result.error}`)
    } else {
      setMessage('성공적으로 업데이트되었습니다!')
    }
  }

  if (isLoading) {
    return <div className="app-shell grid min-h-screen place-items-center"><p className="muted" role="status">계정 정보를 불러오는 중이에요…</p></div>
  }

  return (
    <div className="app-shell min-h-screen p-5 sm:p-8">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/dashboard" className="brand-link text-sm">← 대시보드로 돌아가기</Link>
        <div className="mt-8"><p className="eyebrow">MY ACCOUNT</p><h1 className="mt-2 text-3xl font-black tracking-tight">계정 설정</h1><p className="muted mt-2 text-sm">내 정보와 근무 표기를 관리할 수 있어요.</p></div>
        <div className="surface-card mt-6 p-6 sm:p-8">
          <h2 className="text-lg font-extrabold">프로필</h2>
          <p className="muted mt-2 text-sm">이메일 · {user?.email}</p>
          
          <form onSubmit={handleUpdateUsername} className="mt-6 border-t border-[var(--line)] pt-6">
            <div>
              <label htmlFor="username" className="block text-sm font-bold">
                이름 (별명)
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-2 w-full"
              />
            </div>
            <button
              type="submit"
              className="primary-button mt-4"
            >
              저장
            </button>
            {message && <p role="status" className="status-note mt-4">{message}</p>}
          </form>
        </div>
        <div className="soft-card mt-5 flex flex-wrap items-center justify-between gap-4 p-6"><div><h2 className="font-extrabold">나의 근무 표기와 시간</h2><p className="muted mt-1 text-sm">근무 유형, OCR 별칭, 교대 시간 설정</p></div><Link href="/settings/work-pattern" className="secondary-button">설정하기 →</Link></div>
      </div>
    </div>
  )
}
