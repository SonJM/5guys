'use client' // 클라이언트 컴포넌트로 변경합니다.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client' // 클라이언트용 클라이언트를 사용합니다.
import SignOutButton from '@/components/SignOutButton'
import ScheduleCalendar from '@/components/ScheduleCalendar'
import FindBestDate from '@/components/FindBestDate'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import OcrUploader from '@/components/OcrUploader'
import GroupManager from '@/components/GroupManager'
import UsernameSetupModal from '@/components/UsernameSetupModal'

type Profile = {
  id: string;
  username: string | null;
  email: string | null;
}

export default function HomePage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        // 사용자의 프로필 정보도 함께 불러옵니다.
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setProfile(userProfile)
      }
      setIsLoading(false)
    }
    checkUser()
  }, [supabase])

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    fetchUser()
  }, [supabase])

  if (!user) {
    // 로그인 페이지로 리디렉션하는 로직은 미들웨어에서 처리하므로, 여기서는 로딩 상태를 보여줄 수 있습니다.
    return <div>Loading...</div> 
  }
  
  if (user && profile) {
    return (
      <div className="flex flex-col items-center min-h-screen p-4 sm:p-8">
        <div className="w-full max-w-4xl relative">
          <div className="absolute top-0 right-0 flex items-center gap-3">
            <ThemeSwitcher />
            <SignOutButton />
          </div>
        </div>
        <div className="w-full max-w-4xl bg-white dark:bg-slate-800/50 dark:backdrop-blur-sm p-6 sm:p-8 mt-12 sm:mt-16 rounded-xl shadow-lg border dark:border-slate-700">
          
          {/* GroupManager에 상태와 상태 변경 함수를 props로 전달합니다. */}
          <GroupManager 
            user={user} 
            selectedGroupId={selectedGroupId}
            setSelectedGroupId={setSelectedGroupId}
          />

          <hr className="my-8 border-slate-200 dark:border-slate-700" />

          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-100">🗓️ 스케줄 관리</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            안녕하세요, <span className="font-semibold text-blue-600 dark:text-blue-400">{user.email}</span>!
          </p>
          <p className="text-slate-500 dark:text-slate-400">달력에서 날짜를 클릭하여 근무 일정을 등록하세요.</p>

          <ScheduleCalendar user={user} selectedGroupId={selectedGroupId} />
          <FindBestDate selectedGroupId={selectedGroupId} />
          <OcrUploader />
        </div>
      </div>
    )
  }

  return null
}