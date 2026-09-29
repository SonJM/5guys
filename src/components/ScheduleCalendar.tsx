'use client'

import { createClient } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import type { CalendarView, MemberSchedule, ScheduleStatus } from '@/types'
import CalendarViewToggle from './CalendarViewToggle'
import WeekView from './WeekView'
import DayView from './DayView'
import { Toast } from './Toast'
import type { ToastState } from './Toast'

type ScheduleCalendarProps = {
  user: User
  selectedGroupId: number | null
}

function toISODateString(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0]
}

const STATUS_BUTTONS: { status: ScheduleStatus; label: string; color: string }[] = [
  { status: 'A', label: 'A 근무', color: 'bg-blue-500 hover:bg-blue-600' },
  { status: 'B', label: 'B 근무', color: 'bg-sky-500 hover:bg-sky-600' },
  { status: 'C', label: 'C 근무', color: 'bg-teal-500 hover:bg-teal-600' },
  { status: '휴무', label: '휴무', color: 'bg-green-500 hover:bg-green-600' },
]

export default function ScheduleCalendar({ user, selectedGroupId }: ScheduleCalendarProps) {
  const supabase = createClient()
  const [schedules, setSchedules] = useState<MemberSchedule[]>([])
  const [selectedDay, setSelectedDay] = useState<Date | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [calendarView, setCalendarView] = useState<CalendarView>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [appointmentTitle, setAppointmentTitle] = useState('')
  const [showAppointmentInput, setShowAppointmentInput] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)

  useEffect(() => {
    const fetchSchedules = async () => {
      if (!selectedGroupId) {
        setSchedules([])
        setIsLoading(false)
        return
      }
      setIsLoading(true)

      const { data: members, error: memberError } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', selectedGroupId)

      if (memberError || !members) {
        setToast({ message: '그룹 멤버를 불러오지 못했습니다.', type: 'error' })
        setSchedules([])
        setIsLoading(false)
        return
      }

      const memberIds = members.map(m => m.user_id)

      const { data, error } = await supabase
        .from('schedules')
        .select('date, status, user_id, event_title, profiles ( username )')
        .in('user_id', memberIds)

      if (error) {
        setToast({ message: '스케줄을 불러오지 못했습니다.', type: 'error' })
        setSchedules([])
      } else if (data) {
        setSchedules(
          data.map(s => ({
            ...s,
            profiles: Array.isArray(s.profiles) ? s.profiles[0] : s.profiles,
          })) as MemberSchedule[]
        )
      }
      setIsLoading(false)
    }

    fetchSchedules()
  }, [selectedGroupId, supabase])

  const handleSaveSchedule = async (status: ScheduleStatus | '삭제', eventTitle?: string) => {
    const targetDay = selectedDay ?? currentDate
    const dateString = toISODateString(targetDay)

    if (status === '삭제') {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .match({ user_id: user.id, date: dateString })

      if (error) {
        setToast({ message: '삭제에 실패했습니다.', type: 'error' })
      } else {
        setSchedules(prev => prev.filter(s => !(s.user_id === user.id && s.date === dateString)))
      }
    } else {
      const payload: Record<string, string | null> = {
        user_id: user.id,
        date: dateString,
        status,
        event_title: status === '약속' ? (eventTitle ?? null) : null,
      }

      const { data, error } = await supabase
        .from('schedules')
        .upsert(payload, { onConflict: 'user_id,date' })
        .select('*, profiles (username)')
        .single()

      if (error) {
        setToast({ message: '저장에 실패했습니다.', type: 'error' })
      } else if (data) {
        const updated = {
          ...data,
          profiles: Array.isArray(data.profiles) ? data.profiles[0] : data.profiles,
        } as MemberSchedule
        setSchedules(prev => {
          const idx = prev.findIndex(s => s.user_id === user.id && s.date === dateString)
          if (idx > -1) {
            const next = [...prev]
            next[idx] = updated
            return next
          }
          return [...prev, updated]
        })
      }
    }

    setShowAppointmentInput(false)
    setAppointmentTitle('')
  }

  const handleAppointmentSave = () => {
    if (!appointmentTitle.trim()) {
      setToast({ message: '약속 제목을 입력해주세요.', type: 'error' })
      return
    }
    handleSaveSchedule('약속', appointmentTitle.trim())
  }

  const handleViewChange = (view: CalendarView) => {
    setCalendarView(view)
    setShowAppointmentInput(false)
  }

  const handlePrev = () => {
    const d = new Date(currentDate)
    if (calendarView === 'month') d.setMonth(d.getMonth() - 1)
    else if (calendarView === 'week') d.setDate(d.getDate() - 7)
    else d.setDate(d.getDate() - 1)
    setCurrentDate(d)
  }

  const handleNext = () => {
    const d = new Date(currentDate)
    if (calendarView === 'month') d.setMonth(d.getMonth() + 1)
    else if (calendarView === 'week') d.setDate(d.getDate() + 7)
    else d.setDate(d.getDate() + 1)
    setCurrentDate(d)
  }

  const handleDayClick = (day: Date) => {
    setSelectedDay(day)
    setCurrentDate(day)
    setShowAppointmentInput(false)
  }

  const activeDayStr = selectedDay ? toISODateString(selectedDay) : null
  const myScheduleOnDay = activeDayStr
    ? schedules.find(s => s.user_id === user.id && s.date === activeDayStr)
    : null
  const membersOnDay = activeDayStr
    ? schedules.filter(s => s.date === activeDayStr && s.status !== '휴무')
    : []

  const workA_Days = schedules.filter(s => s.status === 'A').map(s => new Date(`${s.date}T00:00:00Z`))
  const workB_Days = schedules.filter(s => s.status === 'B').map(s => new Date(`${s.date}T00:00:00Z`))
  const workC_Days = schedules.filter(s => s.status === 'C').map(s => new Date(`${s.date}T00:00:00Z`))
  const appointmentDays = schedules.filter(s => s.status === '약속').map(s => new Date(`${s.date}T00:00:00Z`))

  const schedulePanel = (
    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50 w-full md:w-auto md:min-w-[260px]">
      <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">내 스케줄 등록</h4>
      {selectedDay ? (
        <div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {selectedDay.toLocaleDateString()}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {STATUS_BUTTONS.map(({ status, label, color }) => (
              <button
                key={status}
                onClick={() => handleSaveSchedule(status)}
                className={`px-3 py-2 ${color} text-white text-sm rounded-md`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowAppointmentInput(v => !v)}
            className="mt-2 w-full px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-md"
          >
            + 개인 약속 추가
          </button>

          {showAppointmentInput && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={appointmentTitle}
                onChange={e => setAppointmentTitle(e.target.value)}
                placeholder="약속 제목 (예: 병원)"
                className="flex-1 p-1.5 border rounded-md text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                onKeyDown={e => e.key === 'Enter' && handleAppointmentSave()}
              />
              <button
                onClick={handleAppointmentSave}
                className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700"
              >
                저장
              </button>
            </div>
          )}

          {myScheduleOnDay && (
            <button
              onClick={() => handleSaveSchedule('삭제')}
              className="mt-2 w-full px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded-md"
            >
              삭제
            </button>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">달력에서 날짜를 선택하세요.</p>
      )}
    </div>
  )

  return (
    <div className="mt-6">
      <CalendarViewToggle
        view={calendarView}
        currentDate={currentDate}
        onViewChange={handleViewChange}
        onPrev={handlePrev}
        onNext={handleNext}
      />

      {calendarView === 'month' && (
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-auto flex justify-center">
            <DayPicker
              mode="single"
              selected={selectedDay}
              onDayClick={handleDayClick}
              month={new Date(currentDate.getFullYear(), currentDate.getMonth())}
              onMonthChange={setCurrentDate}
              modifiers={{
                workA: workA_Days,
                workB: workB_Days,
                workC: workC_Days,
                appointment: appointmentDays,
              }}
              modifiersClassNames={{
                workA: 'rdp-day_workA',
                workB: 'rdp-day_workB',
                workC: 'rdp-day_workC',
                appointment: 'rdp-day_appointment',
              }}
              disabled={isLoading}
              className="border rounded-lg p-2 sm:p-4 bg-white dark:bg-slate-800 dark:border-slate-700 shadow-sm"
              footer={
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 min-h-[4rem] text-center">
                  {selectedDay && membersOnDay.length > 0 && (
                    <p className="font-bold text-sm dark:text-slate-200">
                      {selectedDay.toLocaleDateString()} 근무자:
                    </p>
                  )}
                  <ul className="text-xs text-slate-500 dark:text-slate-400">
                    {membersOnDay.map((s, i) => (
                      <li key={i}>
                        - {s.profiles?.username || '이름 없음'} ({s.status}
                        {s.event_title ? ` — ${s.event_title}` : ''})
                      </li>
                    ))}
                  </ul>
                </div>
              }
            />
          </div>
          {schedulePanel}
        </div>
      )}

      {calendarView === 'week' && (
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 overflow-x-auto">
            <WeekView
              currentDate={currentDate}
              schedules={schedules}
              userId={user.id}
              onDayClick={handleDayClick}
              selectedDay={selectedDay}
            />
          </div>
          {schedulePanel}
        </div>
      )}

      {calendarView === 'day' && (
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1">
            <DayView
              currentDate={selectedDay ?? currentDate}
              schedules={schedules}
              userId={user.id}
              onSaveSchedule={handleSaveSchedule}
            />
          </div>
          {schedulePanel}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
