// src/app/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
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

export default function DashboardPage() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUser(user)
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          setProfile(userProfile)
        }
      } catch (e) {
        console.error("Error checking user:", e)
      } finally {
        setIsLoading(false)
      }
    }
    checkUser()
  }, [supabase])

  const handleUsernameComplete = () => {
    window.location.reload()
  }

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>
  }

  if (user) {
    return (
      <>
        {(!profile || !profile.username) && <UsernameSetupModal onComplete={handleUsernameComplete} />}
        
        <div className="flex flex-col items-center min-h-screen p-4 md:p-8">
          <div className="w-full max-w-4xl relative">
            <div className="absolute top-0 right-0 flex items-center gap-3">
              <ThemeSwitcher />
              <SignOutButton />
            </div>
          </div>
          {/* w-full 추가 및 mt-12 sm:mt-16으로 수정 */}
          <div className="w-full max-w-4xl bg-white dark:bg-slate-800/50 dark:backdrop-blur-sm p-6 md:p-8 mt-12 sm:mt-16 rounded-xl shadow-lg border dark:border-slate-700">
            <GroupManager 
              user={user} 
              selectedGroupId={selectedGroupId}
              setSelectedGroupId={setSelectedGroupId}
            />
            <hr className="my-8 border-slate-200 dark:border-slate-700" />
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-100">🗓️ 스케줄 관리</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              안녕하세요, <span className="font-semibold text-blue-600 dark:text-blue-400">{profile?.username || user.email}</span>님!
              <Link href="/account" className="ml-4 text-xs text-slate-500 hover:underline">
                [계정 설정]
              </Link>
            </p>
            <p className="text-slate-500 dark:text-slate-400">달력에서 날짜를 클릭하여 근무 일정을 등록하세요.</p>
            <ScheduleCalendar user={user} selectedGroupId={selectedGroupId} />
            <FindBestDate selectedGroupId={selectedGroupId} />
            <OcrUploader />
          </div>
        </div>
      </>
    )
  }

  return null
}