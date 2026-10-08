'use client'

import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function LoginPage() {
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setError(new URLSearchParams(window.location.search).has('error'))
  }, [])

  async function signIn() {
    setBusy(true)
    const { error: authError } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'https://www.googleapis.com/auth/calendar.events',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (authError) {
      setError(true)
      setBusy(false)
    }
  }

  return (
    <div className="app-shell min-h-screen">
      <header className="mx-auto max-w-5xl px-5 py-6 sm:px-8"><Link href="/" className="inline-flex items-center gap-3"><span className="brand-mark">5</span><span className="text-lg font-black">5총사</span></Link></header>
      <main className="mx-auto grid max-w-5xl items-center gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:pt-20">
        <div className="hidden lg:block">
          <p className="eyebrow">WELCOME BACK</p>
          <h1 className="mt-4 text-5xl font-black leading-tight tracking-tight">모두의 시간이<br /><span className="text-[var(--brand)]">만나는 곳</span></h1>
          <p className="muted mt-6 max-w-sm leading-8">바쁜 근무표 사이에서도 함께할 시간을 찾을 수 있도록. Google 계정으로 시작하세요.</p>
          <div className="soft-card mt-10 max-w-sm p-6"><p className="text-sm font-extrabold">내 일정은 내 방식대로</p><p className="muted mt-2 text-sm leading-6">그룹에는 빈 시간만 자동으로 공유돼요. 일정 제목은 공개되지 않습니다.</p></div>
        </div>
        <div className="surface-card w-full max-w-md justify-self-center p-6 sm:p-9">
          <p className="eyebrow">SIGN IN</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">다시 만나서 반가워요</h2>
          <p className="muted mt-3 mb-7 text-sm">Google 계정으로 로그인하고 일정을 자동으로 연결하세요.</p>
          {error && <p role="alert" className="status-note mb-5">Google 로그인을 완료하지 못했어요. 다시 시도해 주세요.</p>}
          <button type="button" disabled={busy} onClick={() => void signIn()} className="primary-button w-full">{busy ? 'Google로 이동 중…' : 'Google로 계속하기'}</button>
          <p className="muted mt-6 border-t border-[var(--line)] pt-5 text-xs leading-5">로그인 시 기본 Google Calendar의 일정 읽기·수정 권한을 요청합니다. 내 일정은 나만 볼 수 있고 그룹에는 가능한 시간만 공유됩니다.</p>
          <Link href="/" className="brand-link mt-6 inline-block text-sm">← 홈으로 돌아가기</Link>
        </div>
      </main>
    </div>
  )
}
