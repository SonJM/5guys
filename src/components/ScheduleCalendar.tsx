'use client'

import { createClient } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css' // 달력 기본 스타일

// schedules 테이블의 타입을 정의합니다.
type Schedule = {
  id: number
  date: string
  status: string
}

export default function ScheduleCalendar({ user }: { user: User }) {
  const supabase = createClient()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedDay, setSelectedDay] = useState<Date | undefined>()
  const [isLoading, setIsLoading] = useState(true)

  // 컴포넌트가 처음 로드될 때 내 스케줄을 불러옵니다.
  useEffect(() => {
    const fetchSchedules = async () => {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('user_id', user.id)

      if (data) {
        setSchedules(data)
      }
      setIsLoading(false)
    }

    fetchSchedules()
  }, [supabase, user.id])

  // 날짜를 YYYY-MM-DD 형식의 문자열로 변환하는 함수
  const toISODateString = (date: Date) => {
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000 ))
      .toISOString()
      .split("T")[0];
  }

  // 근무일만 필터링해서 DayPicker에 표시
  const workDays = schedules
    .filter((s) => s.status === '근무')
    .map((s) => new Date(s.date))

  // 날짜를 클릭했을 때 호출되는 함수
  const handleDayClick = (day: Date) => {
    setSelectedDay(day)
  }

  // '근무' 또는 '휴무'를 저장하는 함수
  const handleSaveSchedule = async (status: '근무' | '휴무' | '삭제') => {
    if (!selectedDay) return

    const dateString = toISODateString(selectedDay)

    if (status === '삭제') {
      // 스케줄 삭제
      const { error } = await supabase
        .from('schedules')
        .delete()
        .match({ user_id: user.id, date: dateString })
      
      if (!error) {
        setSchedules(schedules.filter(s => s.date !== dateString))
      }
    } else {
      // 스케줄 추가 또는 업데이트 (upsert)
      const { data, error } = await supabase
        .from('schedules')
        .upsert({ user_id: user.id, date: dateString, status: status })
        .select()
        .single()
      
      if (data) {
        // 기존 스케줄을 업데이트하거나 새로 추가합니다.
        const existingIndex = schedules.findIndex(s => s.date === dateString)
        if (existingIndex > -1) {
          const newSchedules = [...schedules]
          newSchedules[existingIndex] = data
          setSchedules(newSchedules)
        } else {
          setSchedules([...schedules, data])
        }
      }
    }
    setSelectedDay(undefined) // 선택 초기화
  }

  return (
    <div className="flex flex-col sm:flex-row gap-8 mt-4">
      <DayPicker
        mode="single"
        selected={selectedDay}
        onDayClick={handleDayClick}
        modifiers={{ work: workDays }}
        // modifiersStyles를 modifiersClassNames로 변경합니다.
        modifiersClassNames={{
          work: 'rdp-day_work',
        }}
        disabled={isLoading}
        className="border rounded-lg p-4 bg-white dark:bg-slate-800 dark:border-slate-700 shadow-sm"
      />
      {selectedDay && (
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50">
          <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">{selectedDay.toLocaleDateString()}</h4>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">상태를 선택하세요:</p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => handleSaveSchedule('근무')} className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600">근무</button>
            <button onClick={() => handleSaveSchedule('휴무')} className="px-3 py-1 bg-green-500 text-white text-sm rounded-md hover:bg-green-600">휴무</button>
            <button onClick={() => handleSaveSchedule('삭제')} className="px-3 py-1 bg-red-500 text-white text-sm rounded-md hover:bg-red-600">삭제</button>
          </div>
        </div>
      )}
    </div>
  )
}