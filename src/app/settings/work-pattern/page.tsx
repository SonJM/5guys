
'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function WorkPatternPage() {
  const [patternName, setPatternName] = useState('')
  const [shifts, setShifts] = useState([
    { name: '', code: '', startTime: '', endTime: '' },
  ])

  const handleAddShift = () => {
    setShifts([...shifts, { name: '', code: '', startTime: '', endTime: '' }])
  }

  const handleShiftChange = (
    index: number,
    field: keyof typeof shifts[0],
    value: string
  ) => {
    const newShifts = [...shifts]
    newShifts[index][field] = value
    setShifts(newShifts)
  }

  const handleSave = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // 기존 패턴 삭제
      await supabase.from('work_patterns').delete().eq('user_id', user.id)
      // 새로운 패턴 추가
      const { error } = await supabase.from('work_patterns').insert(
        shifts.map(shift => ({
          user_id: user.id,
          pattern_name: patternName,
          shift_name: shift.name,
          shift_code: shift.code,
          start_time: shift.startTime,
          end_time: shift.endTime,
        }))
      )
      if (error) {
        alert('저장에 실패했습니다.')
      } else {
        alert('저장되었습니다.')
      }
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">근무 패턴 설정</h1>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">패턴 이름</label>
        <input
          type="text"
          value={patternName}
          onChange={(e) => setPatternName(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>
      {shifts.map((shift, index) => (
        <div key={index} className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">근무 형태</label>
            <input
              type="text"
              value={shift.name}
              onChange={(e) => handleShiftChange(index, 'name', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">약어</label>
            <input
              type="text"
              value={shift.code}
              onChange={(e) => handleShiftChange(index, 'code', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">시작 시간</label>
            <input
              type="time"
              value={shift.startTime}
              onChange={(e) => handleShiftChange(index, 'startTime', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">종료 시간</label>
            <input
              type="time"
              value={shift.endTime}
              onChange={(e) => handleShiftChange(index, 'endTime', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      ))}
      <button
        onClick={handleAddShift}
        className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
      >
        근무 형태 추가
      </button>
      <button
        onClick={handleSave}
        className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 ml-2"
      >
        저장
      </button>
    </div>
  )
}
