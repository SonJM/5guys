'use client'

import { createClient } from '@/utils/supabase/client'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import Link from 'next/link'

export default function LoginPage() {
  const supabase = createClient()

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
            redirectTo={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/callback`}
          />
        </div>
      </div>
    </div>
  )
}