'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { Toast } from '@/components/Toast'
import type { ToastState } from '@/components/Toast'
import type { WorkPattern } from '@/types'

type ShiftRow = {
  name: string
  code: string
  startTime: string
  endTime: string
}

const SHIFT_CODE_OPTIONS = ['A', 'B', 'C', '휴무']

const DEFAULT_ROW: ShiftRow = { name: '', code: 'A', startTime: '', endTime: '' }

export default function WorkPatternPage() {
  const [shifts, setShifts] = useState<ShiftRow[]>([{ ...DEFAULT_ROW }])
  const [toast, setToast] = useState<ToastState>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadPatterns = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setIsLoading(false); return }

      const { data } = await supabase
        .from('work_patterns')
        .select('*')
        .eq('user_id', user.id)
        .order('shift_code')

      if (data && data.length > 0) {
        setShifts((data as WorkPattern[]).map(p => ({
          name: p.shift_name,
          code: p.shift_code,
          startTime: p.start_time ?? '',
          endTime: p.end_time ?? '',
        })))
      }
      setIsLoading(false)
    }
    loadPatterns()
  }, [])

  const handleAddShift = () => {
    setShifts(prev => [...prev, { ...DEFAULT_ROW }])
  }

  const handleRemoveShift = (index: number) => {
    setShifts(prev => prev.filter((_, i) => i !== index))
  }

  const handleShiftChange = (index: number, field: keyof ShiftRow, value: string) => {
    setShifts(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row))
  }

  const handleSave = async () => {
    const validShifts = shifts.filter(s => s.name.trim() !== '')
    if (validShifts.length === 0) {
      setToast({ message: '저장할 근무 패턴이 없습니다.', type: 'error' })
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setToast({ message: '로그인이 필요합니다.', type: 'error' })
      return
    }

    await supabase.from('work_patterns').delete().eq('user_id', user.id)

    const { error } = await supabase.from('work_patterns').insert(
      validShifts.map(shift => ({
        user_id: user.id,
        pattern_name: '기본',
        shift_name: shift.name.trim(),
        shift_code: shift.code,
        start_time: shift.startTime || null,
        end_time: shift.endTime || null,
      }))
    )

    if (error) {
      setToast({ message: '저장에 실패했습니다: ' + error.message, type: 'error' })
    } else {
      setToast({ message: `${validShifts.length}개의 패턴이 저장되었습니다.`, type: 'success' })
    }
  }

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>
  }

  return (
    <div className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-slate-50 dark:bg-slate-900">
      <div className="w-full max-w-2xl">
        <Link href="/account" className="text-sm text-blue-500 hover:underline">
          &larr; 계정 설정으로 돌아가기
        </Link>

        <div className="w-full bg-white dark:bg-slate-800 p-8 mt-4 rounded-xl shadow-lg border dark:border-slate-700">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">근무 패턴 설정</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            근무표 이미지에 표시된 표기를 시스템 코드와 매핑하세요. OCR 분석 시 이 매핑이 사용됩니다.
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  <th className="pb-2 pr-3">이미지 속 표기 (Key)</th>
                  <th className="pb-2 pr-3">저장 코드 (Value)</th>
                  <th className="pb-2 pr-3">시작 시간</th>
                  <th className="pb-2 pr-3">종료 시간</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="space-y-2">
                {shifts.map((shift, index) => (
                  <tr key={index} className="border-t dark:border-slate-700">
                    <td className="py-2 pr-3">
                      <input
                        type="text"
                        value={shift.name}
                        onChange={(e) => handleShiftChange(index, 'name', e.target.value)}
                        placeholder="예: 주간, Day, 나이트"
                        className="w-full p-1.5 border rounded-md text-sm bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={shift.code}
                        onChange={(e) => handleShiftChange(index, 'code', e.target.value)}
                        className="w-full p-1.5 border rounded-md text-sm bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                      >
                        {SHIFT_CODE_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="time"
                        value={shift.startTime}
                        onChange={(e) => handleShiftChange(index, 'startTime', e.target.value)}
                        className="w-full p-1.5 border rounded-md text-sm bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="time"
                        value={shift.endTime}
                        onChange={(e) => handleShiftChange(index, 'endTime', e.target.value)}
                        className="w-full p-1.5 border rounded-md text-sm bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                      />
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => handleRemoveShift(index)}
                        className="text-red-500 hover:text-red-700 text-lg leading-none px-1"
                        aria-label="삭제"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleAddShift}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
            >
              + 행 추가
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
            >
              저장
            </button>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
