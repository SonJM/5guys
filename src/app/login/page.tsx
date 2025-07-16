'use client'
import { createClient } from '@/utils/supabase/client'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push('/') // 로그인 되면 홈페이지로 이동
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, router])


  return (
    <div style={{ maxWidth: '420px', margin: '96px auto' }}>
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={['google', 'kakao']} // 필요 없다면 이 줄을 지워도 됩니다.
        redirectTo={`${process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000'}/auth/callback`}
      />
    </div>
  )
}