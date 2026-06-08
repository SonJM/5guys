'use client'

import type { MemberSchedule } from '@/types'

type Props = {
  currentDate: Date
  schedules: MemberSchedule[]
  userId: string
  onDayClick: (date: Date) => void
  selectedDay: Date | undefined
}

const STATUS_COLOR: Record<string, string> = {
  A: 'bg-blue-500 text-white',
  B: 'bg-sky-500 text-white',
  C: 'bg-teal-500 text-white',
  '휴무': 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300',
  '약속': 'bg-purple-500 text-white',
}

function getWeekDays(date: Date): Date[] {
  const monday = new Date(date)
  const day = monday.getDay()
  const diff = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function toISODateString(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0]
}

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const TODAY = toISODateString(new Date())

export default function WeekView({ currentDate, schedules, userId, onDayClick, selectedDay }: Props) {
  const weekDays = getWeekDays(currentDate)

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

  const selectedDateStr = selectedDay ? toISODateString(selectedDay) : null

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="p-2 text-left text-xs text-slate-400 w-20 shrink-0">멤버</th>
            {weekDays.map((d, i) => {
              const dateStr = toISODateString(d)
              const isToday = dateStr === TODAY
              const isSelected = dateStr === selectedDateStr
              return (
                <th
                  key={i}
                  className={`p-2 text-center cursor-pointer select-none rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-blue-100 dark:bg-blue-900/40'
                      : isToday
                      ? 'bg-slate-100 dark:bg-slate-700/50'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                  }`}
                  onClick={() => onDayClick(d)}
                >
                  <div className={`text-xs font-normal ${i === 5 ? 'text-blue-500' : i === 6 ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                    {DAY_LABELS[i]}
                  </div>
                  <div className={`text-sm font-semibold mt-0.5 ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>
                    {d.getDate()}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {memberIds.map(uid => {
            const name = memberMap.get(uid) ?? '알 수 없음'
            const isMe = uid === userId
            return (
              <tr key={uid} className="border-t dark:border-slate-700">
                <td className={`p-2 text-xs whitespace-nowrap ${isMe ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}`}>
                  {name}{isMe ? ' (나)' : ''}
                </td>
                {weekDays.map((d, i) => {
                  const dateStr = toISODateString(d)
                  const schedule = schedules.find(s => s.user_id === uid && s.date === dateStr)
                  const colorClass = schedule ? STATUS_COLOR[schedule.status] ?? 'bg-orange-400 text-white' : ''
                  return (
                    <td
                      key={i}
                      className="p-1 text-center cursor-pointer"
                      onClick={() => onDayClick(d)}
                    >
                      {schedule ? (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${colorClass}`}>
                          {schedule.status}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 text-xs">-</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
          {memberIds.length === 0 && (
            <tr>
              <td colSpan={8} className="p-4 text-center text-slate-400 text-sm">
                그룹 멤버가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
