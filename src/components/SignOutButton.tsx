'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(key => caches.delete(key)))
    }
    router.replace('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="secondary-button !min-h-9 !px-3"
    >
      로그아웃
    </button>
  )
}
