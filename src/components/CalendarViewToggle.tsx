'use client'

import type { CalendarView } from '@/types'

type Props = {
  view: CalendarView
  currentDate: Date
  onViewChange: (view: CalendarView) => void
  onPrev: () => void
  onNext: () => void
}

function formatLabel(view: CalendarView, date: Date): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  if (view === 'month') return `${y}년 ${m}월`
  if (view === 'week') {
    const weekStart = new Date(date)
    const day = weekStart.getDay()
    const diff = day === 0 ? -6 : 1 - day
    weekStart.setDate(weekStart.getDate() + diff)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    const sm = weekStart.getMonth() + 1
    const sd = weekStart.getDate()
    const em = weekEnd.getMonth() + 1
    const ed = weekEnd.getDate()
    return sm === em ? `${y}년 ${sm}월 ${sd}일 - ${ed}일` : `${y}년 ${sm}월 ${sd}일 - ${em}월 ${ed}일`
  }
  return `${y}년 ${m}월 ${d}일`
}

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: 'month', label: '월' },
  { key: 'week', label: '주' },
  { key: 'day', label: '일' },
]

export default function CalendarViewToggle({ view, currentDate, onViewChange, onPrev, onNext }: Props) {
  return (
    <div className="flex items-center justify-between gap-2 mb-4">
      <div className="flex rounded-lg overflow-hidden border dark:border-slate-600 shrink-0">
        {VIEWS.map(v => (
          <button
            key={v.key}
            onClick={() => onViewChange(v.key)}
            className={`px-3 py-1.5 text-sm font-semibold transition-colors ${
              view === v.key
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          aria-label="이전"
        >
          &#8249;
        </button>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap min-w-[140px] text-center">
          {formatLabel(view, currentDate)}
        </span>
        <button
          onClick={onNext}
          className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          aria-label="다음"
        >
          &#8250;
        </button>
      </div>
    </div>
  )
}
