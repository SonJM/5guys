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

// 보여줄 화면의 타입을 정의
type View = 'schedule' | 'group' | 'findDate' | 'ocr';

export default function DashboardPage() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  // 현재 활성화된 뷰를 관리하는 상태 추가
  const [activeView, setActiveView] = useState<View>('schedule');

  useEffect(() => {
    const checkUser = async () => {
      // ... (기존 로직 동일)
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

  const renderActiveView = () => {
    // activeView 상태에 따라 다른 컴포넌트를 렌더링하는 함수
    switch (activeView) {
      case 'schedule':
        return (
          <>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-100">🗓️ 스케줄 관리</h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400">달력에서 날짜를 클릭하여 근무 일정을 등록하세요.</p>
            <ScheduleCalendar user={user!} selectedGroupId={selectedGroupId} />
          </>
        );
      case 'group':
        return (
          <>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-100">👥 그룹 관리</h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400">그룹을 만들고 멤버를 초대하여 일정을 공유하세요.</p>
            <div className="mt-6">
              <GroupManager 
                user={user!} 
                selectedGroupId={selectedGroupId}
                setSelectedGroupId={setSelectedGroupId}
              />
            </div>
          </>
        );
      case 'findDate':
        return <FindBestDate selectedGroupId={selectedGroupId} />;
      case 'ocr':
        return <OcrUploader />;
      default:
        return null;
    }
  };
  
  const NavButton = ({ view, label }: { view: View, label: string }) => (
    <button
      onClick={() => setActiveView(view)}
      className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
        activeView === view
          ? 'bg-blue-600 text-white'
          : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
      }`}
    >
      {label}
    </button>
  );

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>
  }

  if (user && profile) {
    return (
      <>
        {!profile.username && <UsernameSetupModal onComplete={handleUsernameComplete} />}
        
        <div className="flex flex-col items-center min-h-screen p-4 sm:p-8">
          <header className="w-full max-w-4xl flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 hidden sm:block">
                🗓️ 5총사
              </h1>
              <div className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-blue-600 dark:text-blue-400">{profile?.username}</span>님
                <Link href="/account" className="ml-2 text-xs text-slate-500 hover:underline">
                  [계정 설정]
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeSwitcher />
              <SignOutButton />
            </div>
          </header>

          <main className="w-full max-w-4xl mt-6">
            {/* --- 메뉴 탭 --- */}
            <div className="flex gap-2 p-2 bg-slate-100 dark:bg-slate-900/50 rounded-xl mb-6">
              <NavButton view="schedule" label="스케줄" />
              <NavButton view="group" label="그룹 관리" />
              <NavButton view="findDate" label="날짜 찾기" />
              <NavButton view="ocr" label="사진 등록" />
            </div>

            {/* --- 선택된 뷰를 렌더링하고 애니메이션 적용 --- */}
            <div 
              key={activeView} 
              className="w-full bg-white dark:bg-slate-800/50 p-6 md:p-8 rounded-xl shadow-lg border dark:border-slate-700 animate-fadeInUp"
            >
              {renderActiveView()}
            </div>
          </main>
        </div>
      </>
    )
  }

  return null
}