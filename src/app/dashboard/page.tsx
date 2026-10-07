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
import AppIcon, { type AppIconName } from '@/components/AppIcon'

type View = 'schedule' | 'group' | 'findDate' | 'ocr' | 'places' | 'more'

const views: { id: View; number: string; label: string; title: string; description: string }[] = [
  { id: 'schedule', number: '01', label: '내 일정', title: '내 시간 정리하기', description: '근무와 약속을 시간 단위로 기록하고, 빈 시간을 확인해 보세요.' },
  { id: 'group', number: '02', label: '그룹', title: '함께하는 사람들', description: '그룹을 만들고 구성원을 초대해 가능 시간만 공유하세요.' },
  { id: 'findDate', number: '03', label: '그룹 달력', title: '언제 만날까요?', description: '함께 비어 있는 시간을 달력에서 보고 여행과 약속을 계획해요.' },
  { id: 'ocr', number: '04', label: '근무표 가져오기', title: '사진에서 근무 일정으로', description: '달력 영역을 선택하고 인식 결과를 확인한 뒤 등록하세요.' },
  { id: 'places', number: '05', label: '장소 추천', title: '어디서 만날까요?', description: '약속 유형에 맞는 장소와 사람별 이동 시간을 비교해요.' },
]

const mobileTabs: { id: View; label: string; icon: AppIconName }[] = [
  { id: 'schedule', label: '내 일정', icon: 'calendar' },
  { id: 'findDate', label: '그룹', icon: 'group' },
  { id: 'places', label: '장소 추천', icon: 'pin' },
  { id: 'more', label: '더보기', icon: 'menu' },
]

export default function DashboardPage() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([])
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
    url.searchParams.delete('plan')
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
          const [{ data: userProfile }, { count }, { data: memberships }] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', user.id).single(),
            supabase.from('planner_patterns').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('group_members').select('group_id, groups(id, name)').eq('user_id', user.id).order('group_id'),
          ])
          setProfile(userProfile)
          setHasWorkPatterns((count ?? 0) > 0)
          const availableGroups = (memberships ?? []).map((row) => (row as unknown as { groups: { id: number; name: string } | null }).groups).filter((group): group is { id: number; name: string } => !!group)
          setGroups(availableGroups)
          setSelectedGroupId(availableGroups[0]?.id ?? null)
        }
      } catch (e) {
        console.error('Error checking user:', e)
      } finally {
        setIsLoading(false)
      }
    }
    void checkUser()
  }, [supabase])

  useEffect(() => {
    if (activeView !== 'findDate' || !user) return
    let alive = true
    void createClient().from('group_members').select('group_id, groups(id, name)').eq('user_id', user.id).order('group_id').then(({ data }) => {
      if (!alive) return
      const available = (data ?? []).map((row) => (row as unknown as { groups: { id: number; name: string } | null }).groups).filter((group): group is { id: number; name: string } => !!group)
      setGroups(available)
      setSelectedGroupId((current) => available.some((group) => group.id === current) ? current : available[0]?.id ?? null)
    })
    return () => { alive = false }
  }, [activeView, user])

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
      case 'findDate': return <GroupAvailability groupId={selectedGroupId} onFindPlace={(planId) => {
        const url = new URL(window.location.href)
        url.searchParams.set('view', 'places')
        url.searchParams.set('plan', planId)
        window.history.pushState(null, '', url)
        setActiveView('places')
      }} />
      case 'places': return <PlaceRecommendations groupId={selectedGroupId} />
      case 'ocr': return <OcrUploader />
      case 'more': return <div className="space-y-5"><h2 className="text-lg font-extrabold">도구와 설정</h2><button type="button" className="flex w-full items-center gap-3 rounded-2xl bg-[var(--surface-soft)] p-4 text-left font-bold" onClick={() => navigate('ocr')}><AppIcon name="camera" className="size-5 text-[var(--brand)]" />근무표 사진 가져오기 <span className="ml-auto">→</span></button><Link href="/settings/work-pattern" className="flex w-full items-center justify-between rounded-2xl bg-[var(--surface-soft)] p-4 font-bold">근무 유형 설정 <span>→</span></Link><Link href="/account" className="flex w-full items-center justify-between rounded-2xl bg-[var(--surface-soft)] p-4 font-bold">계정 설정 <span>→</span></Link><GoogleCalendarConnection /><div className="flex items-center justify-between rounded-2xl bg-[var(--surface-soft)] p-4"><span className="font-bold">테마</span><ThemeSwitcher /></div><SignOutButton /></div>
    }
  }

  const selected = views.find((view) => view.id === activeView)
  const mobileGroupActive = activeView === 'group' || activeView === 'findDate'
  const mobileTitle = activeView === 'schedule' ? '내 일정' : mobileGroupActive ? '우리의 빈 시간' : activeView === 'places' ? '어디서 만날까요?' : activeView === 'ocr' ? '근무표 가져오기' : '더보기'
  const mobileDescription = activeView === 'schedule' ? '친구와 맞출 수 있는 시간을 한눈에' : mobileGroupActive ? '일정 제목은 숨기고 가능한 시간만 공유해요' : activeView === 'places' ? '약속 유형에 맞는 장소를 찾아요' : activeView === 'ocr' ? '사진에서 근무 일정을 만들어요' : '내 설정과 연결을 관리해요'

  if (isLoading) {
    return <div className="app-shell grid min-h-screen place-items-center"><div className="surface-card flex items-center gap-3 px-6 py-5" role="status"><span className="brand-mark">5</span><span className="muted text-sm">일정을 불러오는 중이에요…</span></div></div>
  }

  if (!user) {
    return <div className="app-shell grid min-h-screen place-items-center p-5"><div className="surface-card max-w-sm p-8 text-center"><span className="brand-mark">5</span><h1 className="mt-5 text-xl font-extrabold">로그인이 필요해요</h1><p className="muted mt-2 text-sm">일정을 보려면 다시 로그인해 주세요.</p><Link href="/login" className="primary-button mt-6 w-full">로그인으로 이동</Link></div></div>
  }

  return (
    <div className="app-shell min-h-screen">
      {(!profile || !profile.username) && <UsernameSetupModal onComplete={handleUsernameComplete} />}
      <header className="border-b border-[var(--line)] bg-[var(--surface)]/90 backdrop-blur lg:hidden">
        <div className="flex h-[calc(70px+env(safe-area-inset-top))] items-center justify-between px-5 pt-[calc(8px+env(safe-area-inset-top))]">
          <Link href="/dashboard" className="flex items-center gap-2" aria-label="5총사 대시보드"><span className="brand-mark !size-9 !rounded-xl">5</span><span className="text-lg font-black tracking-tight">5총사</span></Link>
          <Link href="/account" className="grid size-9 place-items-center rounded-full bg-[var(--brand-light)] text-sm font-bold text-[var(--brand)]" aria-label="계정 설정">{(profile?.username ?? '나').slice(0, 1)}</Link>
        </div>
      </header>
      <header className="hidden border-b border-[var(--line)] bg-[var(--surface)]/90 backdrop-blur lg:block">
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

      <div className="mx-auto grid max-w-7xl gap-6 pb-[calc(94px+env(safe-area-inset-bottom))] pt-3 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 lg:px-8 lg:pb-16 lg:pt-10">
        <aside className="hidden min-w-0 lg:block">
          <p className="eyebrow mb-3 px-3">WORKSPACE</p>
          <nav aria-label="데스크톱 주요 메뉴" className="flex flex-col gap-2">
            {views.map((view) => <button key={view.id} type="button" onClick={() => navigate(view.id)} aria-current={activeView === view.id ? 'page' : undefined} className={`flex min-w-max items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition-colors lg:w-full ${activeView === view.id ? 'bg-[var(--brand)] text-white dark:text-[#10352e]' : 'text-[var(--muted)] hover:bg-[var(--brand-light)] hover:text-[var(--brand)]'}`}><span className={`text-xs ${activeView === view.id ? 'opacity-70' : 'text-[var(--brand)]'}`}>{view.number}</span>{view.label}</button>)}
          </nav>
          <div className="soft-card mt-8 hidden p-5 lg:block"><p className="text-sm font-extrabold">더 쉬운 일정 관리</p><p className="muted mt-2 text-xs leading-6">근무 유형을 먼저 설정하면 사진 속 표기와 시간을 더 정확하게 연결할 수 있어요.</p><Link href="/settings/work-pattern" className="brand-link mt-3 inline-block text-xs">근무 유형 설정 →</Link></div>
        </aside>

        <main className="min-w-0 space-y-4 lg:space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4 px-5 lg:px-0">
            <div className="lg:hidden"><h1 className="text-[27px] font-black tracking-tight">{mobileTitle}</h1><p className="muted mt-1 text-xs">{mobileDescription}</p></div>
            <div className="hidden lg:block"><p className="eyebrow">MY PLANNER</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{selected?.title ?? '도구와 설정'}</h1><p className="muted mt-2 text-sm leading-6">{selected?.description ?? '내 계정과 연결을 관리하세요.'}</p></div>
            {activeView === 'schedule' && <button onClick={() => navigate('ocr')} className="secondary-button hidden lg:inline-flex">근무표 사진 가져오기 <span aria-hidden="true">↗</span></button>}
          </div>

          {mobileGroupActive && <div className="flex gap-2 px-5 lg:hidden"><button type="button" onClick={() => navigate('findDate')} aria-current={activeView === 'findDate' ? 'page' : undefined} className={`rounded-full px-4 py-2 text-xs font-bold ${activeView === 'findDate' ? 'bg-[var(--brand-light)] text-[var(--brand)]' : 'bg-[var(--surface)] text-[var(--muted)]'}`}>그룹 달력</button><button type="button" onClick={() => navigate('group')} aria-current={activeView === 'group' ? 'page' : undefined} className={`rounded-full px-4 py-2 text-xs font-bold ${activeView === 'group' ? 'bg-[var(--brand-light)] text-[var(--brand)]' : 'bg-[var(--surface)] text-[var(--muted)]'}`}>멤버 관리</button></div>}
          {mobileGroupActive && groups.length > 0 && <div className="px-5 lg:hidden"><label className="sr-only" htmlFor="mobile-group-select">그룹 선택</label><select id="mobile-group-select" value={selectedGroupId ?? ''} onChange={(event) => setSelectedGroupId(Number(event.target.value))} className="!min-h-9 !rounded-full !border-0 !bg-[var(--brand-light)] !px-4 !text-xs !font-bold !text-[var(--brand)]">{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>}

          {!hasWorkPatterns && (activeView === 'schedule' || activeView === 'ocr') && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f0d7ae] bg-[#fff7e9] px-5 py-4 text-sm text-[#694b27] dark:border-[#725536] dark:bg-[#3b3022] dark:text-[#f8dcb7]"><p><strong>먼저 근무 표기를 설정해 보세요.</strong> 사진 속 주간·야간 등의 기호를 내 일정으로 바꾸는 데 도움이 돼요.</p><Link href="/settings/work-pattern" className="font-extrabold underline underline-offset-4">설정하기 →</Link></div>}

          {activeView === 'schedule' && <div className="hidden lg:block"><GoogleCalendarConnection /></div>}
          <div className="mobile-screen-enter min-w-0 bg-[var(--surface)] p-4 sm:mx-5 sm:rounded-3xl sm:border sm:border-[var(--line)] sm:p-6 lg:mx-0 lg:p-8" key={activeView}>{renderActiveView()}</div>
        </main>
      </div>
      <nav aria-label="모바일 주요 메뉴" className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(70px+env(safe-area-inset-bottom))] items-start justify-around border-t border-[var(--line)] bg-[var(--surface)]/95 px-3 pt-2 shadow-[0_-8px_24px_-20px_rgba(20,66,58,.3)] backdrop-blur lg:hidden">
        {mobileTabs.map((tab) => { const active = tab.id === 'findDate' ? mobileGroupActive : tab.id === 'more' ? activeView === 'more' || activeView === 'ocr' : activeView === tab.id; return <button key={tab.id} type="button" className="mobile-tab" aria-label={tab.label} title={tab.label} aria-current={active ? 'page' : undefined} onClick={() => navigate(tab.id)}><AppIcon name={tab.icon} className="size-6" /></button> })}
      </nav>
    </div>
  )
}
