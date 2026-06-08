'use client'

import type { MemberSchedule, ScheduleStatus } from '@/types'

type Props = {
  currentDate: Date
  schedules: MemberSchedule[]
  userId: string
  onSaveSchedule: (status: ScheduleStatus | '삭제') => void
}

const STATUS_COLOR: Record<string, string> = {
  A: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  B: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  C: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  '휴무': 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  '약속': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
}

function toISODateString(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0]
}

const EDIT_STATUSES: ScheduleStatus[] = ['A', 'B', 'C', '휴무']

export default function DayView({ currentDate, schedules, userId, onSaveSchedule }: Props) {
  const dateStr = toISODateString(currentDate)
  const daySchedules = schedules.filter(s => s.date === dateStr)

  const memberMap = new Map<string, string>()
  schedules.forEach(s => {
    if (s.profiles?.username) memberMap.set(s.user_id, s.profiles.username)
  })
  const memberIds = Array.from(memberMap.keys())
  memberIds.sort((a, b) => {
    if (a === userId) return -1
    if (b === userId) return 1
    return 0
  })

  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const dateLabel = `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월 ${currentDate.getDate()}일 (${dayNames[currentDate.getDay()]})`

  return (
    <div>
      <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3">{dateLabel}</h3>
      <div className="divide-y dark:divide-slate-700">
        {memberIds.map(uid => {
          const name = memberMap.get(uid) ?? '알 수 없음'
          const isMe = uid === userId
          const schedule = daySchedules.find(s => s.user_id === uid)
          const colorClass = schedule ? STATUS_COLOR[schedule.status] ?? 'bg-orange-100 text-orange-700' : ''

          return (
            <div key={uid} className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-sm ${isMe ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>
                  {name}{isMe ? ' (나)' : ''}
                </span>
                {schedule ? (
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>
                    {schedule.event_title ? `${schedule.status} — ${schedule.event_title}` : schedule.status}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">-</span>
                )}
              </div>

              {isMe && (
                <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                  {EDIT_STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => onSaveSchedule(s)}
                      className={`px-2 py-1 text-xs rounded-md font-semibold transition-colors ${
                        schedule?.status === s
                          ? 'ring-2 ring-offset-1 ring-blue-500 bg-blue-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                  {schedule && (
                    <button
                      onClick={() => onSaveSchedule('삭제')}
                      className="px-2 py-1 text-xs rounded-md font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200"
                    >
                      삭제
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {memberIds.length === 0 && (
          <p className="py-4 text-sm text-slate-400 text-center">그룹 멤버가 없습니다.</p>
        )}
      </div>
    </div>
  )
}
