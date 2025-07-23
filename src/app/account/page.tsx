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
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-slate-50 dark:bg-slate-900">
      <div className="w-full max-w-xl">
        <Link href="/dashboard" className="text-sm text-blue-500 hover:underline">
          &larr; 메인 페이지로 돌아가기
        </Link>
        <div className="w-full bg-white dark:bg-slate-800 p-8 mt-4 rounded-xl shadow-lg border dark:border-slate-700">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">계정 설정</h1>
          <p className="mt-4 text-slate-600 dark:text-slate-300">이메일: {user?.email}</p>
          
          <form onSubmit={handleUpdateUsername} className="mt-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-600 dark:text-slate-400">
                이름 (별명)
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
              />
            </div>
            <button
              type="submit"
              className="mt-4 px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400"
            >
              저장
            </button>
            {message && <p className="mt-4 text-sm">{message}</p>}
          </form>
        </div>
      </div>
    </div>
  )
}