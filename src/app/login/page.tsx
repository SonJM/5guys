// src/app/login/page.tsx
'use client'

import { createClient } from '@/utils/supabase/client'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function LoginPage() {
  const supabase = createClient()
  const [redirectUrl, setRedirectUrl] = useState('')

  useEffect(() => {
    // 클라이언트 사이드에서만 window 객체에 접근 가능하므로 useEffect 내부에서 설정
    setRedirectUrl(`${window.location.origin}/auth/callback`)
  }, [])

  if (!redirectUrl) {
    // redirectUrl이 설정되기 전까지는 렌더링하지 않음 (서버 사이드 렌더링과의 불일치 방지)
    return null
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-sm text-blue-500 hover:underline mb-4 inline-block">
          &larr; 홈으로 돌아가기
        </Link>
        <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg border dark:border-slate-700">
          <h1 className="text-2xl font-bold text-center text-slate-800 dark:text-slate-100 mb-6">
            로그인 / 회원가입
          </h1>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            theme="dark"
            providers={['google']}
            redirectTo={redirectUrl}
          />
        </div>
      </div>
    </div>
  )
}