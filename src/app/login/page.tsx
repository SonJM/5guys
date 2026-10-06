// src/app/login/page.tsx
'use client'

import { createClient } from '@/utils/supabase/client'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

export default function LoginPage() {
  const supabase = createClient()
  const [redirectUrl, setRedirectUrl] = useState('')
  const [authError, setAuthError] = useState(false)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    // 클라이언트 사이드에서만 window 객체에 접근 가능하므로 useEffect 내부에서 설정
    setRedirectUrl(`${window.location.origin}/auth/callback`)
    setAuthError(new URLSearchParams(window.location.search).get('error') === 'auth')
  }, [])

  if (!redirectUrl) {
    // redirectUrl이 설정되기 전까지는 렌더링하지 않음 (서버 사이드 렌더링과의 불일치 방지)
    return null
  }

  return (
    <div className="app-shell min-h-screen">
      <header className="mx-auto max-w-5xl px-5 py-6 sm:px-8"><Link href="/" className="inline-flex items-center gap-3"><span className="brand-mark">5</span><span className="text-lg font-black">5총사</span></Link></header>
      <main className="mx-auto grid max-w-5xl items-center gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:pt-20">
        <div className="hidden lg:block">
          <p className="eyebrow">WELCOME BACK</p>
          <h1 className="mt-4 text-5xl font-black leading-tight tracking-tight">모두의 시간이<br /><span className="text-[var(--brand)]">만나는 곳</span></h1>
          <p className="muted mt-6 max-w-sm leading-8">바쁜 근무표 사이에서도 함께할 시간을 찾을 수 있도록. 로그인하고 우리의 다음 약속을 이어가세요.</p>
          <div className="soft-card mt-10 max-w-sm p-6"><p className="text-sm font-extrabold">내 일정은 내 방식대로</p><p className="muted mt-2 text-sm leading-6">그룹에는 확인한 가능 시간만 공유돼요. 근무 종류와 약속 제목은 기본적으로 공개되지 않습니다.</p></div>
        </div>
        <div className="surface-card w-full max-w-md justify-self-center p-6 sm:p-9">
          <p className="eyebrow">SIGN IN</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">다시 만나서 반가워요</h2>
          <p className="muted mt-3 mb-7 text-sm">계정이 없다면 로그인하면서 시작할 수 있어요.</p>
          {authError && <p role="alert" className="mb-5 rounded-xl border border-[#f3c8ad] bg-[#fff3e9] p-3 text-sm text-[#7d4229] dark:border-[#825840] dark:bg-[#3a281f] dark:text-[#ffd5bd]">로그인을 완료하지 못했어요. 다시 시도해 주세요. 문제가 계속되면 관리자에게 알려주세요.</p>}
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa, variables: { default: { colors: { brand: '#0f766e', brandAccent: '#0b5c55', inputBackground: 'transparent' }, radii: { borderRadiusButton: '12px', inputBorderRadius: '12px' } } } }}
            theme={resolvedTheme === 'dark' ? 'dark' : 'default'}
            providers={['google']}
            redirectTo={redirectUrl}
            localization={{ variables: {
              sign_in: { email_label: '이메일', password_label: '비밀번호', email_input_placeholder: '이메일 주소', password_input_placeholder: '비밀번호', button_label: '로그인', loading_button_label: '로그인 중…', social_provider_text: '{{provider}}로 계속하기', link_text: '계정이 없으신가요? 회원가입' },
              sign_up: { email_label: '이메일', password_label: '비밀번호', email_input_placeholder: '이메일 주소', password_input_placeholder: '비밀번호', button_label: '회원가입', loading_button_label: '가입 중…', social_provider_text: '{{provider}}로 계속하기', link_text: '이미 계정이 있으신가요? 로그인', confirmation_text: '이메일로 보낸 확인 링크를 열어주세요.' },
              forgotten_password: { email_label: '이메일', email_input_placeholder: '이메일 주소', button_label: '비밀번호 재설정 메일 보내기', loading_button_label: '전송 중…', link_text: '비밀번호를 잊으셨나요?', confirmation_text: '이메일로 보낸 재설정 링크를 확인해 주세요.' },
              update_password: { password_label: '새 비밀번호', password_input_placeholder: '새 비밀번호', button_label: '비밀번호 변경', loading_button_label: '변경 중…', confirmation_text: '비밀번호가 변경되었습니다.' },
            } }}
          />
          <p className="muted mt-6 border-t border-[var(--line)] pt-5 text-xs leading-5">Google 계정으로 로그인하면 기본 일정은 나만 볼 수 있습니다. Google Calendar 연결은 로그인 후 별도로 선택할 수 있어요.</p>
          <Link href="/" className="brand-link mt-6 inline-block text-sm">← 홈으로 돌아가기</Link>
        </div>
      </main>
    </div>
  )
}
