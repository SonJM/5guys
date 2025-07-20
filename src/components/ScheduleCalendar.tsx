'use client'

import { createClient } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'

// 스케줄과 사용자 정보를 함께 담을 타입
type MemberSchedule = {
  date: string
  status: string
  user_id: string 
  profiles: {
    username: string | null
  } | null
}

// 컴포넌트가 받을 props 타입을 정의합니다.
type ScheduleCalendarProps = {
  user: User
  selectedGroupId: number | null
}

export default function ScheduleCalendar({ user, selectedGroupId }: ScheduleCalendarProps) {
  const supabase = createClient()
  const [schedules, setSchedules] = useState<MemberSchedule[]>([])
  const [selectedDay, setSelectedDay] = useState<Date | undefined>()
  const [isLoading, setIsLoading] = useState(true)

  // 선택된 그룹이 바뀔 때마다 해당 그룹의 스케줄을 다시 불러옵니다.
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
        console.error("Error fetching group members:", memberError)
        setSchedules([])
        setIsLoading(false)
        return
      }

      const memberIds = members.map(m => m.user_id)

      // 멤버 ID 목록을 사용해 해당 멤버들의 스케줄을 모두 가져옵니다.
      const { data, error } = await supabase
        .from('schedules')
        .select(`date, status, user_id, profiles ( username )`)
        .in('user_id', memberIds)

      if (error) {
        console.error("Error fetching group schedules:", error)
        setSchedules([])
      } else if (data) {
        setSchedules(data.map(schedule => ({
          ...schedule,
          profiles: Array.isArray(schedule.profiles) ? schedule.profiles[0] : schedule.profiles,
        })))
      }
      setIsLoading(false)
    }

    fetchSchedules()
  }, [selectedGroupId, supabase])
  
  // 날짜를 YYYY-MM-DD 형식의 문자열로 변환하는 함수
  const toISODateString = (date: Date) => {
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000 )).toISOString().split("T")[0];
  }

  // '나의' 스케줄을 저장하고 즉시 UI에 반영하는 함수
  const handleSaveSchedule = async (status: 'A' | 'B' | 'C' | '휴무' | '삭제') => {
    if (!selectedDay) return
    const dateString = toISODateString(selectedDay)

    if (status === '삭제') {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .match({ user_id: user.id, date: dateString })

      if (!error) {
        setSchedules(prev => prev.filter(s => !(s.user_id === user.id && s.date === dateString)))
      }
    } else {
      const newScheduleData = { user_id: user.id, date: dateString, status: status };
      // upsert는 select를 함께 호출해야 반환값을 받을 수 있습니다.
      const { data, error } = await supabase
        .from('schedules')
        .upsert(newScheduleData)
        .select(`*, profiles (username)`)
        .single();
        
      if (!error && data) {
        setSchedules(prev => {
          const existingIndex = prev.findIndex(s => s.user_id === user.id && s.date === dateString);
          if (existingIndex > -1) {
            const newSchedules = [...prev];
            newSchedules[existingIndex] = data;
            return newSchedules;
          } else {
            return [...prev, data];
          }
        });
      }
    }
    setSelectedDay(undefined)
  }
  
  // 근무 형태별로 날짜를 분류합니다.
  const workA_Days = schedules.filter(s => s.status === 'A').map(s => new Date(`${s.date}T00:00:00Z`));
  const workB_Days = schedules.filter(s => s.status === 'B').map(s => new Date(`${s.date}T00:00:00Z`));
  const workC_Days = schedules.filter(s => s.status === 'C').map(s => new Date(`${s.date}T00:00:00Z`));

  // 선택된 날짜에 근무하는 멤버 목록
  const membersWorkingOnSelectedDay = selectedDay 
    ? schedules.filter(s => s.date === toISODateString(selectedDay) && s.status !== '휴무') 
    : [];

  return (
    <div className="flex flex-col sm:flex-row gap-8 mt-4">
      <DayPicker
        mode="single"
        selected={selectedDay}
        onDayClick={(day) => setSelectedDay(day)}
        modifiers={{ 
          workA: workA_Days,
          workB: workB_Days,
          workC: workC_Days,
        }}
        modifiersClassNames={{
          workA: 'rdp-day_workA',
          workB: 'rdp-day_workB',
          workC: 'rdp-day_workC',
        }}
        disabled={isLoading}
        className="border rounded-lg p-4 bg-white dark:bg-slate-800 dark:border-slate-700 shadow-sm"
        footer={
          <div className="mt-2 min-h-[4rem]">
            {selectedDay && membersWorkingOnSelectedDay.length > 0 && (
                <p className="font-bold text-sm dark:text-slate-200">{selectedDay.toLocaleDateString()} 근무자:</p>
            )}
            <ul className="text-xs text-slate-500 dark:text-slate-400">
                {membersWorkingOnSelectedDay.map((s, i) => (
                    <li key={i}>- {s.profiles?.username || '이름 없음'} ({s.status})</li>
                ))}
            </ul>
          </div>
        }
      />
      
      <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50 min-w-[200px]">
        <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">내 스케줄 등록</h4>
        {selectedDay ? (
            <div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {selectedDay.toLocaleDateString()}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                    <button onClick={() => handleSaveSchedule('A')} className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600">A 근무</button>
                    <button onClick={() => handleSaveSchedule('B')} className="px-3 py-1 bg-sky-500 text-white text-sm rounded-md hover:bg-sky-600">B 근무</button>
                    <button onClick={() => handleSaveSchedule('C')} className="px-3 py-1 bg-teal-500 text-white text-sm rounded-md hover:bg-teal-600">C 근무</button>
                    <button onClick={() => handleSaveSchedule('휴무')} className="px-3 py-1 bg-green-500 text-white text-sm rounded-md hover:bg-green-600">휴무</button>
                    <button onClick={() => handleSaveSchedule('삭제')} className="px-3 py-1 bg-red-500 text-white text-sm rounded-md col-span-2 hover:bg-red-600">삭제</button>
                </div>
            </div>
        ) : (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">달력에서 날짜를 선택하세요.</p>
        )}
      </div>
    </div>
  )
}