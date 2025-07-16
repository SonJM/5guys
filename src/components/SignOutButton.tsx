'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh() // 페이지를 새로고침하여 상태를 업데이트합니다.
  }

  return (
    <button
      onClick={handleSignOut}
      className="py-2 px-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-sm font-medium"
    >
      로그아웃
    </button>
  )
}