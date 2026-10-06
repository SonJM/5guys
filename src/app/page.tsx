import Link from 'next/link'

const features = [
  { number: '01', title: '내 시간을 한눈에', detail: '교대 근무와 약속을 시간 단위로 정리하고, 근무표 사진도 일정으로 옮겨요.' },
  { number: '02', title: '함께 가능한 순간 찾기', detail: '일정 제목은 숨긴 채, 그룹 달력에서 서로의 빈 시간을 안전하게 비교해요.' },
  { number: '03', title: '만날 곳까지 자연스럽게', detail: '카페·식사·여행 목적에 맞춰 장소와 사람별 이동 시간을 살펴봐요.' },
]

export default function LandingPage() {
  return (
    <div className="app-shell">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="5총사 홈">
          <span className="brand-mark">5</span>
          <span className="text-lg font-black tracking-tight">5총사</span>
        </Link>
        <Link href="/login" className="secondary-button">로그인</Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1fr_.9fr] lg:gap-20 lg:pb-28 lg:pt-24">
          <div>
            <p className="eyebrow mb-5">MAKE TIME TOGETHER</p>
            <h1 className="max-w-xl text-4xl font-black leading-[1.25] tracking-[-.055em] sm:text-6xl sm:leading-[1.18]">
              복잡한 일정 사이,<br /><span style={{ color: 'var(--brand)' }}>우리의 시간</span>을 찾다.
            </h1>
            <p className="muted mt-7 max-w-lg text-base leading-8 sm:text-lg">
              제각각인 근무표와 캘린더를 한곳에 모으고, 모두가 편한 약속 시간을 찾아보세요. 어디서 만날지도 함께 정할 수 있어요.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/login" className="primary-button !min-h-12 !px-6">무료로 시작하기 <span aria-hidden="true">↗</span></Link>
              <a href="#how-it-works" className="secondary-button !min-h-12 !px-6">어떻게 사용하나요?</a>
            </div>
            <p className="muted mt-5 text-xs">Google 계정으로 간편하게 시작 · 일정 제목은 기본적으로 공유되지 않아요</p>
          </div>

          <div className="relative mx-auto w-full max-w-[480px]" aria-label="일정 조율 화면 예시">
            <div className="absolute -left-5 -top-6 h-32 w-32 rounded-full bg-[#d9f1e8] blur-3xl dark:bg-[#285347]" />
            <div className="absolute -bottom-8 -right-6 h-40 w-40 rounded-full bg-[#f9d4cb] blur-3xl dark:bg-[#5c3634]" />
            <div className="surface-card relative overflow-hidden p-5 sm:p-7">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="eyebrow">이번 주의 우리</p>
                  <h2 className="mt-1 text-xl font-extrabold">함께 맞는 시간</h2>
                </div>
                <span className="rounded-full bg-[var(--brand-light)] px-3 py-1 text-xs font-bold text-[var(--brand)]">3명 참여 중</span>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                {['월', '화', '수', '목', '금'].map((d, i) => (
                  <div key={d} className={`rounded-2xl px-1 py-3 ${i === 2 ? 'bg-[var(--brand)] text-white dark:text-[#10352e]' : 'bg-[var(--surface-soft)]'}`}>
                    <div className="opacity-70">{d}</div><div className="mt-2 text-base font-extrabold">{14 + i}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-soft)] p-3"><span className="h-8 w-8 rounded-full bg-[#bce8dc]" /><span className="text-sm font-semibold">지은</span><span className="ml-auto text-xs text-[var(--brand)]">18:00 이후 가능</span></div>
                <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-soft)] p-3"><span className="h-8 w-8 rounded-full bg-[#f8c4b9]" /><span className="text-sm font-semibold">민호</span><span className="ml-auto text-xs text-[var(--brand)]">19:00 이후 가능</span></div>
                <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-soft)] p-3"><span className="h-8 w-8 rounded-full bg-[#d4e8f6]" /><span className="text-sm font-semibold">서연</span><span className="ml-auto text-xs text-[var(--brand)]">18:30 이후 가능</span></div>
              </div>
              <div className="mt-5 rounded-xl bg-[var(--accent-soft)] p-4 text-sm text-[var(--accent-ink)]"><span className="font-extrabold">추천 시간</span><span className="float-right font-bold">수요일 19:00 – 21:00</span></div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-t border-[var(--line)] bg-[var(--surface)] px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <p className="eyebrow">SIMPLE BY DESIGN</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">약속 잡는 과정이 가벼워집니다</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {features.map((feature) => <article key={feature.number} className="soft-card p-7"><span className="eyebrow">{feature.number}</span><h3 className="mt-8 text-xl font-extrabold">{feature.title}</h3><p className="muted mt-3 text-sm leading-7">{feature.detail}</p></article>)}
            </div>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-[var(--muted)] sm:px-8"><span>© 5총사 · 함께 맞추는 우리의 시간</span><Link href="/login" className="brand-link">시작하기 →</Link></footer>
    </div>
  )
}
