// src/app/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'
import TimePlanner from '@/components/TimePlanner'
import GroupAvailability from '@/components/GroupAvailability'
import GoogleCalendarConnection from '@/components/GoogleCalendarConnection'
import PlaceRecommendations from '@/components/PlaceRecommendations'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import OcrUploader from '@/components/OcrUploader'
import GroupManager from '@/components/GroupManager'
import UsernameSetupModal from '@/components/UsernameSetupModal'
import type { Profile } from '@/types'

type View = 'schedule' | 'group' | 'findDate' | 'ocr' | 'places'

export default function DashboardPage() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [activeView, setActiveView] = useState<View>('schedule')
  const [hasWorkPatterns, setHasWorkPatterns] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUser(user)
          const [{ data: userProfile }, { count }] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', user.id).single(),
            supabase.from('planner_patterns').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
          ])
          setProfile(userProfile)
          setHasWorkPatterns((count ?? 0) > 0)
          const { data: membership } = await supabase.from('group_members').select('group_id').eq('user_id', user.id).order('group_id').limit(1)
          setSelectedGroupId(membership?.[0]?.group_id ?? null)
        }
      } catch (e) {
        console.error('Error checking user:', e)
      } finally {
        setIsLoading(false)
      }
    }
    checkUser()
  }, [supabase])

  const handleUsernameComplete = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(userProfile)
    }
  }

  const renderActiveView = () => {
    switch (activeView) {
      case 'schedule':
        return (
          <>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-100">🗓️ 스케줄 관리</h1>
            <p className="my-4 text-slate-500 dark:text-slate-400">근무와 약속을 시간 단위로 관리하세요.</p>
            <TimePlanner />
          </>
        )
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
        )
      case 'findDate':
        return <GroupAvailability groupId={selectedGroupId} />
      case 'places':
        return <PlaceRecommendations />
      case 'ocr':
        return <OcrUploader />
      default:
        return null
    }
  }

  const NavButton = ({ view, label }: { view: View; label: string }) => (
    <button
      onClick={() => setActiveView(view)}
      className={`flex-1 px-2 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${
        activeView === view
          ? 'bg-blue-600 text-white'
          : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
      }`}
    >
      {label}
    </button>
  )

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>
  }

  if (user) {
    return (
      <>
        {(!profile || !profile.username) && <UsernameSetupModal onComplete={handleUsernameComplete} />}

        <div className="flex flex-col items-center min-h-screen p-4 sm:p-8">
          <header className="w-full max-w-4xl flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 hidden sm:block">
                🗓️ 5총사
              </h1>
              <div className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-blue-600 dark:text-blue-400">{profile?.username ?? '사용자'}</span>님
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

          {!hasWorkPatterns && (
            <div className="w-full max-w-4xl mt-4 px-4 py-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg flex items-center justify-between gap-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                💡 근무 패턴을 등록하면 OCR로 더 정확하게 일정을 분석할 수 있어요.
              </p>
              <Link
                href="/settings/work-pattern"
                className="shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-300 underline hover:no-underline"
              >
                패턴 등록 →
              </Link>
            </div>
          )}

          <main className="w-full max-w-4xl mt-6">
            <GoogleCalendarConnection />
            <div className="flex gap-2 p-2 bg-slate-100 dark:bg-slate-900/50 rounded-xl mb-6">
              <NavButton view="schedule" label="스케줄" />
              <NavButton view="group" label="그룹 관리" />
              <NavButton view="findDate" label="날짜 찾기" />
              <NavButton view="ocr" label="OCR 등록" />
              <NavButton view="places" label="장소 추천" />
            </div>

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
