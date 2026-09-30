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

const views: { id: View; number: string; label: string; title: string; description: string }[] = [
  { id: 'schedule', number: '01', label: '내 일정', title: '내 시간 정리하기', description: '근무와 약속을 시간 단위로 기록하고, 빈 시간을 확인해 보세요.' },
  { id: 'group', number: '02', label: '그룹', title: '함께하는 사람들', description: '그룹을 만들고 구성원을 초대해 가능 시간만 공유하세요.' },
  { id: 'findDate', number: '03', label: '가능 시간 찾기', title: '언제 만날까요?', description: '서로 확인한 빈 시간 중 모두에게 맞는 때를 찾아요.' },
  { id: 'ocr', number: '04', label: '근무표 가져오기', title: '사진에서 근무 일정으로', description: '달력 영역을 선택하고 인식 결과를 확인한 뒤 등록하세요.' },
  { id: 'places', number: '05', label: '장소 추천', title: '어디서 만날까요?', description: '약속 유형에 맞는 장소와 사람별 이동 시간을 비교해요.' },
]

export default function DashboardPage() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [activeView, setActiveView] = useState<View>('schedule')
  const [hasWorkPatterns, setHasWorkPatterns] = useState(true)

  useEffect(() => {
    const restoreView = () => {
      const requested = new URLSearchParams(window.location.search).get('view')
      setActiveView(views.find((view) => view.id === requested)?.id ?? 'schedule')
    }
    restoreView()
    window.addEventListener('popstate', restoreView)
    return () => window.removeEventListener('popstate', restoreView)
  }, [])

  const navigate = (view: View) => {
    if (view === activeView) return
    setActiveView(view)
    const url = new URL(window.location.href)
    if (view === 'schedule') url.searchParams.delete('view')
    else url.searchParams.set('view', view)
    window.history.pushState(null, '', url)
  }

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
    void checkUser()
  }, [supabase])

  const handleUsernameComplete = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: userProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(userProfile)
    }
  }

  const renderActiveView = () => {
    switch (activeView) {
      case 'schedule': return <TimePlanner />
      case 'group': return <GroupManager user={user!} selectedGroupId={selectedGroupId} setSelectedGroupId={setSelectedGroupId} />
      case 'findDate': return <GroupAvailability groupId={selectedGroupId} />
      case 'places': return <PlaceRecommendations />
      case 'ocr': return <OcrUploader />
    }
  }

  const selected = views.find((view) => view.id === activeView)!

  if (isLoading) {
    return <div className="app-shell grid min-h-screen place-items-center"><div className="surface-card flex items-center gap-3 px-6 py-5" role="status"><span className="brand-mark">5</span><span className="muted text-sm">일정을 불러오는 중이에요…</span></div></div>
  }

  if (!user) {
    return <div className="app-shell grid min-h-screen place-items-center p-5"><div className="surface-card max-w-sm p-8 text-center"><span className="brand-mark">5</span><h1 className="mt-5 text-xl font-extrabold">로그인이 필요해요</h1><p className="muted mt-2 text-sm">일정을 보려면 다시 로그인해 주세요.</p><Link href="/login" className="primary-button mt-6 w-full">로그인으로 이동</Link></div></div>
  }

  return (
    <div className="app-shell min-h-screen">
      {(!profile || !profile.username) && <UsernameSetupModal onComplete={handleUsernameComplete} />}
      <header className="border-b border-[var(--line)] bg-[var(--surface)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/dashboard" className="flex items-center gap-3" aria-label="5총사 대시보드"><span className="brand-mark">5</span><span className="text-lg font-black tracking-tight">5총사</span></Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="muted hidden text-sm sm:block"><strong className="text-[var(--foreground)]">{profile?.username ?? '사용자'}</strong>님, 반가워요</span>
            <Link href="/account" className="secondary-button !min-h-9 !px-3" aria-label="계정 설정">설정</Link>
            <ThemeSwitcher />
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 lg:pt-10">
        <aside className="min-w-0">
          <p className="eyebrow mb-3 hidden px-3 lg:block">WORKSPACE</p>
          <nav aria-label="주요 메뉴" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0 lg:flex-col lg:overflow-visible">
            {views.map((view) => <button key={view.id} type="button" onClick={() => navigate(view.id)} aria-current={activeView === view.id ? 'page' : undefined} className={`flex min-w-max items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition-colors lg:w-full ${activeView === view.id ? 'bg-[var(--brand)] text-white dark:text-[#10352e]' : 'text-[var(--muted)] hover:bg-[var(--brand-light)] hover:text-[var(--brand)]'}`}><span className={`text-xs ${activeView === view.id ? 'opacity-70' : 'text-[var(--brand)]'}`}>{view.number}</span>{view.label}</button>)}
          </nav>
          <div className="soft-card mt-8 hidden p-5 lg:block"><p className="text-sm font-extrabold">더 쉬운 일정 관리</p><p className="muted mt-2 text-xs leading-6">근무 유형을 먼저 설정하면 사진 속 표기와 시간을 더 정확하게 연결할 수 있어요.</p><Link href="/settings/work-pattern" className="brand-link mt-3 inline-block text-xs">근무 유형 설정 →</Link></div>
        </aside>

        <main className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="eyebrow">MY PLANNER</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{selected.title}</h1><p className="muted mt-2 text-sm leading-6">{selected.description}</p></div>
            {activeView === 'schedule' && <button onClick={() => navigate('ocr')} className="secondary-button">근무표 사진 가져오기 <span aria-hidden="true">↗</span></button>}
          </div>

          {!hasWorkPatterns && (activeView === 'schedule' || activeView === 'ocr') && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f0d7ae] bg-[#fff7e9] px-5 py-4 text-sm text-[#694b27] dark:border-[#725536] dark:bg-[#3b3022] dark:text-[#f8dcb7]"><p><strong>먼저 근무 표기를 설정해 보세요.</strong> 사진 속 주간·야간 등의 기호를 내 일정으로 바꾸는 데 도움이 돼요.</p><Link href="/settings/work-pattern" className="font-extrabold underline underline-offset-4">설정하기 →</Link></div>}

          {activeView === 'schedule' && <GoogleCalendarConnection />}
          <div className="surface-card min-w-0 p-5 sm:p-7 lg:p-8" key={activeView}>{renderActiveView()}</div>
        </main>
      </div>
    </div>
  )
}
